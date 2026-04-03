import { SCALES } from '../data/scales';
import type {
  ChordOption,
  IntervalAnswerOption,
  IntervalDirection,
  IntervalQuestion,
  IntervalType,
  PlayMode,
  RoundState,
  ScaleDefinition,
  SettingsState,
  SlotResult
} from './types';

const QUALITY_SUFFIX: Record<string, string> = {
  maggiore: '',
  minore: 'm',
  diminuito: 'dim',
  aumentato: '+',
  maj7: 'maj7',
  m7: 'm7',
  '7': '7',
  m7b5: 'm7b5',
  dim7: 'dim7',
  '+maj7': '+maj7',
  mMaj7: 'mMaj7'
};

let roundIdSeed = 0;

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const INTERVAL_OPTION_SETS: Record<IntervalType, IntervalAnswerOption[]> = {
  '2ª': [
    { id: 'm2', label: 'Seconda minore', shortLabel: '2ª minore', semitones: 1 },
    { id: 'M2', label: 'Seconda maggiore', shortLabel: '2ª maggiore', semitones: 2 }
  ],
  '3ª': [
    { id: 'm3', label: 'Terza minore', shortLabel: '3ª minore', semitones: 3 },
    { id: 'M3', label: 'Terza maggiore', shortLabel: '3ª maggiore', semitones: 4 }
  ],
  '4ª': [
    { id: 'P4', label: 'Quarta giusta', shortLabel: '4ª giusta', semitones: 5 },
    { id: 'A4', label: 'Quarta aumentata', shortLabel: '4ª aumentata', semitones: 6 }
  ],
  '5ª': [
    { id: 'd5', label: 'Quinta diminuita', shortLabel: '5ª diminuita', semitones: 6 },
    { id: 'P5', label: 'Quinta giusta', shortLabel: '5ª giusta', semitones: 7 },
    { id: 'A5', label: 'Quinta aumentata', shortLabel: '5ª aumentata', semitones: 8 }
  ],
  '6ª': [
    { id: 'm6', label: 'Sesta minore', shortLabel: '6ª minore', semitones: 8 },
    { id: 'M6', label: 'Sesta maggiore', shortLabel: '6ª maggiore', semitones: 9 }
  ],
  '7ª': [
    { id: 'm7', label: 'Settima minore', shortLabel: '7ª minore', semitones: 10 },
    { id: 'M7', label: 'Settima maggiore', shortLabel: '7ª maggiore', semitones: 11 }
  ],
  '5ª, 4ª, 8ª': [
    { id: 'P5', label: 'Quinta giusta', shortLabel: '5ª giusta', semitones: 7 },
    { id: 'P4', label: 'Quarta giusta', shortLabel: '4ª giusta', semitones: 5 },
    { id: 'P8', label: 'Ottava giusta', shortLabel: '8ª giusta', semitones: 12 }
  ],
  '9ª': [
    { id: 'm9', label: 'Nona minore', shortLabel: '9ª minore', semitones: 13 },
    { id: 'M9', label: 'Nona maggiore', shortLabel: '9ª maggiore', semitones: 14 }
  ],
  'Scala maggiore': [
    { id: 'M2', label: 'Seconda maggiore', shortLabel: '2ª maggiore', semitones: 2 },
    { id: 'M3', label: 'Terza maggiore', shortLabel: '3ª maggiore', semitones: 4 },
    { id: 'P4', label: 'Quarta giusta', shortLabel: '4ª giusta', semitones: 5 },
    { id: 'P5', label: 'Quinta giusta', shortLabel: '5ª giusta', semitones: 7 },
    { id: 'M6', label: 'Sesta maggiore', shortLabel: '6ª maggiore', semitones: 9 },
    { id: 'M7', label: 'Settima maggiore', shortLabel: '7ª maggiore', semitones: 11 },
    { id: 'P8', label: 'Ottava giusta', shortLabel: '8ª giusta', semitones: 12 }
  ],
  'Scala cromatica': [
    { id: 'M2', label: 'Seconda maggiore', shortLabel: '2ª maggiore', semitones: 2 },
    { id: 'm2', label: 'Seconda minore', shortLabel: '2ª minore', semitones: 1 },
    { id: 'M3', label: 'Terza maggiore', shortLabel: '3ª maggiore', semitones: 4 },
    { id: 'm3', label: 'Terza minore', shortLabel: '3ª minore', semitones: 3 },
    { id: 'P4', label: 'Quarta giusta', shortLabel: '4ª giusta', semitones: 5 },
    { id: 'd5', label: 'Quinta diminuita', shortLabel: '5ª diminuita', semitones: 6 },
    { id: 'P5', label: 'Quinta giusta', shortLabel: '5ª giusta', semitones: 7 },
    { id: 'A5', label: 'Quinta aumentata', shortLabel: '5ª aumentata', semitones: 8 },
    { id: 'M6', label: 'Sesta maggiore', shortLabel: '6ª maggiore', semitones: 9 },
    { id: 'M7', label: 'Settima maggiore', shortLabel: '7ª maggiore', semitones: 11 },
    { id: 'm7', label: 'Settima minore', shortLabel: '7ª minore', semitones: 10 },
    { id: 'P8', label: 'Ottava giusta', shortLabel: '8ª giusta', semitones: 12 },
    { id: 'm9', label: 'Nona minore', shortLabel: '9ª minore', semitones: 13 },
    { id: 'M9', label: 'Nona maggiore', shortLabel: '9ª maggiore', semitones: 14 }
  ]
};

