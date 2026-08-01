import type { Mechanic, MechanicContext } from './types';
import { clamp, lerp, rand } from './geom';

/**
 * Level 6 — Cave Section.
 * Pipes stop and a winding tunnel scrolls through instead, for about ten
 * seconds. The corridor is never narrower than CORRIDOR px and its centre line
 * moves by a bounded amount per slice, so every cave is flyable. It opens and
 * closes with a wide funnel so entry and exit are never a surprise.
 */
const SLICE = 14;          // px per sampled column
const CORRIDOR = 168;      // guaranteed vertical opening

type Slice = { top: number; bottom: number };

export function createCave(): Mechanic {
  let slices: Slice[] = [];
  let offset = 0;
  let centre = 0;
  let drift = 0;
  let age = 0;

  const push = (ctx: MechanicContext) => {
    const floor = ctx.H - ctx.GROUND;
    const half = CORRIDOR / 2;
    // Wide mouth for the first and last stretch so entry/exit are forgiving.
    const edge = age < 1.6 || age > 8.4 ? 90 : 0;
    drift = clamp(drift + rand(-14, 14), -46, 46);
    centre = clamp(centre + drift * 0.06, half + 34, floor - half - 34);
    slices.push({ top: centre - half - edge, bottom: centre + half + edge });
  };

  return {
    name: 'Cave Section',
    unlockScore: 100,
    duration: 10,
    difficulty: 3,

    activate(ctx) {
      slices = []; offset = 0; age = 0; drift = 0;
      centre = clamp(ctx.bird.y, 220, ctx.H - ctx.GROUND - 220);
      ctx.pipes.forEach(p => { p.active = false; });   // hand the screen over
      ctx.banner('CAVE SECTION', 'Follow the tunnel');
      for (let i = 0; i < Math.ceil(ctx.W / SLICE) + 4; i++) push(ctx);
    },

    deactivate() { slices = []; },

    update(dt, ctx) {
      age += dt;
      ctx.suppressPipes = true;

      offset += ctx.scroll * dt;
      while (offset >= SLICE) { offset -= SLICE; slices.shift(); push(ctx); }

      // The bird sits at a fixed x, so one slice decides the collision.
      const index = Math.floor((ctx.BIRD_X + offset) / SLICE);
      const s = slices[index];
      if (s && (ctx.bird.y - ctx.R < s.top || ctx.bird.y + ctx.R > s.bottom)) ctx.kill();
    },

    render(c, ctx, layer) {
      if (layer === 'back') {
        c.fillStyle = '#2d3f52';
        c.fillRect(0, 0, ctx.W, ctx.H - ctx.GROUND);
        return;
      }
      if (layer !== 'mid') return;

      const floor = ctx.H - ctx.GROUND;
      const wall = (edge: 'top' | 'bottom') => {
        c.beginPath();
        c.moveTo(-SLICE * 2, edge === 'top' ? 0 : floor);
        slices.forEach((s, i) => {
          const x = i * SLICE - offset;
          c.lineTo(x, edge === 'top' ? s.top : s.bottom);
        });
        c.lineTo(ctx.W + SLICE * 2, edge === 'top' ? 0 : floor);
        c.closePath();
        c.fill();
      };

      const grad = c.createLinearGradient(0, 0, 0, floor);
      grad.addColorStop(0, '#6d5a4e');
      grad.addColorStop(0.5, '#54463d');
      grad.addColorStop(1, '#6d5a4e');
      c.fillStyle = grad;
      wall('top'); wall('bottom');

      c.strokeStyle = '#8d7663'; c.lineWidth = 4;
      for (const edge of ['top', 'bottom'] as const) {
        c.beginPath();
        slices.forEach((s, i) => {
          const x = i * SLICE - offset, y = edge === 'top' ? s.top : s.bottom;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.stroke();
      }

      // Glow along the corridor so the safe line reads at a glance.
      c.globalAlpha = 0.25; c.strokeStyle = '#ffe9b8'; c.lineWidth = 2;
      c.beginPath();
      slices.forEach((s, i) => {
        const x = i * SLICE - offset, y = lerp(s.top, s.bottom, 0.5);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.stroke();
      c.globalAlpha = 1;
    },
  };
}
