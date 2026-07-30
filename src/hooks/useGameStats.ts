import { useCallback, useMemo, useState } from 'react';
import { useEffect } from 'react';
import type { GameStats } from '../types/game';
import { supabase } from '../lib/supabase';

const KEY = 'skybound-flap-stats-v1';
const initial: GameStats = { best: 0, games: 0, total: 0, muted: false };
function read(): GameStats { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return initial; } }

export function useGameStats(userId?: string) {
  const [stats, setStats] = useState<GameStats>(read);
  const save = useCallback((next: GameStats) => { setStats(next); localStorage.setItem(KEY, JSON.stringify(next)); }, []);
  useEffect(() => { const client = supabase; if (!userId || !client) return; let active = true; client.from('player_stats').select('best,games,total,muted').eq('user_id', userId).maybeSingle().then(({ data, error }) => { if (!active || error) return; if (data) save(data); else void client.from('player_stats').insert({ user_id: userId, ...stats }); }); return () => { active = false; }; }, [userId, save]);
  const record = useCallback((score: number) => { const next = { ...stats, best: Math.max(stats.best, score), games: stats.games + 1, total: stats.total + score }; save(next); if (userId && supabase) void supabase.from('player_stats').upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }); }, [save, stats, userId]);
  const toggleMuted = useCallback(() => { const next = { ...stats, muted: !stats.muted }; save(next); if (userId && supabase) void supabase.from('player_stats').upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }); }, [save, stats, userId]);
  const average = useMemo(() => stats.games ? (stats.total / stats.games).toFixed(1) : '0', [stats]);
  return { stats, average, record, toggleMuted };
}