export function createRound(settings: SettingsState): RoundState {
  if (settings.playMode === 'intervalli') {
    return createIntervalRound(settings);
  }

  const familyScales = SCALES.filter((scale) => scale.family === settings.scaleFamily);
  const scale = sample(familyScales);
  const options = buildOptions(scale, settings.playMode);
  const solution = generateSolution(options.length, settings.slotCount);
  roundIdSeed += 1;

  return {
    id: roundIdSeed,
    scale,
    options,
    solution,
    placements: Array.from({ length: settings.slotCount }, () => null),
    lastCheckResults: Array.from({ length: settings.slotCount }, () => null),
    attempts: 0,
    counted: false,
    locked: false,
    solved: false,
    slotCount: settings.slotCount,
    playMode: settings.playMode,
    playbackMode: settings.playbackMode,
    sequencePlayCount: 0,
    cardPreviewCount: 0,
    answerWindowStartedAt: null,
    sequenceFinishedAt: null,
    intervalQuestion: null,
    selectedAnswerId: null
  };
}

export function buildOptions(scale: ScaleDefinition, playMode: PlayMode): ChordOption[] {
  const stackSize = playMode === 'quadriadi' ? 4 : 1;
  const effectiveStackSize = playMode === 'triadi' ? 3 : stackSize;
  const qualities = playMode === 'quadriadi' ? scale.tetradQualities : scale.triadQualities;
  const numerals = playMode === 'quadriadi' ? scale.tetradNumerals : scale.triadNumerals;

  return scale.notes.map((rootName, degree) => {
    const midi = Array.from({ length: effectiveStackSize }, (_, noteIndex) => {
      const diatonicIndex = degree + noteIndex * 2;
      const wrappedIndex = diatonicIndex % 7;
      const octaveOffset = Math.floor(diatonicIndex / 7) * 12;
      return scale.tonicMidi + scale.semitones[wrappedIndex] + octaveOffset;
    });

    const notes = Array.from({ length: effectiveStackSize }, (_, noteIndex) => scale.notes[(degree + noteIndex * 2) % 7]);
    const quality = playMode === 'nota singola' ? '' : qualities[degree];
    const symbol = playMode === 'nota singola' ? rootName : `${rootName}${QUALITY_SUFFIX[quality] ?? ` ${quality}`}`;

    return {
      degree,
      numeral: playMode === 'nota singola' ? String(degree + 1) : numerals[degree],
      quality,
      label: rootName,
      symbol,
      notes,
      midi
    };
  });
}

export function evaluatePlacements(round: RoundState): SlotResult[] {
  return round.placements.map((degree, index) => {
    if (degree === null) {
      return null;
    }

    return degree === round.solution[index] ? 'correct' : 'wrong';
  });
}

function generateSolution(optionCount: number, slotCount: number): number[] {
  const solution: number[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    let candidate = randomInt(optionCount);
    const previous = solution[index - 1];

    if (index > 0 && candidate === previous && Math.random() < 0.72) {
      let rerolls = 0;
      while (candidate === previous && rerolls < 6) {
        candidate = randomInt(optionCount);
        rerolls += 1;
      }
    }

    solution.push(candidate);
  }

  return solution;
}

function createIntervalRound(settings: SettingsState): RoundState {
  const answerOptions = INTERVAL_OPTION_SETS[settings.intervalType];
  const correctAnswer = sample(answerOptions);
  const playbackMode = settings.intervalPlaybackMode === 'entrambi'
    ? sample<IntervalQuestion['playbackMode']>(['armonico', 'melodico'])
    : settings.intervalPlaybackMode;
  const direction = playbackMode === 'melodico'
    ? settings.intervalPlaybackMode === 'entrambi'
      ? sample<IntervalDirection>(['ascendente', 'discendente'])
      : settings.intervalDirection
    : 'ascendente';
  const lowMidi = randomBetween(60, 76 - correctAnswer.semitones);
  const highMidi = lowMidi + correctAnswer.semitones;
  const midi = playbackMode === 'melodico' && direction === 'discendente'
    ? [highMidi, lowMidi]
    : [lowMidi, highMidi];

  roundIdSeed += 1;

  return {
    id: roundIdSeed,
    scale: null,
    options: [],
    solution: [],
    placements: [],
    lastCheckResults: [],
    attempts: 0,
    counted: false,
    locked: false,
    solved: false,
    slotCount: 0,
    playMode: settings.playMode,
    playbackMode: settings.playbackMode,
    sequencePlayCount: 0,
    cardPreviewCount: 0,
    answerWindowStartedAt: null,
    sequenceFinishedAt: null,
    intervalQuestion: {
      family: settings.intervalType,
      answerOptions,
      correctAnswerId: correctAnswer.id,
      notes: midi.map(formatNoteName),
      midi,
      baseMidi: lowMidi,
      playbackMode,
      direction
    },
    selectedAnswerId: null
  };
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sample<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatNoteName(midi: number): string {
  return CHROMATIC_NOTES[midi % 12];
}