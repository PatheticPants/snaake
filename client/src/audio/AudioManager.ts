// ============================================================
// Audio Manager - Procedural placeholder sounds using Web Audio API
// ============================================================

import { GameSettings } from '@shared/types.js';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: GameSettings;
  private initialized = false;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  private init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.initialized = true;
    } catch {
      console.warn('[Audio] Web Audio API not supported');
    }
  }

  private getVolume(): number {
    if (this.settings.muted) return 0;
    return this.settings.sfxVolume;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volumeMult = 1): void {
    this.init();
    if (!this.ctx || this.getVolume() === 0) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(this.getVolume() * volumeMult * 0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Fail silently
    }
  }

  playPelletPickup(): void {
    const freq = 600 + Math.random() * 400;
    this.playTone(freq, 0.08, 'sine', 0.5);
  }

  playBoost(): void {
    this.playTone(200, 0.15, 'sawtooth', 0.3);
  }

  playDeath(): void {
    this.init();
    if (!this.ctx || this.getVolume() === 0) return;

    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();

      // Noise burst for death
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.getVolume() * 0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
    } catch {
      // Fail silently
    }
  }

  playClick(): void {
    this.playTone(800, 0.05, 'square', 0.3);
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
