import type { Mechanic, MechanicContext } from './types';
import { circleHitsCircle, clamp, pick, rand } from './geom';

/**
 * Powerups. One pickup on screen at a time and one effect running at a time,
 * so the player is never asked to track two overlapping timers.
 *
 * Shield and Extra Life are consumed by the engine through `absorbHit`; the
 * others are read off the shared state each frame.
 */
export type PowerKind =
  | 'Shield' | 'Slow Motion' | 'Coin Magnet' | 'Double Score'
  | 'Extra Life' | 'Invincibility' | 'Rocket Boost';

const SPEC: Record<PowerKind, { colour: string; icon: string; time: number; blurb: string }> = {
  'Shield':        { colour: '#5ec8ff', icon: '🛡', time: 10, blurb: 'Absorbs one hit' },
  'Slow Motion':   { colour: '#b78bff', icon: '⏱', time: 7,  blurb: 'Everything slows down' },
  'Coin Magnet':   { colour: '#ffce4a', icon: '🧲', time: 9,  blurb: 'Coins come to you' },
  'Double Score':  { colour: '#ff9d4a', icon: '×2', time: 10, blurb: 'Two points per pipe' },
  'Extra Life':    { colour: '#ff6b8b', icon: '♥',  time: 0,  blurb: 'Survive one crash' },
  'Invincibility': { colour: '#ffd15c', icon: '★',  time: 6,  blurb: 'Nothing can touch you' },
  'Rocket Boost':  { colour: '#ff7043', icon: '🚀', time: 5,  blurb: 'Blast through everything' },
};

export interface PowerState {
  active: PowerKind | null;
  left: number;
  shield: boolean;
  extraLife: boolean;
}

type Drop = { x: number; y: number; kind: PowerKind; bob: number };

export function createPowerups(state: PowerState): Mechanic {
  let drops: Drop[] = [];
  let next = 0;

  const give = (kind: PowerKind, ctx: MechanicContext) => {
    if (kind === 'Shield') state.shield = true;
    else if (kind === 'Extra Life') state.extraLife = true;
    else { state.active = kind; state.left = SPEC[kind].time; }
    ctx.sound('power');
    ctx.banner(kind.toUpperCase(), SPEC[kind].blurb);
  };

  return {
    name: 'Powerups',
    unlockScore: 25,
    duration: 0,
    difficulty: 0,

    activate() { drops = []; next = rand(9, 15); },
    deactivate() { drops = []; state.active = null; state.left = 0; state.shield = false; state.extraLife = false; },

    update(dt, ctx) {
      next -= dt;
      // "Never spawn two powerups together" — one pickup on screen, and never
      // while an effect is still running.
      if (next <= 0 && drops.length === 0 && !state.active) {
        const pool: PowerKind[] = ['Shield', 'Slow Motion', 'Coin Magnet', 'Double Score', 'Extra Life', 'Invincibility', 'Rocket Boost'];
        const kind = pick(pool.filter(k => !(k === 'Shield' && state.shield) && !(k === 'Extra Life' && state.extraLife)));
        drops.push({ x: ctx.W + 40, y: clamp(rand(160, ctx.H - ctx.GROUND - 160), 90, ctx.H - ctx.GROUND - 90), kind, bob: 0 });
        next = rand(14, 22);
      }

      for (const d of drops) {
        d.x -= ctx.scroll * dt;
        d.bob += dt * 3;
        if (circleHitsCircle(ctx.BIRD_X, ctx.bird.y, ctx.R, d.x, d.y + Math.sin(d.bob) * 6, 19)) {
          give(d.kind, ctx);
          ctx.burst(d.x, d.y, SPEC[d.kind].colour, 14);
          d.x = -999;
        }
      }
      drops = drops.filter(d => d.x > -60);

      if (state.active) {
        state.left -= dt;
        if (state.left <= 0) state.active = null;
      }

      switch (state.active) {
        case 'Slow Motion': ctx.speedMul *= 0.55; break;
        case 'Coin Magnet': ctx.magnet = true; break;
        case 'Rocket Boost':
          ctx.speedMul *= 1.5;
          // Holds a level line so the boost reads as flying, not falling.
          ctx.gravityMul *= 0.15;
          break;
      }
    },

    render(c, ctx, layer) {
      if (layer === 'mid') {
        for (const d of drops) {
          const y = d.y + Math.sin(d.bob) * 6;
          const s = SPEC[d.kind];
          c.save();
          c.translate(d.x, y);
          c.globalAlpha = 0.28;
          c.fillStyle = s.colour;
          c.beginPath(); c.arc(0, 0, 26 + Math.sin(d.bob * 1.6) * 3, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 1;
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.fill();
          c.strokeStyle = s.colour; c.lineWidth = 3;
          c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.stroke();
          c.fillStyle = s.colour;
          c.font = '700 16px system-ui, sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(s.icon, 0, 1);
          c.textAlign = 'left'; c.textBaseline = 'alphabetic';
          c.restore();
        }
        return;
      }

      if (layer === 'front') {
        // Bubble while protected, so invulnerability is never ambiguous.
        if (state.shield || state.active === 'Invincibility' || state.active === 'Rocket Boost') {
          const colour = state.active === 'Invincibility' ? '#ffd15c' : state.active === 'Rocket Boost' ? '#ff7043' : '#5ec8ff';
          c.strokeStyle = colour; c.lineWidth = 3;
          c.globalAlpha = 0.55 + Math.sin(ctx.elapsed * 8) * 0.2;
          c.beginPath(); c.arc(ctx.BIRD_X, ctx.bird.y, ctx.R + 11, 0, Math.PI * 2); c.stroke();
          c.globalAlpha = 1;
        }
        return;
      }

      if (layer === 'hud') {
        const chips: [string, string][] = [];
        if (state.active) chips.push([`${SPEC[state.active].icon} ${Math.ceil(state.left)}s`, SPEC[state.active].colour]);
        if (state.shield) chips.push(['🛡', SPEC.Shield.colour]);
        if (state.extraLife) chips.push(['♥', SPEC['Extra Life'].colour]);
        c.font = '700 13px system-ui, sans-serif';
        chips.forEach(([label, colour], i) => {
          const x = 14, y = 136 + i * 26;
          c.fillStyle = 'rgba(255,255,255,.85)';
          c.beginPath(); c.roundRect(x, y - 14, c.measureText(label).width + 18, 22, 11); c.fill();
          c.fillStyle = colour;
          c.fillText(label, x + 9, y + 2);
        });
      }
    },
  };
}

export const powerSpec = SPEC;
