import type { Mechanic, MechanicContext } from './types';
import { circleHitsCircle, clamp, pick, rand } from './geom';

/**
 * Boss events, triggered every 100 points.
 * Pipes stop for 20–30 seconds and one boss runs a telegraphed attack loop.
 * The encounter is survival, not a damage race: outlast the timer and normal
 * play resumes. Every projectile is announced by a wind-up marker before it can
 * hurt, and attacks never fill the column — there is always a lane.
 */
export type BossKind = 'Dragon' | 'Mechanical Owl' | 'Alien Ship' | 'Phoenix';

type Attack = 'fireball' | 'laser' | 'rocks' | 'orbs';

const BOSSES: Record<BossKind, { colour: string; accent: string; attacks: Attack[] }> = {
  'Dragon':          { colour: '#c0392b', accent: '#ffb648', attacks: ['fireball', 'rocks'] },
  'Mechanical Owl':  { colour: '#5a6b7c', accent: '#9fd7ff', attacks: ['laser', 'orbs'] },
  'Alien Ship':      { colour: '#4b3f72', accent: '#8affd1', attacks: ['orbs', 'laser'] },
  'Phoenix':         { colour: '#e2711d', accent: '#ffe066', attacks: ['fireball', 'orbs'] },
};

type Shot = { x: number; y: number; vx: number; vy: number; r: number; warn: number; kind: Attack };
type Beam = { y: number; warn: number; live: number };

