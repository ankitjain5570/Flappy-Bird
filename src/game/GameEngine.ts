import { GameAudio } from './audio';
import { Director } from './Director';
import type { EngineEvents, GameSnapshot, GameState } from '../types/game';

const W = 420, H = 720, GROUND = 92, BIRD_X = 120, R = 17;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
type Pipe = { x: number; gapY: number; gap: number; counted: boolean; active: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export class GameEngine {
  private ctx: CanvasRenderingContext2D; private state: GameState = 'home'; private score = 0; private countdown = 0;
  private bird = { y: H / 2, velocity: 0, rotation: 0, wing: 0 };
  private pipes: Pipe[] = Array.from({ length: 5 }, () => ({ x: 0, gapY: 0, gap: 0, counted: false, active: false }));
  private particles: Particle[] = []; private last = 0; private frame = 0; private spawn = 0; private cloudOffset = 0; private groundOffset = 0; private shake = 0;
  private animation = 0; private countdownTimer = 0; private scale = 1; private audio: GameAudio;
  private director: Director;
  constructor(private canvas: HTMLCanvasElement, private events: EngineEvents, muted: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.audio = new GameAudio(muted);
    this.director = new Director({ W, H, GROUND, BIRD_X, R }, {
      burst: (x, y, color, n) => this.burst(x, y, color, n),
      shake: v => { this.shake = Math.max(this.shake, v); },
      sound: kind => this.audio[kind](),
    });
    this.director.reset(this.pipes);
    this.resize();
    this.loop(0);
  }
  resize() { const rect = this.canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr; this.scale = Math.min(rect.width / W, rect.height / H); this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, (rect.width * dpr - W * dpr * this.scale) / 2, (rect.height * dpr - H * dpr * this.scale) / 2); }
  setMuted(value: boolean) { this.audio.setMuted(value); }
  start() { if (this.state === 'home' || this.state === 'gameOver') { this.reset(); this.state = 'countdown'; this.countdown = 3; window.clearTimeout(this.countdownTimer); this.countdownTimer = window.setTimeout(() => { if (this.state === 'countdown') { this.state = 'playing'; this.countdown = 0; this.emit(); } }, 3000); this.emit(); } }
  restart() { this.start(); }
  flap() { if (this.state === 'home' || this.state === 'gameOver') return this.start(); if (this.state !== 'playing') return; this.bird.velocity = -344; this.bird.rotation = -.42; this.audio.flap(); }
  pause() { if (this.state === 'playing') { this.state = 'paused'; this.emit(); } }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.emit(); } }
  togglePause() { this.state === 'playing' ? this.pause() : this.resume(); }
  destroy() { cancelAnimationFrame(this.animation); window.clearTimeout(this.countdownTimer); }
  /** Dev-only hooks for the verification harness. Stripped from production builds. */
  debugJump(score: number) { if (!import.meta.env.DEV) return; this.score = score; this.emit(); }
  debugInfo() { return { ...this.director.debugState(), score: this.score, state: this.state, y: Math.round(this.bird.y) }; }
  private reset() { this.score = 0; this.spawn = 0; this.particles = []; this.bird = { y: H / 2, velocity: 0, rotation: 0, wing: 0 }; this.pipes.forEach(p => p.active = false); this.director.reset(this.pipes); }
  private emit() { const snapshot: GameSnapshot = { state: this.state, score: this.score, countdown: this.countdown }; this.events.onSnapshot(snapshot); }
  private loop = (time: number) => { const dt = Math.min((time - this.last) / 1000 || 0, .035); this.last = time; this.update(dt); this.draw(); this.animation = requestAnimationFrame(this.loop); };
  private update(dt: number) {
    this.cloudOffset = (this.cloudOffset + dt * 8) % W; this.groundOffset = (this.groundOffset + dt * (this.state === 'playing' ? 125 : 28)) % 36;
    if (this.shake) this.shake = Math.max(0, this.shake - dt);
    this.bird.wing += dt * (this.state === 'playing' ? 17 : 5);
    this.particles = this.particles.filter(p => (p.life -= dt) > 0); for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 480 * dt; }
    if (this.state === 'countdown') { this.countdown = Math.max(0, this.countdown - dt); this.emit(); return; }
    if (this.state !== 'playing') return;
    // The base ramp is capped: past this point difficulty comes from mechanics,
    // not from speed the player cannot react to.
    const level = Math.min(Math.floor(this.score / 10), 12);
    const speed = 145 + level * 10; const gap = Math.max(128, 178 - level * 5);

    const mod = this.director.tick(dt, this.score, this.bird, speed);
    const flow = speed * mod.speedMul;

    this.bird.velocity += (1120 * mod.gravityMul + mod.windY) * dt;
    this.bird.y += this.bird.velocity * dt; this.bird.rotation = clamp(this.bird.rotation + dt * 2.6, -.5, 1.15);
    this.spawn -= dt * mod.speedMul;
    if (this.spawn <= 0 && !mod.suppressPipes) { this.addPipe(gap); this.spawn = Math.max(1.08, 1.72 - level * .05); }
    for (const pipe of this.pipes) if (pipe.active) { pipe.x -= flow * dt; if (!pipe.counted && pipe.x + 64 < BIRD_X) { pipe.counted = true; this.score += this.director.pipeScore(); this.audio.score(); this.events.onScore(this.score); this.emit(); } if (pipe.x < -90) pipe.active = false; }
    if (this.bird.y - R < 0 || this.bird.y + R > H - GROUND || this.pipes.some(p => p.active && this.hitPipe(p)) || this.director.takeKill()) this.hit();
  }

  /** A hit only ends the run if no powerup absorbs it. */
  private hit() { if (this.director.absorbHit()) { this.bird.velocity = Math.min(this.bird.velocity, -230); return; } this.die(); }
  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 140; this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .3 + Math.random() * .4, color }); }
  }
  private addPipe(gap: number) { const p = this.pipes.find(item => !item.active); if (!p) return; p.active = true; p.x = W + 30; p.gap = gap; p.gapY = 160 + Math.random() * (H - GROUND - 320); p.counted = false; }
  private hitPipe(p: Pipe) { if (BIRD_X + R < p.x || BIRD_X - R > p.x + 64) return false; return this.bird.y - R < p.gapY - p.gap / 2 || this.bird.y + R > p.gapY + p.gap / 2; }
  private die() { this.state = 'gameOver'; this.audio.hit(); this.shake = .22; for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, s = 70 + Math.random() * 180; this.particles.push({ x: BIRD_X, y: this.bird.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .45 + Math.random() * .45, color: i % 2 ? '#ffd15c' : '#ff825f' }); } this.events.onGameOver(this.score); this.emit(); }
  private draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(-20, -20, W + 40, H + 40);
    if (this.shake) c.translate((Math.random() - .5) * 9, (Math.random() - .5) * 9);
    this.background(c);
    this.director.render(c, 'back');
    for (const p of this.pipes) if (p.active) this.pipe(c, p);
    this.director.render(c, 'mid');
    this.ground(c);
    this.particles.forEach(p => { c.globalAlpha = p.life; c.fillStyle = p.color; c.fillRect(p.x - 3, p.y - 3, 6, 6); });
    c.globalAlpha = 1;
    this.birdDraw(c);
    this.director.render(c, 'front');
    this.director.render(c, 'hud');
    c.restore();
  }
  private background(c: CanvasRenderingContext2D) { const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#77ceff'); sky.addColorStop(.65, '#d7f2ff'); sky.addColorStop(1, '#f6dbad'); c.fillStyle = sky; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 6; i++) { const x = ((i * 92 - this.cloudOffset * (i % 2 ? .5 : 1)) + W) % (W + 100) - 50, y = 75 + (i % 3) * 80; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.arc(x + 22, y - 9, 22, 0, Math.PI * 2); c.arc(x + 48, y, 15, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#8bc49b'; c.beginPath(); c.moveTo(0, 490); for (let x = 0; x <= W; x += 55) c.lineTo(x, 450 + Math.sin(x * .04) * 22); c.lineTo(W, H - GROUND); c.lineTo(0, H - GROUND); c.fill(); c.fillStyle = '#53955f'; for (let x = 0; x < W; x += 24) c.fillRect(x, 515 + Math.sin(x) * 8, 12, 115); }
  private pipe(c: CanvasRenderingContext2D, p: Pipe) { const top = p.gapY - p.gap / 2, bottom = p.gapY + p.gap / 2; const paint = (y: number, h: number) => { const g = c.createLinearGradient(p.x, 0, p.x + 64, 0); g.addColorStop(0, '#167a57'); g.addColorStop(.42, '#47d88c'); g.addColorStop(1, '#11714e'); c.shadowColor = 'rgba(10,60,40,.24)'; c.shadowBlur = 8; c.fillStyle = g; c.beginPath(); c.roundRect(p.x, y, 64, h, 10); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(p.x + 10, y + 5, 7, Math.max(0, h - 10)); }; paint(0, top); paint(bottom, H - GROUND - bottom); c.fillStyle = '#37bc79'; c.fillRect(p.x - 6, top - 22, 76, 22); c.fillRect(p.x - 6, bottom, 76, 22); }
  private ground(c: CanvasRenderingContext2D) { c.fillStyle = '#d9a95a'; c.fillRect(0, H - GROUND, W, GROUND); c.fillStyle = '#82c958'; c.fillRect(0, H - GROUND, W, 15); c.fillStyle = 'rgba(113,74,37,.22)'; for (let x = -this.groundOffset; x < W; x += 36) c.fillRect(x, H - 49, 19, 7); }
  private birdDraw(c: CanvasRenderingContext2D) { const b = this.bird; c.save(); c.translate(BIRD_X, b.y); c.rotate(b.rotation); c.fillStyle = 'rgba(48,68,78,.2)'; c.beginPath(); c.ellipse(2, 24, 20, 5, 0, 0, Math.PI * 2); c.fill(); const skin = this.director.skin(); c.fillStyle = skin.body; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill(); c.fillStyle = skin.wing; c.beginPath(); c.ellipse(-4, 4 + Math.sin(b.wing) * 7, 13, 7, -.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(7, -6, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#24334d'; c.beginPath(); c.arc(9, -6, 2.5, 0, Math.PI * 2); c.fill(); c.fillStyle = skin.beak; c.beginPath(); c.moveTo(16, 3); c.lineTo(29, 7); c.lineTo(16, 11); c.fill(); c.restore(); }
}
