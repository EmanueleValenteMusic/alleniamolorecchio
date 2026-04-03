import type { ScoreState, SettingsState } from './types';

const SCORE_STORAGE_KEY = 'progressioni-armoniche-score-v3';
const SETTINGS_STORAGE_KEY = 'progressioni-armoniche-settings-v3';

const DEFAULT_SETTINGS: SettingsState = {
  slotCount: 4,
  scaleFamily: 'maggiore',
  playMode: 'triadi',
  playbackMode: 'armonico',
  intervalType: '2ª',
  intervalPlaybackMode: 'armonico',
  intervalDirection: 'ascendente'
};

export function loadSettings(): SettingsState {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      slotCount: clampSlotCount(parsed.slotCount ?? DEFAULT_SETTINGS.slotCount),
      scaleFamily: parsed.scaleFamily === 'minore naturale' || parsed.scaleFamily === 'minore armonica' || parsed.scaleFamily === 'minore melodica'
        ? parsed.scaleFamily
        : 'maggiore',
      playMode: parsed.playMode === 'intervalli' || parsed.playMode === 'quadriadi' || parsed.playMode === 'nota singola' ? parsed.playMode : 'triadi',
      playbackMode: parsed.playbackMode === 'melodico' ? 'melodico' : 'armonico',
      intervalType: parsed.intervalType === '3ª' || parsed.intervalType === '4ª' || parsed.intervalType === '5ª' || parsed.intervalType === '6ª' || parsed.intervalType === '7ª' || parsed.intervalType === '5ª, 4ª, 8ª' || parsed.intervalType === '9ª' || parsed.intervalType === 'Scala maggiore' || parsed.intervalType === 'Scala cromatica'
        ? parsed.intervalType
        : '2ª',
      intervalPlaybackMode: parsed.intervalPlaybackMode === 'melodico' || parsed.intervalPlaybackMode === 'entrambi'
        ? parsed.intervalPlaybackMode
        : 'armonico',
      intervalDirection: parsed.intervalDirection === 'discendente' ? 'discendente' : 'ascendente'
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(settings: SettingsState): void {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function loadScore(): ScoreState {
  try {
    const raw = window.localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) {
      return createEmptyScore();
    }

    const parsed = JSON.parse(raw) as Partial<ScoreState>;
    return {
      totalPoints: Math.max(0, parsed.totalPoints ?? 0),
      streak: Math.max(0, parsed.streak ?? 0),
      bestStreak: Math.max(0, parsed.bestStreak ?? 0),
      roundsPlayed: Math.max(0, parsed.roundsPlayed ?? 0),
      roundsSolved: Math.max(0, parsed.roundsSolved ?? 0)
    };
  } catch {
    return createEmptyScore();
  }
}

export function persistScore(score: ScoreState): void {
  window.localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(score));
}

export function createEmptyScore(): ScoreState {
  return {
    totalPoints: 0,
    streak: 0,
    bestStreak: 0,
    roundsPlayed: 0,
    roundsSolved: 0
  };
}

export function clampSlotCount(value: number): number {
  return Math.max(2, Math.min(8, Number.isFinite(value) ? Math.round(value) : 4));
}