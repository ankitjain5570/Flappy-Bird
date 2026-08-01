import type { Mechanic, MechanicContext } from './types';
import { circleHitsRect, clamp, lerp, pick, rand } from './geom';

/**
 * Level 8 — Gravity Portals.
 * Fly through a ring and gravity changes for ten seconds, then eases back over
 * a second so control never snaps. Portals are colour-coded and carry a label,
 * and they sit in open air where the bird can also simply fly around them.
 */
type Mode = { name: string; mul: number; colour: string };

const MODES: Mode[] = [
  { name: 'LOW GRAVITY', mul: 0.55, colour: '#63d6ff' },
  { name: 'HEAVY GRAVITY', mul: 1.55, colour: '#ff8a5c' },
  { name: 'FLOAT MODE', mul: 0.28, colour: '#c08bff' },
];

const DURATION = 10, EASE = 1;
const RING_W = 26, RING_H = 128;

type Portal = { x: number; y: number; mode: Mode; used: boolean; t: number };

export function createPortals(): Mechanic {
  let portals: Portal[] = [];
  let next = 0;
  let active: Mode | null = null;
  let left = 0;

  return {
    name: 'Gravity Portals',
    unlockScore: 140,
    duration: 0,
    difficulty: 2,

    activate(ctx) { portals = []; next = 2; active = null; left = 0; ctx.banner('GRAVITY PORTALS', 'Fly through to change gravity'); },
    deactivate() { portals = []; active = null; left = 0; },

    update(dt, ctx) {
      next -= dt;
      if (next <= 0 && portals.length === 0) {
        const y = clamp(rand(200, ctx.H - ctx.GROUND - 200), RING_H / 2 + 40, ctx.H - ctx.GROUND - RING_H / 2 - 40);
        portals.push({ x: ctx.W + 50, y, mode: pick(MODES), used: false, t: 0 });
        next = rand(6, 9);
      }

      for (const p of portals) {
        p.x -= ctx.scroll * dt;
        p.t += dt;
        if (!p.used && circleHitsRect(ctx.BIRD_X, ctx.bird.y, ctx.R, p.x - RING_W / 2, p.y - RING_H / 2, RING_W, RING_H)) {
          p.used = true;
          active = p.mode;
          left = DURATION;
          ctx.sound('portal');
          ctx.burst(p.x, p.y, p.mode.colour, 12);
          ctx.banner(p.mode.name, '10 seconds');
        }
      }
      portals = portals.filter(p => p.x > -60);

      if (active) {
        left -= dt;
        // Ease back to 1.0 over the final second instead of snapping.
        const blend = left > EASE ? 1 : Math.max(0, left / EASE);
        ctx.gravityMul *= lerp(1, active.mul, blend);
        if (left <= 0) active = null;
      }
    },

    render(c, ctx, layer) {
      if (layer === 'mid') {
        for (const p of portals) {
          const spin = p.t * 2;
          c.save();
          c.translate(p.x, p.y);
          c.globalAlpha = p.used ? 0.3 : 1;
          for (let i = 0; i < 3; i++) {
            c.strokeStyle = p.mode.colour;
            c.globalAlpha = (p.used ? 0.2 : 0.85) - i * 0.22;
            c.lineWidth = 4 - i;
            c.beginPath();
            c.ellipse(0, 0, RING_W / 2 + i * 4 + Math.sin(spin + i) * 2, RING_H / 2 + i * 3, 0, 0, Math.PI * 2);
            c.stroke();
          }
          c.globalAlpha = p.used ? 0.15 : 0.32;
          c.fillStyle = p.mode.colour;
          c.beginPath(); c.ellipse(0, 0, RING_W / 2, RING_H / 2, 0, 0, Math.PI * 2); c.fill();
          c.restore();
          c.globalAlpha = 1;
        }
        return;
      }

      if (layer === 'hud' && active) {
        c.fillStyle = active.colour;
        c.font = '700 13px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(`${active.name}  ${Math.ceil(left)}s`, ctx.W / 2, 148);
        c.textAlign = 'left';
      }
    },
  };
}
