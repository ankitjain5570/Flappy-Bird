import type { Layer, Mechanic, MutableContext, PipeRef } from './mechanics/types';
import { conflicts } from './mechanics/types';
import { pick, rand } from './mechanics/geom';
import { createWind } from './mechanics/wind';
import { createMovingPipes } from './mechanics/movingPipes';
import { createCoins } from './mechanics/coins';
import { createBlades } from './mechanics/blades';
import { createCave } from './mechanics/cave';
import { createWeather } from './mechanics/weather';
import { createPortals } from './mechanics/portals';
import { createLasers } from './mechanics/lasers';
import { createPowerups, type PowerState } from './mechanics/powerups';
import { createBoss } from './mechanics/boss';

/** Cosmetic bird skins, unlocked with coins. Index 0 is the stock bird. */
export const SKINS = [
  { at: 0,   name: 'Classic',  body: '#ffc94b', wing: '#f39a42', beak: '#ff7b48' },
  { at: 25,  name: 'Ruby',     body: '#ff7a7a', wing: '#e04f4f', beak: '#ffb03a' },
  { at: 60,  name: 'Emerald',  body: '#67d99a', wing: '#3fae74', beak: '#ffb03a' },
  { at: 120, name: 'Sapphire', body: '#7ab8ff', wing: '#4d8fd6', beak: '#ffb03a' },
  { at: 220, name: 'Phoenix',  body: '#ffd76b', wing: '#ff8a3d', beak: '#fff2c4' },
];

const COIN_KEY = 'skybound-flap-coins-v1';

/** Score at which each level band begins. Index 0 is level 1. */
const BANDS = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

export interface Mods {
  speedMul: number; gravityMul: number; windY: number; visibility: number; suppressPipes: boolean;
}

type Banner = { title: string; sub: string; t: number };

/**
 * Difficulty manager.
 *
 * Owns which mechanics are running, based only on score and elapsed time. The
 * engine asks it for per-frame modifiers and lets it draw; it never reaches
 * into flight physics, collision or scoring itself.
 */
export class Director {
  private power: PowerState = { active: null, left: 0, shield: false, extraLife: false };

  /** The registry. Adding a mechanic here and to `unlocked` is the whole job. */
  private lib = {
    wind: createWind(),
    moving: createMovingPipes(),
    coins: createCoins(),
    blades: createBlades(),
    weather: createWeather(),
    portals: createPortals(),
    lasers: createLasers(),
  };
  private powerups = createPowerups(this.power);
  private cave: Mechanic | null = null;
  private boss: (Mechanic & { readonly progress: number }) | null = null;

  private active: Mechanic[] = [];
  private event: Mechanic | null = null;      // cave or boss; exclusive
  private level = 1;
  private elapsed = 0;
  private phaseLeft = 0;
  private harshLast = false;
  private caveTimer = 0;
  private bossesDone = 0;
  private powerOn = false;

  private banners: Banner[] = [];
  private coins = 0;
  private lifetimeCoins = 0;
  private skinIndex = 0;

  private ctx: MutableContext;
  private kills = 0;

  constructor(
    dims: { W: number; H: number; GROUND: number; BIRD_X: number; R: number },
    private services: {
      burst: (x: number, y: number, colour: string, n: number) => void;
      shake: (v: number) => void;
      sound: (k: 'coin' | 'power' | 'warn' | 'portal') => void;
    },
  ) {
    this.lifetimeCoins = Number(localStorage.getItem(COIN_KEY) ?? 0) || 0;
    this.skinIndex = this.skinFor(this.lifetimeCoins);
    this.ctx = {
      ...dims,
      score: 0, elapsed: 0, scroll: 0,
      bird: { y: 0, velocity: 0, rotation: 0 },
      pipes: [],
      speedMul: 1, gravityMul: 1, windY: 0, visibility: 1, suppressPipes: false, magnet: false,
      kill: () => { this.kills++; },
      shake: v => this.services.shake(v),
      burst: (x, y, colour, n = 8) => this.services.burst(x, y, colour, n),
      coin: () => { this.coins++; this.addLifetimeCoin(); },
      banner: (title, sub = '') => this.banners.push({ title, sub, t: 0 }),
      sound: k => this.services.sound(k),
    };
  }

