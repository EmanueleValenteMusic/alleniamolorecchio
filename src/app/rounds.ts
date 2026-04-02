import { SCALES } from '../data/scales';
import type { ChordOption, PlayMode, RoundState, ScaleDefinition, SettingsState, SlotResult } from './types';

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

export function createRound(settings: SettingsState): RoundState {
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
    sequenceFinishedAt: null
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

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function sample<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}