import type { RoundState, ScoreBounds, ScoreBreakdown, SettingsState } from './types';

export function getScoreBounds(settings: SettingsState): ScoreBounds {
  const slotWeight = settings.slotCount * 26;
  const modeBonus = settings.playMode === 'quadriadi' ? 120 : settings.playMode === 'triadi' ? 40 : 0;
  const playbackBonus = settings.playMode === 'nota singola' ? 0 : settings.playbackMode === 'melodico' ? 28 : 0;
  return {
    maxScore: 80 + slotWeight + modeBonus + playbackBonus,
    minScore: 16 + settings.slotCount * 7 + (settings.playMode === 'quadriadi' ? 28 : settings.playMode === 'triadi' ? 12 : 0)
  };
}

export function computeScoreBreakdown(round: RoundState, settings: SettingsState): ScoreBreakdown {
  const bounds = getScoreBounds(settings);
  const elapsedSeconds = round.answerWindowStartedAt === null
    ? 999
    : Math.max(0, (Date.now() - round.answerWindowStartedAt) / 1000);
  const modeMultiplier = settings.playMode === 'quadriadi' ? 1.3 : settings.playMode === 'triadi' ? 1 : 0.72;
  const playbackMultiplier = settings.playMode !== 'nota singola' && settings.playbackMode === 'melodico' ? 1.14 : 1;
  const sequencePenalty = Math.max(0, round.sequencePlayCount - 1) * Math.round(28 * modeMultiplier * playbackMultiplier);
  const cardPenalty = round.cardPreviewCount * Math.round(8 * modeMultiplier);
  const timePenalty = elapsedSeconds <= 10 ? 0 : Math.ceil((elapsedSeconds - 10) * (settings.playMode === 'quadriadi' ? 5 : settings.playMode === 'triadi' ? 4 : 3));
  const attemptPenalty = round.attempts * Math.round(18 * modeMultiplier);
  const earned = Math.max(bounds.minScore, bounds.maxScore - sequencePenalty - cardPenalty - timePenalty - attemptPenalty);

  return {
    ...bounds,
    earned,
    elapsedSeconds,
    sequencePenalty,
    cardPenalty,
    timePenalty,
    attemptPenalty
  };
}

export function getMistakePenalty(round: RoundState): number {
  return 6 + round.slotCount * 4 + (round.playMode === 'quadriadi' ? 12 : round.playMode === 'triadi' ? 4 : 0);
}