  // ---- lifecycle -----------------------------------------------------------

  reset(pipes: PipeRef[]) {
    this.stopAll();
    this.ctx.pipes = pipes;
    this.level = 1; this.elapsed = 0; this.phaseLeft = 0; this.harshLast = false;
    this.caveTimer = 0; this.bossesDone = 0; this.coins = 0; this.kills = 0;
    this.powerOn = false;
    this.banners = [];
    this.power = { active: null, left: 0, shield: false, extraLife: false };
    this.powerups = createPowerups(this.power);
  }

  private stopAll() {
    this.active.forEach(m => m.deactivate(this.ctx));
    this.active = [];
    this.event?.deactivate(this.ctx);
    this.event = null;
    this.cave = null; this.boss = null;
    if (this.powerOn) this.powerups.deactivate(this.ctx);
  }

  // ---- per-frame -----------------------------------------------------------

  tick(dt: number, score: number, bird: { y: number; velocity: number; rotation: number }, baseSpeed: number): Mods {
    const c = this.ctx;
    this.elapsed += dt;
    c.score = score;
    c.elapsed = this.elapsed;
    c.bird = bird;
    // Modifiers are rebuilt from scratch every frame; mechanics only ever multiply
    // or add, so removing one can never leave a residue behind.
    const prevSpeedMul = c.speedMul;
    c.speedMul = 1; c.gravityMul = 1; c.windY = 0; c.visibility = 1; c.suppressPipes = false; c.magnet = false;
    c.scroll = baseSpeed * prevSpeedMul;

    this.updateProgression(dt, score);

    if (this.event) this.event.update(dt, c);
    else this.active.forEach(m => m.update(dt, c));

    if (score >= 25 && !this.powerOn) { this.powerOn = true; this.powerups.activate(c); }
    if (this.powerOn) this.powerups.update(dt, c);

    this.banners = this.banners.filter(b => (b.t += dt) < 2.6);

    return { speedMul: c.speedMul, gravityMul: c.gravityMul, windY: c.windY, visibility: c.visibility, suppressPipes: c.suppressPipes };
  }

  /** Level bands, boss events, cave bursts and endless re-rolls. */
  private updateProgression(dt: number, score: number) {
    // --- boss every 100 points, highest priority ---
    const due = Math.floor(score / 100);
    if (due > this.bossesDone && !this.event) {
      this.bossesDone = due;
      this.startEvent(createBoss() as Mechanic & { readonly progress: number });
      this.boss = this.event as typeof this.boss;
      return;
    }
    if (this.boss && this.event === this.boss) {
      if (this.boss.progress >= 1) { this.boss = null; this.endEvent(score); this.banner('BOSS DOWN', 'Back to the sky'); }
      return;
    }

    // --- cave bursts inside the level 6 band and above ---
    if (this.cave && this.event === this.cave) {
      this.phaseLeft -= dt;
      if (this.phaseLeft <= 0) { this.cave = null; this.endEvent(score); this.caveTimer = rand(24, 34); }
      return;
    }
    const band = this.bandFor(score);
    if (band >= 6) {
      this.caveTimer -= dt;
      if (this.caveTimer <= 0 && !this.event) {
        const cave = createCave();
        this.cave = cave;
        this.startEvent(cave);
        this.phaseLeft = cave.duration;
        return;
      }
    }

    // --- level bands ---
    if (band !== this.level) {
      this.level = band;
      this.banner(`LEVEL ${band}`, this.blurb(band));
      this.rebuild(band);
      this.phaseLeft = band >= 11 ? rand(20, 30) : 0;
      if (band === 6 && this.caveTimer <= 0) this.caveTimer = rand(6, 10);
      return;
    }

    // --- level 11: keep re-rolling the mix, alternating pressure ---
    if (band >= 11) {
      this.phaseLeft -= dt;
      if (this.phaseLeft <= 0) {
        this.harshLast = !this.harshLast;
        this.rollEndless(this.harshLast);
        this.phaseLeft = this.harshLast ? rand(22, 30) : rand(12, 18);
      }
    }
  }

