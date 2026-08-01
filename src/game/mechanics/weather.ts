import type { Mechanic, MechanicContext } from './types';
import { pick, rand } from './geom';

/**
 * Level 7 — Weather Events.
 * One condition at a time. Every effect is mostly cosmetic; the gameplay part
 * is deliberately small and always announced, and visibility never drops far
 * enough to hide an obstacle before the player can react to it.
 */
export type Sky = 'Rain' | 'Snow' | 'Fog' | 'Night' | 'Sunset' | 'Storm';

const COPY: Record<Sky, string> = {
  Rain: 'Reduced visibility',
  Snow: 'Everything slows a little',
  Fog: 'Short sight lines',
  Night: 'Obstacles glow in the dark',
  Sunset: 'Just a beautiful sky',
  Storm: 'Watch for gusts',
};

type Drop = { x: number; y: number; v: number; len: number };

export function createWeather(forced?: Sky): Mechanic {
  let sky: Sky = 'Rain';
  let drops: Drop[] = [];
  let t = 0;
  let gust = 0;
  let gustNext = 0;

  return {
    name: 'Weather',
    unlockScore: 120,
    duration: 22,
    difficulty: 1,

    activate(ctx) {
      sky = forced ?? pick(['Rain', 'Snow', 'Fog', 'Night', 'Sunset', 'Storm'] as const);
      t = 0; gust = 0; gustNext = rand(2.5, 4.5);
      const count = sky === 'Rain' || sky === 'Storm' ? 90 : sky === 'Snow' ? 70 : 0;
      drops = Array.from({ length: count }, () => ({
        x: rand(0, ctx.W), y: rand(0, ctx.H), v: rand(0.7, 1.4), len: rand(9, 17),
      }));
      ctx.banner(sky.toUpperCase(), COPY[sky]);
    },

    deactivate() { drops = []; },

    update(dt, ctx) {
      t += dt;
      const fall = sky === 'Snow' ? 90 : 620;

      for (const d of drops) {
        d.y += fall * d.v * dt;
        d.x -= (sky === 'Snow' ? 20 : 90) * d.v * dt + (sky === 'Snow' ? Math.sin(t * 2 + d.y * 0.05) * 14 * dt : 0);
        if (d.y > ctx.H) { d.y = -12; d.x = rand(0, ctx.W); }
        if (d.x < -20) d.x = ctx.W + 10;
      }

      if (sky === 'Snow') ctx.speedMul *= 0.88;
      if (sky === 'Rain') ctx.visibility = Math.min(ctx.visibility, 0.82);
      if (sky === 'Fog') ctx.visibility = Math.min(ctx.visibility, 0.6);
      if (sky === 'Night') ctx.visibility = Math.min(ctx.visibility, 0.72);

      if (sky === 'Storm') {
        gustNext -= dt;
        if (gustNext <= 0) { gust = 1.1; gustNext = rand(3.5, 5.5); }
        if (gust > 0) {
          gust = Math.max(0, gust - dt);
          // Eased in and out, so a gust nudges rather than yanks.
          ctx.windY += Math.sin((1 - Math.abs(gust - 0.55) / 0.55) * Math.PI / 2) * -210;
        }
      }
    },

    render(c, ctx, layer) {
      const floor = ctx.H - ctx.GROUND;

      if (layer === 'back') {
        if (sky === 'Night') { c.fillStyle = 'rgba(16,26,48,.62)'; c.fillRect(0, 0, ctx.W, ctx.H); }
        if (sky === 'Sunset') {
          const g = c.createLinearGradient(0, 0, 0, floor);
          g.addColorStop(0, 'rgba(255,138,92,.42)'); g.addColorStop(1, 'rgba(255,206,120,.30)');
          c.fillStyle = g; c.fillRect(0, 0, ctx.W, ctx.H);
        }
        if (sky === 'Storm') { c.fillStyle = 'rgba(40,52,72,.40)'; c.fillRect(0, 0, ctx.W, ctx.H); }
        return;
      }

      if (layer !== 'front') return;

      if (sky === 'Rain' || sky === 'Storm') {
        c.strokeStyle = 'rgba(200,225,255,.55)'; c.lineWidth = 1.6;
        c.beginPath();
        for (const d of drops) { c.moveTo(d.x, d.y); c.lineTo(d.x - 4, d.y + d.len); }
        c.stroke();
      }
      if (sky === 'Snow') {
        c.fillStyle = 'rgba(255,255,255,.85)';
        for (const d of drops) { c.beginPath(); c.arc(d.x, d.y, 1.7 + d.v, 0, Math.PI * 2); c.fill(); }
      }
      if (sky === 'Fog') {
        for (let i = 0; i < 4; i++) {
          const y = ((t * 16 * (i + 1)) % (floor + 160)) - 80;
          c.fillStyle = `rgba(226,236,242,${0.16 + i * 0.03})`;
          c.beginPath(); c.ellipse(ctx.W / 2, y, ctx.W * 0.85, 54, 0, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = 'rgba(226,236,242,.24)'; c.fillRect(0, 0, ctx.W, floor);
      }
      if (sky === 'Night') {
        // Lantern around the bird; obstacles stay legible through the dark.
        const g = c.createRadialGradient(ctx.BIRD_X, ctx.bird.y, 20, ctx.BIRD_X, ctx.bird.y, 250);
        g.addColorStop(0, 'rgba(10,16,34,0)'); g.addColorStop(1, 'rgba(10,16,34,.60)');
        c.fillStyle = g; c.fillRect(0, 0, ctx.W, ctx.H);
      }
      if (sky === 'Storm' && Math.sin(t * 3.1) > 0.985) {
        c.fillStyle = 'rgba(255,255,255,.32)'; c.fillRect(0, 0, ctx.W, ctx.H);
      }
    },
  };
}
