import type { SoundTimbre } from '../app/types';

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

  playSingle(midiNote: number, options?: { when?: number; duration?: number; velocity?: number; timbre?: SoundTimbre; flatEnvelope?: boolean }): void {
    if (!this.context || !this.master) {
      return;
    }

    const when = options?.when ?? this.context.currentTime;
    const duration = options?.duration ?? 0.88;
    const velocity = options?.velocity ?? 0.34;
    const timbre = options?.timbre ?? 'piano';
    const flatEnvelope = options?.flatEnvelope ?? false;

    if (timbre === 'piano') {
      this.playPianoNote(midiNote, when, duration, velocity);
      return;
    }

    this.playSynthNote(midiNote, when, duration, velocity, timbre, flatEnvelope);
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

  private playSynthNote(
    midi: number,
    when: number,
    duration: number,
    velocity: number,
    timbre: SoundTimbre,
    flatEnvelope: boolean
  ): void {
    if (!this.context || !this.master) {
      return;
    }

    const frequency = 440 * (2 ** ((midi - 69) / 12));
    const noteGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const recipe = this.getSynthRecipe(timbre);

    filter.type = recipe.filterType;
    filter.frequency.setValueAtTime(recipe.filterStart, when);
    filter.frequency.linearRampToValueAtTime(recipe.filterEnd, when + duration);
    filter.Q.value = recipe.filterQ;

    noteGain.gain.setValueAtTime(flatEnvelope ? velocity : 0.0001, when);
    if (flatEnvelope) {
      noteGain.gain.setValueAtTime(velocity, when);
      noteGain.gain.setValueAtTime(velocity, when + Math.max(0.02, duration - 0.02));
      noteGain.gain.linearRampToValueAtTime(0.0001, when + duration);
    } else {
      noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity), when + recipe.attack);
      noteGain.gain.linearRampToValueAtTime(velocity * recipe.sustain, when + Math.min(duration * 0.55, recipe.attack + recipe.decay));
      noteGain.gain.linearRampToValueAtTime(0.0001, when + duration);
    }

    recipe.partials.forEach((partial) => {
      const oscillator = this.context!.createOscillator();
      const oscillatorGain = this.context!.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(frequency * (partial.multiplier ?? 1), when);
      oscillator.detune.setValueAtTime(partial.detune ?? 0, when);
      oscillatorGain.gain.value = partial.gain;
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(filter);
      oscillator.start(when);
      oscillator.stop(when + duration + 0.05);
    });

    if (recipe.noiseGain > 0) {
      const noise = this.context.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const noiseGain = this.context.createGain();
      const noiseFilter = this.context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = recipe.noiseFilter;
      noiseGain.gain.setValueAtTime(recipe.noiseGain * velocity, when);
      noiseGain.gain.linearRampToValueAtTime(0.0001, when + duration);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start(when);
      noise.stop(when + duration + 0.02);
    }

    filter.connect(noteGain);
    noteGain.connect(this.master);
  }

  private getSynthRecipe(timbre: SoundTimbre): {
    attack: number;
    decay: number;
    sustain: number;
    filterType: BiquadFilterType;
    filterStart: number;
    filterEnd: number;
    filterQ: number;
    noiseGain: number;
    noiseFilter: number;
    partials: Array<{ type: OscillatorType; gain: number; detune?: number; multiplier?: number }>;
  } {
    switch (timbre) {
      case 'glass':
        return {
          attack: 0.01,
          decay: 0.18,
          sustain: 0.42,
          filterType: 'highpass',
          filterStart: 700,
          filterEnd: 2400,
          filterQ: 1.4,
          noiseGain: 0,
          noiseFilter: 2400,
          partials: [
            { type: 'sine', gain: 0.64 },
            { type: 'triangle', gain: 0.22, multiplier: 2, detune: 6 },
            { type: 'sine', gain: 0.18, multiplier: 3, detune: -4 }
          ]
        };
      case 'reed':
        return {
          attack: 0.015,
          decay: 0.22,
          sustain: 0.58,
          filterType: 'bandpass',
          filterStart: 1200,
          filterEnd: 900,
          filterQ: 2.8,
          noiseGain: 0.03,
          noiseFilter: 1600,
          partials: [
            { type: 'square', gain: 0.36 },
            { type: 'triangle', gain: 0.28, detune: 4 },
            { type: 'sine', gain: 0.2, multiplier: 2 }
          ]
        };
      case 'organ':
        return {
          attack: 0.008,
          decay: 0.08,
          sustain: 0.9,
          filterType: 'lowpass',
          filterStart: 2600,
          filterEnd: 2200,
          filterQ: 0.8,
          noiseGain: 0,
          noiseFilter: 1200,
          partials: [
            { type: 'sine', gain: 0.42 },
            { type: 'sine', gain: 0.25, multiplier: 2 },
            { type: 'triangle', gain: 0.18, multiplier: 4 }
          ]
        };
      case 'chip':
        return {
          attack: 0.002,
          decay: 0.06,
          sustain: 0.72,
          filterType: 'lowpass',
          filterStart: 4800,
          filterEnd: 3200,
          filterQ: 0.9,
          noiseGain: 0,
          noiseFilter: 2000,
          partials: [
            { type: 'square', gain: 0.52 },
            { type: 'square', gain: 0.16, multiplier: 2, detune: 10 }
          ]
        };
      case 'hollow':
        return {
          attack: 0.012,
          decay: 0.16,
          sustain: 0.5,
          filterType: 'bandpass',
          filterStart: 900,
          filterEnd: 650,
          filterQ: 3.2,
          noiseGain: 0,
          noiseFilter: 900,
          partials: [
            { type: 'triangle', gain: 0.4 },
            { type: 'sine', gain: 0.24, multiplier: 0.5 },
            { type: 'sine', gain: 0.18, multiplier: 2.01 }
          ]
        };
      case 'buzz':
        return {
          attack: 0.004,
          decay: 0.12,
          sustain: 0.62,
          filterType: 'highpass',
          filterStart: 320,
          filterEnd: 1100,
          filterQ: 1.1,
          noiseGain: 0.015,
          noiseFilter: 2400,
          partials: [
            { type: 'sawtooth', gain: 0.42 },
            { type: 'square', gain: 0.16, detune: -7 },
            { type: 'triangle', gain: 0.12, multiplier: 2 }
          ]
        };
      default:
        return {
          attack: 0.01,
          decay: 0.12,
          sustain: 0.7,
          filterType: 'lowpass',
          filterStart: 2600,
          filterEnd: 1800,
          filterQ: 1,
          noiseGain: 0,
          noiseFilter: 1200,
          partials: [
            { type: 'triangle', gain: 0.48 },
            { type: 'sine', gain: 0.22 }
          ]
        };
    }
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