  private bandFor(score: number) {
    let n = 1;
    for (let i = 0; i < BANDS.length; i++) if (score >= BANDS[i]) n = i + 1;
    return n;
  }

  private blurb(band: number) {
    return ['Classic flight', 'Wind zones', 'Moving pipes', 'Coins', 'Rotating blades', 'Caves ahead',
      'Changing weather', 'Gravity portals', 'Laser gates', 'Mixed challenges', 'Anything goes'][band - 1] ?? '';
  }

  /** Mechanics the player has been taught by this score, newest last. */
  private learned(band: number): Mechanic[] {
    const order: [number, Mechanic][] = [
      [2, this.lib.wind], [3, this.lib.moving], [4, this.lib.coins], [5, this.lib.blades],
      [7, this.lib.weather], [8, this.lib.portals], [9, this.lib.lasers],
    ];
    return order.filter(([b]) => band >= b).map(([, m]) => m);
  }

  /** Level 2–10: introduce the newest mechanic, carry over at most two others. */
  private rebuild(band: number) {
    const learned = this.learned(band);
    if (!learned.length) { this.setActive([]); return; }

    if (band === 10) { this.rollMixed(learned); return; }

    const focus = learned[learned.length - 1];
    const carry: Mechanic[] = [];
    // Newest first, so what the player just practised is what stacks.
    for (const m of [...learned].reverse()) {
      if (m === focus || carry.length >= 2) continue;
      if (conflicts(m.name, focus.name)) continue;
      if (carry.some(x => conflicts(x.name, m.name))) continue;
      carry.push(m);
    }
    this.setActive([focus, ...carry]);
  }

