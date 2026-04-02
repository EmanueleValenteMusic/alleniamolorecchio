import type { ScaleDefinition, ScaleFamily } from '../app/types';

const MAJOR_PATTERN = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_PATTERN = [0, 2, 3, 5, 7, 8, 10];
const HARMONIC_MINOR_PATTERN = [0, 2, 3, 5, 7, 8, 11];
const MELODIC_MINOR_PATTERN = [0, 2, 3, 5, 7, 9, 11];

const SCALE_PROFILES: Record<ScaleFamily, Pick<ScaleDefinition, 'triadQualities' | 'tetradQualities' | 'triadNumerals' | 'tetradNumerals'>> = {
  maggiore: {
    triadQualities: ['maggiore', 'minore', 'minore', 'maggiore', 'maggiore', 'minore', 'diminuito'],
    tetradQualities: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
    triadNumerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    tetradNumerals: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']
  },
  'minore naturale': {
    triadQualities: ['minore', 'diminuito', 'maggiore', 'minore', 'minore', 'maggiore', 'maggiore'],
    tetradQualities: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
    triadNumerals: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
    tetradNumerals: ['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7']
  },
  'minore armonica': {
    triadQualities: ['minore', 'diminuito', 'aumentato', 'minore', 'maggiore', 'maggiore', 'diminuito'],
    tetradQualities: ['mMaj7', 'm7b5', '+maj7', 'm7', '7', 'maj7', 'dim7'],
    triadNumerals: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'],
    tetradNumerals: ['iMaj7', 'iiø7', 'III+maj7', 'iv7', 'V7', 'VImaj7', 'vii°7']
  },
  'minore melodica': {
    triadQualities: ['minore', 'minore', 'aumentato', 'maggiore', 'maggiore', 'diminuito', 'diminuito'],
    tetradQualities: ['mMaj7', 'm7', '+maj7', '7', '7', 'm7b5', 'm7b5'],
    triadNumerals: ['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°'],
    tetradNumerals: ['iMaj7', 'ii7', 'III+maj7', 'IV7', 'V7', 'viø7', 'viiø7']
  }
};

function makeScale(key: string, family: ScaleFamily, notes: string[], semitones: number[], tonicMidi: number): ScaleDefinition {
  const profile = SCALE_PROFILES[family];
  return {
    key,
    family,
    notes,
    semitones,
    tonicMidi,
    triadQualities: profile.triadQualities,
    tetradQualities: profile.tetradQualities,
    triadNumerals: profile.triadNumerals,
    tetradNumerals: profile.tetradNumerals
  };
}

export const SCALES: ScaleDefinition[] = [
  makeScale('Do maggiore', 'maggiore', ['C', 'D', 'E', 'F', 'G', 'A', 'B'], MAJOR_PATTERN, 60),
  makeScale('Sol maggiore', 'maggiore', ['G', 'A', 'B', 'C', 'D', 'E', 'F#'], MAJOR_PATTERN, 67),
  makeScale('Re maggiore', 'maggiore', ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'], MAJOR_PATTERN, 62),
  makeScale('La maggiore', 'maggiore', ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'], MAJOR_PATTERN, 69),
  makeScale('Mi maggiore', 'maggiore', ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'], MAJOR_PATTERN, 64),
  makeScale('Si maggiore', 'maggiore', ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'], MAJOR_PATTERN, 71),
  makeScale('Fa maggiore', 'maggiore', ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'], MAJOR_PATTERN, 65),
  makeScale('Si bemolle maggiore', 'maggiore', ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'], MAJOR_PATTERN, 70),
  makeScale('Mi bemolle maggiore', 'maggiore', ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'], MAJOR_PATTERN, 63),
  makeScale('La minore naturale', 'minore naturale', ['A', 'B', 'C', 'D', 'E', 'F', 'G'], NATURAL_MINOR_PATTERN, 69),
  makeScale('Mi minore naturale', 'minore naturale', ['E', 'F#', 'G', 'A', 'B', 'C', 'D'], NATURAL_MINOR_PATTERN, 64),
  makeScale('Re minore naturale', 'minore naturale', ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'], NATURAL_MINOR_PATTERN, 62),
  makeScale('Sol minore naturale', 'minore naturale', ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'], NATURAL_MINOR_PATTERN, 67),
  makeScale('Do minore naturale', 'minore naturale', ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'], NATURAL_MINOR_PATTERN, 60),
  makeScale('Fa minore naturale', 'minore naturale', ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'], NATURAL_MINOR_PATTERN, 65),
  makeScale('La minore armonica', 'minore armonica', ['A', 'B', 'C', 'D', 'E', 'F', 'G#'], HARMONIC_MINOR_PATTERN, 69),
  makeScale('Mi minore armonica', 'minore armonica', ['E', 'F#', 'G', 'A', 'B', 'C', 'D#'], HARMONIC_MINOR_PATTERN, 64),
  makeScale('Re minore armonica', 'minore armonica', ['D', 'E', 'F', 'G', 'A', 'Bb', 'C#'], HARMONIC_MINOR_PATTERN, 62),
  makeScale('Sol minore armonica', 'minore armonica', ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F#'], HARMONIC_MINOR_PATTERN, 67),
  makeScale('Do minore armonica', 'minore armonica', ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B'], HARMONIC_MINOR_PATTERN, 60),
  makeScale('Fa minore armonica', 'minore armonica', ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'E'], HARMONIC_MINOR_PATTERN, 65),
  makeScale('La minore melodica', 'minore melodica', ['A', 'B', 'C', 'D', 'E', 'F#', 'G#'], MELODIC_MINOR_PATTERN, 69),
  makeScale('Mi minore melodica', 'minore melodica', ['E', 'F#', 'G', 'A', 'B', 'C#', 'D#'], MELODIC_MINOR_PATTERN, 64),
  makeScale('Re minore melodica', 'minore melodica', ['D', 'E', 'F', 'G', 'A', 'B', 'C#'], MELODIC_MINOR_PATTERN, 62),
  makeScale('Sol minore melodica', 'minore melodica', ['G', 'A', 'Bb', 'C', 'D', 'E', 'F#'], MELODIC_MINOR_PATTERN, 67),
  makeScale('Do minore melodica', 'minore melodica', ['C', 'D', 'Eb', 'F', 'G', 'A', 'B'], MELODIC_MINOR_PATTERN, 60),
  makeScale('Fa minore melodica', 'minore melodica', ['F', 'G', 'Ab', 'Bb', 'C', 'D', 'E'], MELODIC_MINOR_PATTERN, 65)
];