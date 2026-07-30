import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Vite inlines these at build time, so a deploy missing them silently ships an app
// that can never sign anyone in. Make that loud rather than mysterious.
if (!url || !key) console.error('[auth] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY at build time. Online accounts are disabled.');

export const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;
