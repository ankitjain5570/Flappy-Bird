import type { Mechanic, MechanicContext } from './types';
import { circleHitsCircle, clamp, rand } from './geom';

/**
 * Level 4 — Coins.
 * Coins ride inside a pipe gap, offset toward one edge so collecting them is a
 * deliberate risk, but always at least a bird-radius clear of the pipe mouth —
 * a coin is never bait for an unavoidable hit, and never sits in the safe line
 * the player would fly anyway.
 */
type Coin = { x: number; y: number; spin: number; taken: number };

const COIN_R = 11;

export function createCoins(): Mechanic {
  let coins: Coin[] = [];
  let armed = new WeakSet<object>();

  return {
    name: 'Coins',
    unlockScore: 60,
    duration: 0,
    difficulty: 1,

    activate(ctx) { coins = []; armed = new WeakSet(); ctx.banner('COINS', 'Collect to unlock new looks'); },
    deactivate() { coins = []; },

    update(dt, ctx) {
      // Attach a coin to each newly spawned pipe, once.
      for (const pipe of ctx.pipes) {
        if (!pipe.active || pipe.x < ctx.W || armed.has(pipe)) continue;
        armed.add(pipe);
        if (Math.random() < 0.45) continue;
        // Keep the coin inside the gap with clearance for the bird on both sides.
        const room = Math.max(0, pipe.gap / 2 - COIN_R - ctx.R - 6);
        const offset = room * (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 1);
        coins.push({ x: pipe.x + 32, y: pipe.gapY + offset, spin: rand(0, Math.PI * 2), taken: 0 });
      }

      for (const coin of coins) {
        if (coin.taken) { coin.taken += dt * 3; coin.y -= dt * 90; continue; }
        coin.x -= ctx.scroll * dt;
        coin.spin += dt * 3.4;

        if (ctx.magnet) {
          const dx = ctx.BIRD_X - coin.x, dy = ctx.bird.y - coin.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 190) { coin.x += (dx / dist) * 330 * dt; coin.y += (dy / dist) * 330 * dt; }
        }

        if (circleHitsCircle(ctx.BIRD_X, ctx.bird.y, ctx.R, coin.x, coin.y, COIN_R)) {
          coin.taken = 0.001;
          ctx.coin();
          ctx.sound('coin');
          ctx.burst(coin.x, coin.y, '#ffd94a', 7);
        }
      }
      coins = coins.filter(c => c.x > -30 && c.taken < 1);
    },

    render(c, ctx, layer) {
      if (layer !== 'mid') return;
      for (const coin of coins) {
        const squash = Math.abs(Math.cos(coin.spin));
        c.save();
        c.globalAlpha = coin.taken ? clamp(1 - coin.taken, 0, 1) : 1;
        c.translate(coin.x, coin.y);
        c.fillStyle = '#f2b528';
        c.beginPath(); c.ellipse(0, 0, COIN_R * Math.max(0.18, squash), COIN_R, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe071';
        c.beginPath(); c.ellipse(0, 0, COIN_R * 0.62 * Math.max(0.18, squash), COIN_R * 0.62, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    },
  };
}
