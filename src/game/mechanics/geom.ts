/** Collision and easing helpers shared by the mechanic modules. */

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export const circleHitsCircle = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) => {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy < r * r;
};

export const circleHitsRect = (cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) => {
  const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
};

/** Circle against a line segment — used for blade arms. */
export const circleHitsSegment = (cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? clamp(((cx - x1) * dx + (cy - y1) * dy) / len, 0, 1) : 0;
  const px = x1 + dx * t, py = y1 + dy * t;
  const ox = cx - px, oy = cy - py;
  return ox * ox + oy * oy < r * r;
};

/** Smooth 0→1→0 pulse, for warnings and fades. */
export const pulse = (t: number) => 0.5 - Math.cos(Math.min(1, Math.max(0, t)) * Math.PI * 2) * 0.5;
