(function (P) {
  'use strict';
  P.Audio = class {
    constructor(settings) { this.settings = settings; this.ctx = null; this.lastAlert = -10; }
    unlock() {
      try {
        if (!this.ctx) {
          const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AudioContext) return;
          this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this.update();
      } catch { this.ctx = null; }
    }
    update() { if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume * 0.22, this.ctx.currentTime, 0.04); }
    suspend() { if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {}); }
    tone(frequency, duration = 0.15, offset = 0, type = 'sine', volume = 0.5) {
      if (!this.ctx || this.ctx.state !== 'running' || this.settings.muted || this.settings.volume <= 0) return;
      const t = this.ctx.currentTime + offset, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0.001, t); gain.gain.exponentialRampToValueAtTime(volume, t + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration + 0.02);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    consume(events) {
      for (const e of events) {
        if (e.type === 'pearl') { this.tone(e.kind === 'ivory' ? 660 : 880, 0.14); this.tone(e.kind === 'ivory' ? 990 : 1320, 0.22, 0.055, 'sine', 0.25); }
        if (e.type === 'alert' && this.ctx && this.ctx.currentTime - this.lastAlert > 0.7) { this.lastAlert = this.ctx.currentTime; this.tone(220, 0.15, 0, 'triangle', 0.18); }
        if (e.type === 'explosion') { this.tone(75, 0.32, 0, 'triangle', 0.6); this.tone(130, 0.18, 0, 'sawtooth', 0.15); }
        if (e.type === 'damage') { this.tone(160, 0.18, 0, 'triangle'); this.tone(105, 0.25, 0.09, 'triangle'); }
        if (e.type === 'dash') this.tone(330, 0.16, 0, 'triangle', 0.2);
        if (e.type === 'buoy') { this.tone(440, 0.4, 0, 'sine', 0.4); this.tone(660, 0.5, 0.1, 'sine', 0.2); }
        if (e.type === 'harbor') [440, 550, 660].forEach((n, i) => this.tone(n, 0.3, i * 0.12));
        if (e.type === 'finish') [523, 659, 784, 1046].forEach((n, i) => this.tone(n, 0.45, i * 0.13));
        if (e.type === 'end') [220, 196, 147].forEach((n, i) => this.tone(n, 0.35, i * 0.15, 'triangle'));
      }
    }
  };
})(globalThis.Pearls ||= {});
