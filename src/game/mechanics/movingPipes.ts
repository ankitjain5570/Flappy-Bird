import type { Mechanic, MechanicContext, PipeRef } from './types';
import { clamp, rand } from './geom';

/**
 * Level 3 — Moving Pipes.
 * Gaps drift vertically on a slow sine so the motion is always predictable and
 * readable. Travel is capped at 25% of screen height and the gap centre is
 * clamped inside the playable band, so a drifting pipe can never park its gap
 * against the ceiling or the ground.
 */
type Drift = { base: number; amp: number; phase: number; speed: number };

export function createMovingPipes(): Mechanic {
  const drift = new Map<PipeRef, Drift>();

  const band = (ctx: MechanicContext) => {
    const floor = ctx.H - ctx.GROUND;
    return { lo: 150, hi: floor - 150 };
  };

  return {
    name: 'Moving Pipes',
    unlockScore: 40,
    duration: 0,
    difficulty: 2,

    activate(ctx) { drift.clear(); ctx.banner('MOVING PIPES', 'Gaps drift up and down'); },
    deactivate() { drift.clear(); },

    update(dt, ctx) {
      const maxTravel = ctx.H * 0.25;
      const { lo, hi } = band(ctx);

      for (const pipe of ctx.pipes) {
        if (!pipe.active) { drift.delete(pipe); continue; }

        let d = drift.get(pipe);
        if (!d) {
          // Amplitude is limited both by the 25% rule and by how much room this
          // particular gap actually has, so the clamp below never has to bite.
          const room = Math.min(pipe.gapY - lo, hi - pipe.gapY);
          const amp = Math.max(0, Math.min(maxTravel / 2, room));
          d = { base: pipe.gapY, amp, phase: rand(0, Math.PI * 2), speed: rand(0.55, 0.95) };
          drift.set(pipe, d);
        }

        d.phase += dt * d.speed;
        pipe.gapY = clamp(d.base + Math.sin(d.phase) * d.amp, lo, hi);
      }
    },

    render(c, ctx, layer) {
      if (layer !== 'mid') return;
      // A faint track behind each moving gap tells the player it will move.
      c.strokeStyle = 'rgba(255,255,255,.34)';
      c.lineWidth = 2;
      c.setLineDash([5, 7]);
      for (const pipe of ctx.pipes) {
        const d = pipe.active && drift.get(pipe);
        if (!d || d.amp < 8) continue;
        c.beginPath();
        c.moveTo(pipe.x + 32, d.base - d.amp);
        c.lineTo(pipe.x + 32, d.base + d.amp);
        c.stroke();
      }
      c.setLineDash([]);
    },
  };
}
