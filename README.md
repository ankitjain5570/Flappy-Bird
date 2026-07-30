# Skybound Flap

An original, canvas-rendered arcade flight game built with React, TypeScript, and Vite. It uses no copied game assets or network services.

## Start

```bash
npm install
npm run dev
```

Build a production bundle with `npm run build`.

## Documentation

Read [docs/HANDOFF.md](docs/HANDOFF.md) first. It explains the game loop, architecture, controls, persistence, and safe extension points for future developers or AI agents.

## Optional online player accounts

Copy `.env.example` to `.env` and add the Supabase URL and publishable key. Apply `supabase/migrations/20260730_player_stats.sql` to the linked Supabase project. The game supports guest play by default; signed-in players sync their scores. Account names accept 3–24 letters, numbers, or underscores. In Supabase Auth, turn off **Confirm email** because the app uses a private valid-format email internally to support username-only sign-in.

## Controls

Press `Space`, click/tap the play area, or use the on-screen action. `P` / Escape pauses. Scores and audio preference are stored locally in the browser.
