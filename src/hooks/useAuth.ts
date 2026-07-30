import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const usernameEmail = (username: string) => `${username.trim().toLowerCase()}@players.skyboundflap.local`;
export const isValidUsername = (value: string) => /^[a-zA-Z0-9_]{3,24}$/.test(value);

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(!supabase);
  useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => data.subscription.unsubscribe(); }, []);
  const signIn = async (username: string, password: string) => { if (!supabase) throw new Error('Online accounts are not configured.'); const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password }); if (error) throw error; };
  const signUp = async (username: string, password: string) => { if (!supabase) throw new Error('Online accounts are not configured.'); const { error } = await supabase.auth.signUp({ email: usernameEmail(username), password, options: { data: { username: username.trim() } } }); if (error) throw error; };
  const signOut = async () => { await supabase?.auth.signOut(); };
  return { session, ready, signIn, signUp, signOut };
}
