import { useCallback, useEffect, useState } from 'react';
import type { AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Supabase Auth requires RFC-valid email syntax even though the UI is username-only.
const usernameEmail = (username: string) => `${username.trim().toLowerCase()}@players.skyboundflap.com`;
export const isValidUsername = (value: string) => /^[a-zA-Z0-9_]{3,24}$/.test(value);
export const isConfigured = Boolean(supabase);

const GUEST_KEY = 'skybound-flap-guest-v1';

/** Supabase reports these in email terms; the UI is username-only, so restate them. */
function friendly(error: unknown): string {
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection and try again.';
  const auth = error as Partial<AuthError>;
  const code = auth?.code ?? '';
  const message = auth?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'No account matches that username and password.';
  if (code === 'user_already_exists' || /already registered/i.test(message)) return 'That username is already taken. Try another, or sign in.';
  if (code === 'email_address_invalid') return 'That username cannot be used. Please pick a different one.';
  if (code === 'weak_password') return 'Password must have at least 6 characters.';
  if (code === 'email_not_confirmed') return 'This account is not confirmed yet. Contact the site owner.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Wait a minute and try again.';
  if (code === 'signup_disabled') return 'New accounts are currently disabled.';
  return message || 'Something went wrong. Please try again.';
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setReady(true); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('Online accounts are not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
    if (error) throw new Error(friendly(error));
    setSession(data.session);
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('Online accounts are not configured.');
    const { data, error } = await supabase.auth.signUp({ email: usernameEmail(username), password, options: { data: { username: username.trim() } } });
    if (error) throw new Error(friendly(error));
    // A taken address comes back as a user with no identities rather than as an error.
    if (data.user && data.user.identities?.length === 0) throw new Error('That username is already taken. Try another, or sign in.');
    // If email confirmation is ever re-enabled Supabase returns no session, so sign in explicitly.
    if (data.session) setSession(data.session);
    else await signIn(username, password);
  }, [signIn]);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); setSession(null); }, []);
  const continueAsGuest = useCallback(() => { localStorage.setItem(GUEST_KEY, '1'); setGuest(true); }, []);

  const username = (session?.user.user_metadata?.username as string | undefined) ?? session?.user.email?.split('@')[0];
  return { session, username, ready, guest, signIn, signUp, signOut, continueAsGuest };
}
