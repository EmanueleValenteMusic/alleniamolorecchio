export class PianoEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  async ensureReady(): Promise<boolean> {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return false;
      }

      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return true;
  }

  playChord(midiNotes: number[], options?: { when?: number; duration?: number; velocity?: number }): void {
    if (!this.context || !this.master) {
      return;
    }

    const when = options?.when ?? this.context.currentTime;
    const duration = options?.duration ?? 1.1;
    const velocity = options?.velocity ?? 0.35;
    const voicedNotes = [...midiNotes, midiNotes[midiNotes.length - 1] + 12];

    voicedNotes.forEach((midi, index) => {
      this.playPianoNote(midi, when + index * 0.015, duration, velocity);
    });
  }

  playSingle(midiNote: number, options?: { when?: number; duration?: number; velocity?: number }): void {
    if (!this.context || !this.master) {
      return;
    }

    const when = options?.when ?? this.context.currentTime;
    const duration = options?.duration ?? 0.88;
    const velocity = options?.velocity ?? 0.34;
    this.playPianoNote(midiNote, when, duration, velocity);
  }

  playArpeggio(midiNotes: number[], options?: { when?: number; step?: number; noteDuration?: number; velocity?: number }): void {
    if (!this.context || !this.master) {
      return;
    }

    const when = options?.when ?? this.context.currentTime;
    const step = options?.step ?? 0.22;
    const noteDuration = options?.noteDuration ?? 0.46;
    const velocity = options?.velocity ?? 0.32;
    midiNotes.forEach((midi, index) => {
      this.playPianoNote(midi, when + index * step, noteDuration, velocity);
    });
  }

  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  private playPianoNote(midi: number, when: number, duration: number, velocity: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const frequency = 440 * (2 ** ((midi - 69) / 12));
    const noteGain = this.context.createGain();
    const bodyFilter = this.context.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(4800, when);
    bodyFilter.frequency.exponentialRampToValueAtTime(1800, when + duration);
    bodyFilter.Q.value = 1.2;

    noteGain.gain.setValueAtTime(0.0001, when);
    noteGain.gain.exponentialRampToValueAtTime(velocity, when + 0.018);
    noteGain.gain.exponentialRampToValueAtTime(velocity * 0.42, when + 0.16);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    const oscillators = [
      { type: 'triangle' as OscillatorType, detune: -2, gain: 0.58 },
      { type: 'sine' as OscillatorType, detune: 3, gain: 0.28 },
      { type: 'triangle' as OscillatorType, detune: 0, gain: 0.13, multiplier: 2 }
    ];

    oscillators.forEach((partial) => {
      const oscillator = this.context!.createOscillator();
      const oscillatorGain = this.context!.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(frequency * (partial.multiplier ?? 1), when);
      oscillator.detune.setValueAtTime(partial.detune, when);
      oscillatorGain.gain.value = partial.gain;
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(bodyFilter);
      oscillator.start(when);
      oscillator.stop(when + duration + 0.05);
    });

    const hammer = this.context.createBufferSource();
    hammer.buffer = this.createNoiseBuffer();
    const hammerFilter = this.context.createBiquadFilter();
    hammerFilter.type = 'highpass';
    hammerFilter.frequency.value = 2200;
    const hammerGain = this.context.createGain();
    hammerGain.gain.setValueAtTime(0.18 * velocity, when);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);

    hammer.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(bodyFilter);
    bodyFilter.connect(noteGain);
    noteGain.connect(this.master);

    hammer.start(when);
    hammer.stop(when + 0.04);
  }

  private createNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer && this.context) {
      return this.noiseBuffer;
    }

    if (!this.context) {
      throw new Error('Audio context non inizializzato');
    }

    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * 0.05));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }

    this.noiseBuffer = buffer;
    return buffer;
  }
}