import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameStats } from '../types/game';
import { supabase } from '../lib/supabase';

const KEY = 'skybound-flap-stats-v1';
const initial: GameStats = { best: 0, games: 0, total: 0, muted: false };
function read(): GameStats { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return initial; } }

/** Signing in must not discard guest progress from this device, so keep the better of the two. */
const merge = (local: GameStats, remote: GameStats): GameStats => ({
  best: Math.max(local.best, remote.best),
  games: Math.max(local.games, remote.games),
  total: Math.max(local.total, remote.total),
  muted: remote.muted,
});

export function useGameStats(userId?: string) {
  const [stats, setStats] = useState<GameStats>(read);
  // Callbacks read through this so they never capture a stale snapshot.
  const latest = useRef(stats); latest.current = stats;

  const save = useCallback((next: GameStats) => { setStats(next); localStorage.setItem(KEY, JSON.stringify(next)); }, []);

  const push = useCallback((next: GameStats, id?: string) => {
    if (!id || !supabase) return;
    void supabase.from('player_stats').upsert({ user_id: id, ...next, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('[stats] sync failed:', error.message); });
  }, []);

  // On sign-in, reconcile this device's stats with the account's stored row.
  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    void supabase.from('player_stats').select('best,games,total,muted').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { console.error('[stats] load failed:', error.message); return; }
        const next = data ? merge(latest.current, data as GameStats) : latest.current;
        save(next);
        push(next, userId);
      });
    return () => { active = false; };
  }, [userId, save, push]);

  const record = useCallback((score: number) => {
    const current = latest.current;
    const next = { ...current, best: Math.max(current.best, score), games: current.games + 1, total: current.total + score };
    save(next); push(next, userId);
  }, [save, push, userId]);

  const toggleMuted = useCallback(() => {
    const next = { ...latest.current, muted: !latest.current.muted };
    save(next); push(next, userId);
  }, [save, push, userId]);

  const average = useMemo(() => stats.games ? (stats.total / stats.games).toFixed(1) : '0', [stats]);
  return { stats, average, record, toggleMuted };
}
