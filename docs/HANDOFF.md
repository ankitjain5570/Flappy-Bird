# Project handoff

## Purpose

Skybound Flap is an original, responsive Flappy-style browser game. React owns the surrounding interface; the HTML canvas owns simulation and rendering. There is no backend, no external assets, and no authentication.

## Running and shipping

- `npm install` installs dependencies.
- `npm run dev` starts the Vite development server.
- `npm run build` type-checks and emits a deployable static `dist/` bundle. Vercel can use the standard Vite preset (build command: `npm run build`, output: `dist`).

## Architecture

`src/components/GameCanvas.tsx` bridges React and the imperative game engine. It only creates, resizes, starts, and destroys `GameEngine`.

`src/game/GameEngine.ts` is the simulation owner: requestAnimationFrame, state transitions, delta-time physics, rendering, collision, scoring, particle effects, and pipe pooling. Its public API is deliberately small: `start`, `flap`, `pause`, `resume`, `restart`, `setMuted`, `resize`, and `destroy`.

`src/components/GameShell.tsx` owns UI overlays and receives engine events. `src/hooks/useGameStats.ts` isolates localStorage schema and achievement calculations. `src/game/audio.ts` contains synthesized Web Audio effects; it intentionally creates no binary sound assets.

## Game states and flow

`home → playing → gameOver`; pause may be entered only from playing. A new play session is begun by `start()` or `restart()`. A 3-second non-blocking countdown runs before gameplay. Press Space/click/tap when playing to flap. P or Escape toggles pause.

## Persistence

The `skybound-flap-stats-v1` localStorage key stores `{ best, games, total, muted }`. Keep migrations backward-compatible if this shape changes. Data is device-local; clearing site storage clears it.

For authenticated players, the same fields are also stored in Supabase `public.player_stats`, keyed by `auth.users.id`. The schema and row-level-security policies live in `supabase/migrations/20260730_player_stats.sql`: players can only read/write their own row. The browser only receives the Supabase publishable key; never commit `.env` or a Supabase access/service-role token. Username-only login is implemented with a private valid-format email (`<username>@players.skyboundflap.com`) passed to Supabase Auth. Disable Auth email confirmation in the Supabase dashboard, otherwise new accounts cannot complete this username-only flow.

## Gameplay tuning

All base measurements are defined near the top of `GameEngine.ts`. The canvas design resolution is 420×720 and it is uniformly scaled to its container. Physics is delta-time based; the flap impulse is currently -344 units/second (20% gentler than the original -430 tuning). Difficulty changes every 10 points: pipes move faster, spawn sooner, and gaps narrow. Pipes are recycled through a small pool instead of newly allocated every frame.

## Adding features safely

- Add simulation features to `GameEngine`, not React render state.
- Add UI controls/overlays to `GameShell`; pass commands through its `engineRef`.
- Render any new gameplay visuals in the engine so they stay synchronized with the loop.
- Do not allocate arrays or object literals in the hot render/update paths without a measured reason.
- Keep input accessible: interactive controls require labels; canvas click handling must remain paired with keyboard support.

## Manual QA checklist

Check Space, mouse, and touch input; pausing/resuming; collision with pipe/ceiling/ground; score increment; best-score persistence after reload; mute persistence; narrow and wide layouts; and a production build. The canvas uses device-pixel-ratio backing pixels for crisp high-DPI rendering.
