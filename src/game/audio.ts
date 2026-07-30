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
}
