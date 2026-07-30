import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { GameCanvas } from './GameCanvas';
import { useGameStats } from '../hooks/useGameStats';
import type { GameEngine } from '../game/GameEngine';
import type { GameSnapshot } from '../types/game';
import { AuthPanel } from './AuthPanel';
import { useAuth } from '../hooks/useAuth';

export function GameShell() {
  const engine = useRef<GameEngine>(null);
  const { session, username, ready, guest, signIn, signOut, signUp, continueAsGuest } = useAuth();
  const { stats, average, record, toggleMuted } = useGameStats(session?.user.id);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ state: 'home', score: 0, countdown: 0 });
  const [lastScore, setLastScore] = useState(0);
  const [showAuth, setShowAuth] = useState(false);

  const events = useRef({ onSnapshot: setSnapshot, onScore: () => undefined, onGameOver: (score: number) => { setLastScore(score); record(score); } }).current;
  // Keep event callbacks current without rebuilding the engine.
  events.onGameOver = (score) => { setLastScore(score); record(score); };

  // Everyone chooses an account or guest play before the first flight.
  const gated = ready && !session && !guest;
  // The gate and the account panel both sit above the canvas, so input must pause with them.
  const blocked = gated || showAuth || !ready;

  const action = useCallback(() => engine.current?.start(), []);

  useEffect(() => {
    if (blocked) return;
    const key = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); engine.current?.flap(); }
      if (event.code === 'KeyP' || event.code === 'Escape') engine.current?.togglePause();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [blocked]);

  // Pause an in-flight game if the account panel opens over it.
  useEffect(() => { if (showAuth && snapshot.state === 'playing') engine.current?.togglePause(); }, [showAuth, snapshot.state]);

  const playing = snapshot.state === 'playing';

  return <main className="app"><section className="game-frame">
    <GameCanvas ref={engine} events={events} muted={stats.muted} interactive={!blocked} />
    <div className="hud">
      <button aria-label={stats.muted ? 'Enable sound' : 'Mute sound'} onClick={toggleMuted}>{stats.muted ? <VolumeX /> : <Volume2 />}</button>
      <output aria-live="polite">{snapshot.score}</output>
      <button aria-label={playing ? 'Pause game' : 'Resume game'} onClick={() => engine.current?.togglePause()}>{playing ? <Pause /> : <Play />}</button>
    </div>

    {snapshot.state === 'home' && <div className="overlay home">
      <p className="eyebrow">AN ORIGINAL ARCADE FLIGHT</p>
      <h1>Skybound<br /><i>Flap</i></h1>
      <p className="instruction">Space · Click · Tap to fly</p>
      <button className="primary" onClick={action}><Play fill="currentColor" /> Start flight</button>
      {session
        ? <button className="text-button account" onClick={() => void signOut()}>Signed in as {username ?? 'player'} · Sign out</button>
        : <button className="text-button account" onClick={() => setShowAuth(true)}>Playing as guest · Sign in to sync scores</button>}
      <p className="best">Best flight: <strong>{stats.best}</strong></p>
    </div>}

    {snapshot.state === 'countdown' && <div className="countdown" aria-live="assertive">{Math.ceil(snapshot.countdown)}</div>}

    {snapshot.state === 'paused' && <div className="overlay compact">
      <h2>Paused</h2><p>Take a breath. The sky will wait.</p>
      <button className="primary" onClick={() => engine.current?.resume()}><Play fill="currentColor" /> Continue</button>
    </div>}

    {snapshot.state === 'gameOver' && <div className="overlay compact">
      <p className="eyebrow">FLIGHT COMPLETE</p><h2>Nice try!</h2>
      <div className="results"><span>Score <b>{lastScore}</b></span><span>Best <b>{stats.best}</b></span><span>Flights <b>{stats.games}</b></span><span>Average <b>{average}</b></span></div>
      <button className="primary" onClick={() => engine.current?.restart()}><RotateCcw /> Fly again</button>
    </div>}

    {!ready && <div className="overlay compact"><h2>Loading…</h2></div>}
    {gated && <AuthPanel signIn={signIn} signUp={signUp} continueAsGuest={continueAsGuest} />}
    {showAuth && <AuthPanel signIn={signIn} signUp={signUp} close={() => setShowAuth(false)} />}
  </section>
  <p className="footer">P / Esc pauses · {session ? 'Your scores sync to your account' : 'Your best score stays on this device'}</p>
  </main>;
}
