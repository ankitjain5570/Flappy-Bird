import type { Mechanic, MechanicContext } from './types';
import { circleHitsRect, clamp, rand } from './geom';

/**
 * Level 9 — Laser Gates.
 * Emitters fire a horizontal beam that only ever covers part of the column: a
 * SAFE-px corridor is always left open, so a gate can be flown at any time.
 * Every beam charges for WARN seconds first, drawn as a dashed telegraph, and
 * the beam is harmless until it is fully lit.
 */
const WARN = 1.15, LIT = 1.05, CYCLE = 3.1, SAFE = 190, EMITTER = 16;

type Gate = { x: number; gapY: number; phase: number };

export function createLasers(): Mechanic {
  let gates: Gate[] = [];
  let next = 0;

  const clearOfPipes = (ctx: MechanicContext, x: number) =>
    ctx.pipes.every(p => !p.active || x + 30 < p.x - 60 || x - 30 > p.x + 124);

  return {
    name: 'Laser Gates',
    unlockScore: 160,
    duration: 0,
    difficulty: 3,

    activate(ctx) { gates = []; next = 2.2; ctx.banner('LASER GATES', 'Wait for the beam to drop'); },
    deactivate() { gates = []; },

    update(dt, ctx) {
      next -= dt;
      if (next <= 0 && gates.length < 2) {
        const x = ctx.W + 40;
        if (clearOfPipes(ctx, x)) {
          const gapY = clamp(rand(200, ctx.H - ctx.GROUND - 200), SAFE / 2 + 30, ctx.H - ctx.GROUND - SAFE / 2 - 30);
          gates.push({ x, gapY, phase: rand(0, CYCLE) });
          next = rand(3.2, 4.6);
        } else next = 0.3;
      }

      const floor = ctx.H - ctx.GROUND;
      for (const g of gates) {
        g.x -= ctx.scroll * dt;
        g.phase = (g.phase + dt) % CYCLE;
        if (g.phase < WARN || g.phase > WARN + LIT) continue;   // charging or off

        const top = g.gapY - SAFE / 2, bottom = g.gapY + SAFE / 2;
        const hit =
          circleHitsRect(ctx.BIRD_X, ctx.bird.y, ctx.R, g.x - 5, 0, 10, top) ||
          circleHitsRect(ctx.BIRD_X, ctx.bird.y, ctx.R, g.x - 5, bottom, 10, floor - bottom);
        if (hit) { ctx.kill(); return; }
      }
      gates = gates.filter(g => g.x > -40);
    },

    render(c, ctx, layer) {
      if (layer !== 'mid') return;
      const floor = ctx.H - ctx.GROUND;

      for (const g of gates) {
        const top = g.gapY - SAFE / 2, bottom = g.gapY + SAFE / 2;
        const charging = g.phase < WARN;
        const lit = g.phase >= WARN && g.phase <= WARN + LIT;

        for (const [y, h] of [[0, top], [bottom, floor - bottom]] as const) {
          if (charging) {
            c.strokeStyle = `rgba(255,90,90,${0.35 + Math.sin(g.phase * 22) * 0.3})`;
            c.lineWidth = 3; c.setLineDash([7, 9]);
            c.beginPath(); c.moveTo(g.x, y); c.lineTo(g.x, y + h); c.stroke();
            c.setLineDash([]);
          } else if (lit) {
            const fade = Math.min(1, (g.phase - WARN) * 8);
            c.globalAlpha = fade;
            c.fillStyle = 'rgba(255,60,60,.30)'; c.fillRect(g.x - 9, y, 18, h);
            c.fillStyle = '#ff4b4b'; c.fillRect(g.x - 3.5, y, 7, h);
            c.fillStyle = '#fff3f3'; c.fillRect(g.x - 1.5, y, 3, h);
            c.globalAlpha = 1;
          }
        }

        // Emitter heads read as machinery whether or not the beam is on.
        c.fillStyle = lit ? '#ff6a6a' : '#5a6b7c';
        for (const y of [0, top - EMITTER, bottom, floor - EMITTER]) {
          if (y === 0 || y === floor - EMITTER) continue;
          c.beginPath(); c.roundRect(g.x - 13, y, 26, EMITTER, 4); c.fill();
        }
        c.fillStyle = '#3f4d5b';
        c.beginPath(); c.roundRect(g.x - 13, 0, 26, 12, 3); c.fill();
        c.beginPath(); c.roundRect(g.x - 13, floor - 12, 26, 12, 3); c.fill();
      }
    },
  };
}
