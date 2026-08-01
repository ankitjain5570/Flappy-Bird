import type { Layer, Mechanic, MechanicContext } from './types';
import { rand } from './geom';

type Zone = { x: number; w: number; dir: -1 | 1; motes: { x: number; y: number; s: number }[] };

/**
 * Level 2 — Wind Zones.
 * Bands of moving air scroll in from the right, so the player always sees one
 * coming before it can push them. Blue lifts, orange presses down. The force is
 * a quarter of gravity: enough to feel, never enough to make a gap unreachable.
 */
const FORCE = 285;

export function createWind(): Mechanic {
  let zones: Zone[] = [];
  let next = 0;

  const spawn = (ctx: MechanicContext) => {
    const w = rand(150, 240);
    const dir: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
    const motes = Array.from({ length: 26 }, () => ({ x: rand(0, w), y: rand(30, ctx.H - ctx.GROUND - 30), s: rand(0.5, 1.3) }));
    zones.push({ x: ctx.W + 40, w, dir, motes });
  };

  return {
    name: 'Wind Zones',
    unlockScore: 20,
    duration: 0,
    difficulty: 1,

    activate(ctx) { zones = []; next = 1.6; ctx.banner('WIND ZONES', 'Blue lifts · Orange pushes down'); },
    deactivate() { zones = []; },

    update(dt, ctx) {
      next -= dt;
      if (next <= 0) { spawn(ctx); next = rand(2.4, 4.2); }

      for (const z of zones) {
        z.x -= ctx.scroll * dt;
        for (const m of z.motes) {
          m.y += z.dir * 46 * m.s * dt * 3;
          if (m.y < 20) m.y = ctx.H - ctx.GROUND - 20;
          if (m.y > ctx.H - ctx.GROUND - 20) m.y = 20;
        }
      }
      zones = zones.filter(z => z.x + z.w > -20);

      const inside = zones.find(z => ctx.BIRD_X > z.x && ctx.BIRD_X < z.x + z.w);
      if (inside) ctx.windY += inside.dir * FORCE;
    },

    render(c, ctx, layer: Layer) {
      if (layer !== 'mid') return;
      for (const z of zones) {
        const up = z.dir < 0;
        const grad = c.createLinearGradient(z.x, 0, z.x + z.w, 0);
        const body = up ? '90,180,255' : '255,150,70';
        grad.addColorStop(0, `rgba(${body},0)`);
        grad.addColorStop(0.5, `rgba(${body},.20)`);
        grad.addColorStop(1, `rgba(${body},0)`);
        c.fillStyle = grad;
        c.fillRect(z.x, 0, z.w, ctx.H - ctx.GROUND);

        c.strokeStyle = up ? 'rgba(120,200,255,.85)' : 'rgba(255,168,90,.85)';
        c.lineWidth = 2;
        for (const m of z.motes) {
          const x = z.x + m.x;
          if (x < -10 || x > ctx.W + 10) continue;
          c.globalAlpha = 0.5 + m.s * 0.35;
          c.beginPath();
          c.moveTo(x, m.y);
          c.lineTo(x, m.y + z.dir * 13 * m.s);
          c.stroke();
          // arrowhead points the way the wind pushes
          c.beginPath();
          c.moveTo(x - 3.5, m.y + z.dir * 9 * m.s);
          c.lineTo(x, m.y + z.dir * 15 * m.s);
          c.lineTo(x + 3.5, m.y + z.dir * 9 * m.s);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
    },
  };
}