  /** Level 10: exactly two previously learned mechanics, recombined. */
  private rollMixed(learned: Mechanic[]) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const a = pick(learned), b = pick(learned);
      if (a !== b && !conflicts(a.name, b.name)) { this.setActive([a, b]); return; }
    }
    this.setActive([learned[0]]);
  }

  /** Level 11: procedural combinations, alternating with lighter breathing spaces. */
  private rollEndless(harsh: boolean) {
    const learned = this.learned(11);
    const want = harsh ? (Math.random() < 0.55 ? 3 : 2) : 1;
    const chosen: Mechanic[] = [];
    let budget = harsh ? 8 : 3;

    for (let attempt = 0; attempt < 40 && chosen.length < want; attempt++) {
      const m = pick(learned);
      if (chosen.includes(m)) continue;
      if (chosen.some(x => conflicts(x.name, m.name))) continue;
      if (m.difficulty > budget) continue;
      chosen.push(m); budget -= m.difficulty;
    }
    this.setActive(chosen);
    this.banner(harsh ? 'BRACE YOURSELF' : 'BREATHE', chosen.map(m => m.name).join(' + ') || 'Clear skies');
  }

  /** Enforces the hard cap: never more than three ambient mechanics at once. */
  private setActive(next: Mechanic[]) {
    const capped = next.slice(0, 3);
    for (const m of this.active) if (!capped.includes(m)) m.deactivate(this.ctx);
    for (const m of capped) if (!this.active.includes(m)) m.activate(this.ctx);
    this.active = capped;
  }

  private startEvent(m: Mechanic) {
    this.active.forEach(x => x.deactivate(this.ctx));
    this.active = [];
    this.event = m;
    m.activate(this.ctx);
  }

  /**
   * Hand the screen back after a boss or cave. The player may have crossed a
   * band boundary while the event owned the screen, so re-read it here rather
   * than restoring the mechanics from before the event.
   */
  private endEvent(score: number) {
    this.event?.deactivate(this.ctx);
    this.event = null;
    const band = this.bandFor(score);
    if (band !== this.level) { this.level = band; this.banner(`LEVEL ${band}`, this.blurb(band)); }
    this.rebuild(band);
    if (band >= 11 && this.phaseLeft <= 0) this.phaseLeft = rand(20, 30);
  }

  private banner(title: string, sub = '') { this.banners.push({ title, sub, t: 0 }); }

  // ---- engine-facing queries ----------------------------------------------

  /** True if a mechanic reported a hit this frame. Cleared on read. */
  takeKill() { const k = this.kills > 0; this.kills = 0; return k; }

  /** Shield, extra life and invincibility all resolve here. */
  absorbHit(): boolean {
    if (this.power.active === 'Invincibility' || this.power.active === 'Rocket Boost') return true;
    if (this.power.shield) { this.power.shield = false; this.banner('SHIELD BROKEN', 'That one was free'); this.services.shake(0.2); return true; }
    if (this.power.extraLife) { this.power.extraLife = false; this.banner('EXTRA LIFE USED', 'Keep flying'); this.services.shake(0.25); return true; }
    return false;
  }

  /** Points awarded for clearing one pipe. Double Score is the only modifier. */
  pipeScore() { return this.power.active === 'Double Score' ? 2 : 1; }

  skin() { return SKINS[this.skinIndex]; }
  runCoins() { return this.coins; }

  private skinFor(total: number) {
    let i = 0;
    SKINS.forEach((s, idx) => { if (total >= s.at) i = idx; });
    return i;
  }

  private addLifetimeCoin() {
    this.lifetimeCoins++;
    try { localStorage.setItem(COIN_KEY, String(this.lifetimeCoins)); } catch { /* storage full or blocked */ }
    const next = this.skinFor(this.lifetimeCoins);
    if (next !== this.skinIndex) {
      this.skinIndex = next;
      this.banner('NEW LOOK UNLOCKED', SKINS[next].name);
    }
  }

  // ---- rendering -----------------------------------------------------------

  render(c: CanvasRenderingContext2D, layer: Layer) {
    if (this.event) this.event.render(c, this.ctx, layer);
    else this.active.forEach(m => m.render(c, this.ctx, layer));
    if (this.powerOn) this.powerups.render(c, this.ctx, layer);
    if (layer === 'hud') this.drawHud(c);
  }

  private drawHud(c: CanvasRenderingContext2D) {
    const { W } = this.ctx;

    if (this.coins) {
      c.font = '700 15px system-ui, sans-serif';
      const label = `◎ ${this.coins}`;
      const w = c.measureText(label).width + 20;
      c.fillStyle = 'rgba(255,255,255,.82)';
      c.beginPath(); c.roundRect(W - w - 14, 76, w, 26, 13); c.fill();
      c.fillStyle = '#c9922a';
      c.fillText(label, W - w - 4, 94);
    }

    const b = this.banners[0];
    if (!b) return;
    // Fade in fast, hold, fade out — never covers the playfield centre.
    const alpha = b.t < 0.25 ? b.t / 0.25 : b.t > 2.1 ? Math.max(0, (2.6 - b.t) / 0.5) : 1;
    c.save();
    c.globalAlpha = alpha;
    c.textAlign = 'center';
    c.font = '800 25px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
    c.lineWidth = 6; c.strokeStyle = 'rgba(20,40,58,.55)';
    c.strokeText(b.title, W / 2, 168);
    c.fillStyle = '#fff';
    c.fillText(b.title, W / 2, 168);
    if (b.sub) {
      c.font = '700 13px system-ui, sans-serif';
      c.lineWidth = 4;
      c.strokeText(b.sub, W / 2, 190);
      c.fillStyle = '#ffe9b8';
      c.fillText(b.sub, W / 2, 190);
    }
    c.textAlign = 'left';
    c.restore();
  }

  /** Dev-only: lets the verification harness jump straight to a level band. */
  debugState() {
    return {
      level: this.level,
      event: this.event ? (this.boss === this.event ? 'boss' : 'cave') : null,
      active: this.active.map(m => m.name),
      coins: this.coins,
    };
  }
}