export function createBoss(kind?: BossKind): Mechanic {
  let boss: BossKind = 'Dragon';
  let x = 0, y = 0, bob = 0, age = 0, total = 25;
  let shots: Shot[] = [];
  let beams: Beam[] = [];
  let cooldown = 0;

  const fire = (ctx: MechanicContext) => {
    const spec = BOSSES[boss];
    const attack = pick(spec.attacks);
    const floor = ctx.H - ctx.GROUND;

    if (attack === 'laser') {
      // Horizontal sweep at one height only, leaving the rest of the column open.
      beams.push({ y: clamp(ctx.bird.y + rand(-70, 70), 80, floor - 80), warn: 1.2, live: 0.9 });
      cooldown = rand(3.4, 4.4);
      return;
    }
    if (attack === 'rocks') {
      // A short, spaced curtain — never a wall.
      const lanes = [rand(60, 140), rand(180, 260), rand(300, 380)].filter(() => Math.random() < 0.7);
      for (const lx of lanes) shots.push({ x: lx, y: -30, vx: 0, vy: rand(150, 200), r: 13, warn: 1.1, kind: 'rocks' });
      cooldown = rand(2.6, 3.6);
      return;
    }
    const aimed = attack === 'fireball';
    const dy = aimed ? clamp((ctx.bird.y - y) / 3.2, -95, 95) : rand(-70, 70);
    shots.push({ x, y, vx: -rand(190, 250), vy: dy, r: aimed ? 14 : 12, warn: 0.75, kind: attack });
    cooldown = aimed ? rand(1.5, 2.2) : rand(1.9, 2.6);
  };

  return {
    name: 'Boss',
    unlockScore: 100,
    duration: 0,        // the director ends it when the timer runs out
    difficulty: 4,

    activate(ctx) {
      boss = kind ?? pick(['Dragon', 'Mechanical Owl', 'Alien Ship', 'Phoenix'] as const);
      x = ctx.W + 90; y = ctx.H / 2 - 40; bob = 0; age = 0; cooldown = 2.2;
      total = rand(21, 29);
      shots = []; beams = [];
      ctx.pipes.forEach(p => { p.active = false; });
      ctx.banner(boss.toUpperCase(), 'Survive the encounter');
    },

    deactivate() { shots = []; beams = []; },

    update(dt, ctx) {
      age += dt;
      bob += dt;
      ctx.suppressPipes = true;
      const floor = ctx.H - ctx.GROUND;

      x += ((ctx.W - 86) - x) * Math.min(1, dt * 1.6);         // glide in, then hold
      y = clamp(ctx.H / 2 - 40 + Math.sin(bob * 0.8) * 90, 90, floor - 130);

      cooldown -= dt;
      if (cooldown <= 0 && age < total - 3) fire(ctx);

      for (const s of shots) {
        if (s.warn > 0) { s.warn -= dt; continue; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === 'orbs') s.y += Math.sin(s.x * 0.03) * 60 * dt;
        if (circleHitsCircle(ctx.BIRD_X, ctx.bird.y, ctx.R, s.x, s.y, s.r)) { ctx.kill(); return; }
      }
      shots = shots.filter(s => s.x > -50 && s.y < floor + 40 && s.x < ctx.W + 120);

      for (const b of beams) {
        if (b.warn > 0) { b.warn -= dt; continue; }
        b.live -= dt;
        if (b.live > 0 && Math.abs(ctx.bird.y - b.y) < ctx.R + 13) { ctx.kill(); return; }
      }
      beams = beams.filter(b => b.live > 0);
    },

    /** The director polls this to know when to hand the screen back. */
    get progress() { return clamp(age / total, 0, 1); },

    render(c, ctx, layer) {
      const spec = BOSSES[boss];
      const floor = ctx.H - ctx.GROUND;

      if (layer === 'back') {
        c.fillStyle = 'rgba(30,24,44,.34)';
        c.fillRect(0, 0, ctx.W, ctx.H);
        return;
      }

      if (layer === 'mid') {
        // Beams: dashed telegraph, then the live bar.
        for (const b of beams) {
          if (b.warn > 0) {
            c.strokeStyle = `rgba(255,80,80,${0.4 + Math.sin(b.warn * 20) * 0.3})`;
            c.lineWidth = 4; c.setLineDash([10, 10]);
            c.beginPath(); c.moveTo(0, b.y); c.lineTo(ctx.W, b.y); c.stroke();
            c.setLineDash([]);
          } else {
            c.fillStyle = 'rgba(255,70,70,.32)'; c.fillRect(0, b.y - 20, ctx.W, 40);
            c.fillStyle = '#ff5252'; c.fillRect(0, b.y - 7, ctx.W, 14);
            c.fillStyle = '#fff'; c.fillRect(0, b.y - 2.5, ctx.W, 5);
          }
        }

        for (const s of shots) {
          if (s.warn > 0) {
            c.strokeStyle = '#ff6b6b'; c.lineWidth = 2.5;
            c.globalAlpha = 0.4 + Math.sin(s.warn * 22) * 0.35;
            c.beginPath(); c.arc(s.x, s.y, s.r + 9, 0, Math.PI * 2); c.stroke();
            c.globalAlpha = 1;
            continue;
          }
          c.fillStyle = s.kind === 'rocks' ? '#7a5c43' : spec.accent;
          c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(255,255,255,.55)';
          c.beginPath(); c.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.34, 0, Math.PI * 2); c.fill();
        }

        // The boss itself: a readable silhouette per kind.
        c.save();
        c.translate(x, y);
        c.fillStyle = 'rgba(0,0,0,.16)';
        c.beginPath(); c.ellipse(0, 44, 44, 9, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = spec.colour;
        if (boss === 'Alien Ship') {
          c.beginPath(); c.ellipse(0, 6, 46, 15, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = spec.accent;
          c.beginPath(); c.arc(0, -8, 22, Math.PI, 0); c.fill();
        } else {
          c.beginPath(); c.ellipse(0, 0, 38, 30, 0, 0, Math.PI * 2); c.fill();
          // wings
          c.fillStyle = spec.colour;
          const flap = Math.sin(bob * 4) * 14;
          c.beginPath(); c.moveTo(-10, -6); c.lineTo(-64, -30 + flap); c.lineTo(-20, 16); c.fill();
          c.beginPath(); c.moveTo(10, -6); c.lineTo(64, -30 + flap); c.lineTo(20, 16); c.fill();
          c.fillStyle = spec.accent;
          c.beginPath(); c.arc(16, -10, 7, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#1d2733';
          c.beginPath(); c.arc(18, -10, 3.2, 0, Math.PI * 2); c.fill();
        }
        c.restore();
        return;
      }

      if (layer === 'hud') {
        const left = Math.max(0, total - age);
        const w = 190, bx = (ctx.W - w) / 2, by = 118;
        c.fillStyle = 'rgba(20,28,42,.55)';
        c.beginPath(); c.roundRect(bx, by, w, 12, 6); c.fill();
        c.fillStyle = spec.accent;
        c.beginPath(); c.roundRect(bx, by, w * clamp(1 - left / total, 0, 1), 12, 6); c.fill();
        c.fillStyle = '#fff';
        c.font = '700 12px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(`${boss.toUpperCase()} · ${Math.ceil(left)}s`, ctx.W / 2, by - 6);
        c.textAlign = 'left';
      }
    },
  } as Mechanic & { readonly progress: number };
}
