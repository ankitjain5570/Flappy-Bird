import type { Mechanic, MechanicContext } from './types';
import { circleHitsSegment, clamp, rand } from './geom';

/**
 * Level 5 — Rotating Blades.
 * A slow two-armed rotor sits in the open space *between* pipe pairs, never
 * inside a gap. It fades in over a second before it can hurt you, rotates
 * slowly enough to read, and the spawner refuses to place a second blade while
 * one is still on screen.
 */
type Blade = { x: number; y: number; angle: number; speed: number; arm: number; warn: number };

const ARM_R = 7;

export function createBlades(): Mechanic {
  let blades: Blade[] = [];
  let next = 0;

  const clear = (ctx: MechanicContext, x: number) =>
    // Only spawn where no pipe is within a comfortable margin, so the blade and
    // a pipe gap can never demand the same pixel at the same time.
    ctx.pipes.every(p => !p.active || x + 60 < p.x - 70 || x - 60 > p.x + 134);

  return {
    name: 'Rotating Blades',
    unlockScore: 80,
    duration: 0,
    difficulty: 3,

    activate(ctx) { blades = []; next = 2.4; ctx.banner('ROTATING BLADES', 'Time your run through the arms'); },
    deactivate() { blades = []; },

    update(dt, ctx) {
      next -= dt;
      // "Never place two rotating blades together": one on screen at a time.
      if (next <= 0 && blades.length === 0) {
        const x = ctx.W + 70;
        if (clear(ctx, x)) {
          const arm = rand(46, 62);
          const y = clamp(rand(180, ctx.H - ctx.GROUND - 180), arm + 30, ctx.H - ctx.GROUND - arm - 30);
          blades.push({ x, y, angle: rand(0, Math.PI), speed: rand(1.0, 1.45) * (Math.random() < 0.5 ? -1 : 1), arm, warn: 1 });
          next = rand(3.4, 5);
        } else {
          next = 0.35;
        }
      }

      for (const b of blades) {
        b.x -= ctx.scroll * dt;
        b.angle += b.speed * dt;
        if (b.warn > 0) b.warn = Math.max(0, b.warn - dt);
        if (b.warn > 0) continue;                 // harmless while it fades in

        const tips = [b.angle, b.angle + Math.PI];
        for (const a of tips) {
          const x2 = b.x + Math.cos(a) * b.arm, y2 = b.y + Math.sin(a) * b.arm;
          if (circleHitsSegment(ctx.BIRD_X, ctx.bird.y, ctx.R, b.x, b.y, x2, y2)) { ctx.kill(); return; }
        }
      }
      blades = blades.filter(b => b.x > -90);
    },

    render(c, ctx, layer) {
      if (layer !== 'mid') return;
      for (const b of blades) {
        const alpha = 1 - b.warn;
        c.save();
        c.translate(b.x, b.y);
        if (b.warn > 0) {                          // telegraph ring
          c.globalAlpha = 0.35 + Math.sin(b.warn * 18) * 0.2;
          c.strokeStyle = '#ff5c5c'; c.lineWidth = 3;
          c.beginPath(); c.arc(0, 0, b.arm + 8, 0, Math.PI * 2); c.stroke();
        }
        c.globalAlpha = 0.25 + alpha * 0.75;
        c.rotate(b.angle);
        c.strokeStyle = '#4b5b6b'; c.lineCap = 'round'; c.lineWidth = ARM_R * 2;
        c.beginPath(); c.moveTo(-b.arm, 0); c.lineTo(b.arm, 0); c.stroke();
        c.strokeStyle = '#93a6b8'; c.lineWidth = ARM_R;
        c.beginPath(); c.moveTo(-b.arm, 0); c.lineTo(b.arm, 0); c.stroke();
        c.fillStyle = '#33414f';
        c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd15c';
        c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
        c.restore();
        c.globalAlpha = 1;
      }
    },
  };
}
