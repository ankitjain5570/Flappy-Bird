export class GameAudio {
  private context?: AudioContext;
  constructor(private muted = false) {}
  setMuted(muted: boolean) { this.muted = muted; }
  private tone(frequency: number, duration: number, type: OscillatorType, gain = .05) {
    if (this.muted) return;
    this.context ??= new AudioContext();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    volume.gain.setValueAtTime(gain, now); volume.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(volume).connect(this.context.destination); oscillator.start(now); oscillator.stop(now + duration);
  }
  flap() { this.tone(440, .09, 'sine', .045); }
  score() { this.tone(740, .13, 'triangle', .06); }
  hit() { this.tone(120, .25, 'sawtooth', .07); }
  // Progression cues. Each is a short blip so they never mask the core sounds.
  coin() { this.tone(1180, .08, 'triangle', .05); window.setTimeout(() => this.tone(1560, .09, 'triangle', .045), 55); }
  power() { this.tone(520, .1, 'square', .04); window.setTimeout(() => this.tone(880, .16, 'square', .04), 80); }
  warn() { this.tone(220, .16, 'square', .035); }
  portal() { this.tone(300, .22, 'sine', .05); window.setTimeout(() => this.tone(620, .2, 'sine', .04), 90); }
}
