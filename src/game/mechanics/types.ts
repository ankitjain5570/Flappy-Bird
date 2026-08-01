/**
 * Contract every progression mechanic implements.
 *
 * Mechanics never touch the engine directly. They read the world through a
 * MechanicContext, write per-frame modifiers onto it, and ask for outcomes
 * (kill, coin, banner) through its services. That keeps flight physics,
 * collision, scoring and rendering of the base game owned by GameEngine.
 */

export type Layer = 'back' | 'mid' | 'front' | 'hud';

/** The engine's pooled pipe, as mechanics are allowed to see it. */
export interface PipeRef { x: number; gapY: number; gap: number; counted: boolean; active: boolean }

export interface MechanicContext {
  /** Design-resolution constants; the canvas is uniformly scaled to these. */
  readonly W: number; readonly H: number; readonly GROUND: number; readonly BIRD_X: number; readonly R: number;
  readonly score: number;
  /** Seconds since this run began. */
  readonly elapsed: number;
  readonly bird: { y: number; velocity: number; rotation: number };
  readonly pipes: PipeRef[];
  /** Pixels/second the world is scrolling this frame, after modifiers. */
  readonly scroll: number;

  // ---- per-frame modifiers, reset to defaults by the director each tick ----
  /** World scroll multiplier. 1 = untouched. */
  speedMul: number;
  /** Gravity multiplier applied to the bird. 1 = untouched. */
  gravityMul: number;
  /** Extra vertical acceleration, px/s². Negative lifts. */
  windY: number;
  /** 1 = clear, lower dims and obscures the playfield. */
  visibility: number;
  /** Suppresses normal pipe spawning (the cave owns the screen). */
  suppressPipes: boolean;

  // ---- services ----
  /** Report that the bird hit this mechanic's hazard. Shields are applied by the engine. */
  kill(): void;
  shake(amount: number): void;
  burst(x: number, y: number, color: string, count?: number): void;
  /** Award one coin toward cosmetic unlocks. */
  coin(): void;
  /** Announce a mechanic on screen before it can affect play. */
  banner(title: string, sub?: string): void;
  sound(kind: 'coin' | 'power' | 'warn' | 'portal'): void;
  /** True while a powerup is pulling coins toward the bird. */
  magnet: boolean;
}

/** The director's writable view of the context. Mechanics only ever see the readonly form. */
export type MutableContext = { -readonly [K in keyof MechanicContext]: MechanicContext[K] };

export interface Mechanic {
  readonly name: string;
  /** Score at which the difficulty manager may first enable this. */
  readonly unlockScore: number;
  /** Seconds a single activation lasts. 0 = stays on until the director stops it. */
  readonly duration: number;
  /** 1–5. The director keeps the combined difficulty of active mechanics fair. */
  readonly difficulty: number;
  activate(ctx: MechanicContext): void;
  update(dt: number, ctx: MechanicContext): void;
  deactivate(ctx: MechanicContext): void;
  render(c: CanvasRenderingContext2D, ctx: MechanicContext, layer: Layer): void;
}

/** Mechanics that cannot sensibly run at the same time. */
export const INCOMPATIBLE: [string, string][] = [
  ['Cave Section', 'Moving Pipes'],
  ['Cave Section', 'Rotating Blades'],
  ['Cave Section', 'Laser Gates'],
  ['Cave Section', 'Coins'],
  ['Cave Section', 'Wind Zones'],
  ['Cave Section', 'Gravity Portals'],
  ['Laser Gates', 'Rotating Blades'],
];

export const conflicts = (a: string, b: string) =>
  INCOMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
