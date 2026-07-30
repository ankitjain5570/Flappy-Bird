import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import type { EngineEvents } from '../types/game';

export const GameCanvas = forwardRef<GameEngine, { events: EngineEvents; muted: boolean; interactive?: boolean }>(({ events, muted, interactive = true }, ref) => {
  const canvas = useRef<HTMLCanvasElement>(null); const engine = useRef<GameEngine | null>(null); const [instance, setInstance] = useState<GameEngine | null>(null);
  useImperativeHandle(ref, () => instance!, [instance]);
  useEffect(() => { const next = new GameEngine(canvas.current!, events, muted); engine.current = next; setInstance(next); const resize = () => next.resize(); window.addEventListener('resize', resize); return () => { window.removeEventListener('resize', resize); next.destroy(); if (engine.current === next) { engine.current = null; setInstance(null); } }; }, [events]);
  useEffect(() => { engine.current?.setMuted(muted); }, [muted]);
  return <canvas ref={canvas} className="game-canvas" aria-label="Skybound Flap game area" onPointerDown={() => { if (interactive) engine.current?.flap(); }} />;
});
