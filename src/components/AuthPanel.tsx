import { useState } from 'react';
import { LogIn, UserPlus, X } from 'lucide-react';
import { isValidUsername } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface Props {
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  /** Omitted when the panel is the entry gate, which has nothing to close back to. */
  close?: () => void;
  /** Offered only on the entry gate. */
  continueAsGuest?: () => void;
}

export function AuthPanel({ signIn, signUp, close, continueAsGuest }: Props) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [field, setField] = useState<'username' | 'password' | 'form'>('form');
  const [busy, setBusy] = useState(false);

  const fail = (where: 'username' | 'password' | 'form', message: string) => { setField(where); setError(message); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setField('form');
    if (!isValidUsername(username)) return fail('username', 'Use 3–24 letters, numbers, or underscores.');
    if (password.length < 6) return fail('password', 'Password must have at least 6 characters.');
    setBusy(true);
    try {
      await (mode === 'signIn' ? signIn(username, password) : signUp(username, password));
      close?.();
    } catch (reason) {
      fail('form', reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const swap = () => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(''); setField('form'); };
  const problem = (where: 'username' | 'password' | 'form') =>
    error && field === where ? <p className="form-error" role="alert">{error}</p> : null;

  return (
    <div className="overlay auth">
      {close && <button type="button" className="close" onClick={close} aria-label="Close account panel"><X /></button>}
      <p className="eyebrow">PLAYER ACCOUNT</p>
      <h2>{mode === 'signIn' ? 'Welcome back' : 'Join the flight'}</h2>
      <p className="auth-copy">
        {mode === 'signIn'
          ? 'Sign in to sync your scores across devices.'
          : 'Pick a username and password. No email needed.'}
      </p>

      {!supabase && <p className="form-error" role="alert">Online accounts are not configured for this site, so only guest play is available.</p>}

      <form onSubmit={submit}>
        <label>Username
          <input autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} disabled={!supabase} required />
        </label>
        {problem('username')}
        <label>Password
          <input type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} disabled={!supabase} required />
        </label>
        {problem('password')}
        {problem('form')}
        <button type="submit" className="primary" disabled={busy || !supabase}>
          {mode === 'signIn' ? <LogIn /> : <UserPlus />}
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button type="button" className="text-button" onClick={swap} disabled={busy || !supabase}>
        {mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
      {continueAsGuest && (
        <button type="button" className="text-button guest" onClick={continueAsGuest} disabled={busy}>
          Skip for now and play as guest
        </button>
      )}
    </div>
  );
}
