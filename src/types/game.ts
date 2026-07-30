export type GameState = 'home' | 'countdown' | 'playing' | 'paused' | 'gameOver';

export interface GameStats { best: number; games: number; total: number; muted: boolean }
export interface GameSnapshot { state: GameState; score: number; countdown: number }
export interface EngineEvents { onSnapshot: (snapshot: GameSnapshot) => void; onGameOver: (score: number) => void; onScore: (score: number) => void }
