import type { ScoreState, SettingsState } from './types';

const SCORE_STORAGE_KEY = 'progressioni-armoniche-score-v3';
const SETTINGS_STORAGE_KEY = 'progressioni-armoniche-settings-v2';

export function loadSettings(): SettingsState {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { slotCount: 4, scaleFamily: 'maggiore', playMode: 'triadi', playbackMode: 'armonico' };
    }

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      slotCount: clampSlotCount(parsed.slotCount ?? 4),
      scaleFamily: parsed.scaleFamily === 'minore naturale' || parsed.scaleFamily === 'minore armonica' || parsed.scaleFamily === 'minore melodica'
        ? parsed.scaleFamily
        : 'maggiore',
      playMode: parsed.playMode === 'quadriadi' || parsed.playMode === 'nota singola' ? parsed.playMode : 'triadi',
      playbackMode: parsed.playbackMode === 'melodico' ? 'melodico' : 'armonico'
    };
  } catch {
    return { slotCount: 4, scaleFamily: 'maggiore', playMode: 'triadi', playbackMode: 'armonico' };
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