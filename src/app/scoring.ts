import type { RoundState, ScoreBounds, ScoreBreakdown, SettingsState } from './types';

export function getScoreBounds(settings: SettingsState): ScoreBounds {
  if (settings.playMode === 'intervalli') {
    const answerCount = getIntervalAnswerCount(settings.intervalType);
    const playbackBonus = settings.intervalPlaybackMode === 'entrambi' ? 30 : settings.intervalPlaybackMode === 'melodico' ? 18 : 0;
    const familyBonus = answerCount >= 14 ? 94 : answerCount >= 7 ? 58 : answerCount === 3 ? 26 : 0;
    return {
      maxScore: 72 + familyBonus + playbackBonus,
      minScore: 14 + answerCount * 3
    };
  }

  if (settings.playMode === 'altezza' || settings.playMode === 'durata' || settings.playMode === 'intensita') {
    const modeBonus = settings.playMode === 'altezza' ? 46 : settings.playMode === 'durata' ? 38 : 42;
    return {
      maxScore: 68 + settings.slotCount * 24 + modeBonus,
      minScore: 14 + settings.slotCount * 6
    };
  }

  const slotWeight = settings.slotCount * 26;
  const modeBonus = (settings.playMode === 'quadriadi' || settings.playMode === 'tipo quadriadi') ? 120 : (settings.playMode === 'triadi' || settings.playMode === 'tipo triade') ? 40 : 0;
  const playbackBonus = settings.playMode === 'nota singola' ? 0 : settings.playbackMode === 'melodico' ? 28 : 0;
  return {
    maxScore: 80 + slotWeight + modeBonus + playbackBonus,
    minScore: 16 + settings.slotCount * 7 + ((settings.playMode === 'quadriadi' || settings.playMode === 'tipo quadriadi') ? 28 : (settings.playMode === 'triadi' || settings.playMode === 'tipo triade') ? 12 : 0)
  };
}

export function computeScoreBreakdown(round: RoundState, settings: SettingsState): ScoreBreakdown {
  const bounds = getScoreBounds(settings);
  const elapsedSeconds = round.answerWindowStartedAt === null
    ? 999
    : Math.max(0, (Date.now() - round.answerWindowStartedAt) / 1000);

  if (settings.playMode === 'intervalli') {
    const answerCount = round.intervalQuestion?.answerOptions.length ?? getIntervalAnswerCount(settings.intervalType);
    const sequencePenalty = Math.max(0, round.sequencePlayCount - 1) * (settings.intervalPlaybackMode === 'entrambi' ? 18 : 12);
    const cardPenalty = 0;
    const timePenalty = elapsedSeconds <= 8 ? 0 : Math.ceil((elapsedSeconds - 8) * (answerCount >= 7 ? 5 : 3));
    const attemptPenalty = round.attempts * 14;
    const earned = Math.max(bounds.minScore, bounds.maxScore - sequencePenalty - timePenalty - attemptPenalty);

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

  if (settings.playMode === 'altezza' || settings.playMode === 'durata' || settings.playMode === 'intensita') {
    const sequencePenalty = Math.max(0, round.sequencePlayCount - 1) * 16;
    const cardPenalty = round.cardPreviewCount * 6;
    const timePenalty = elapsedSeconds <= 9 ? 0 : Math.ceil((elapsedSeconds - 9) * 4);
    const attemptPenalty = round.attempts * 12;
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

  const modeMultiplier = (settings.playMode === 'quadriadi' || settings.playMode === 'tipo quadriadi') ? 1.3 : (settings.playMode === 'triadi' || settings.playMode === 'tipo triade') ? 1 : 0.72;
  const playbackMultiplier = settings.playMode !== 'nota singola' && settings.playbackMode === 'melodico' ? 1.14 : 1;
  const sequencePenalty = Math.max(0, round.sequencePlayCount - 1) * Math.round(28 * modeMultiplier * playbackMultiplier);
  const cardPenalty = round.cardPreviewCount * Math.round(8 * modeMultiplier);
  const timePenalty = elapsedSeconds <= 10 ? 0 : Math.ceil((elapsedSeconds - 10) * ((settings.playMode === 'quadriadi' || settings.playMode === 'tipo quadriadi') ? 5 : (settings.playMode === 'triadi' || settings.playMode === 'tipo triade') ? 4 : 3));
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
  if (round.playMode === 'intervalli') {
    const answerCount = round.intervalQuestion?.answerOptions.length ?? 2;
    return 8 + answerCount * 2;
  }

  if (round.playMode === 'altezza' || round.playMode === 'durata' || round.playMode === 'intensita') {
    return 8 + round.slotCount * 3;
  }

  return 6 + round.slotCount * 4 + ((round.playMode === 'quadriadi' || round.playMode === 'tipo quadriadi') ? 12 : (round.playMode === 'triadi' || round.playMode === 'tipo triade') ? 4 : 0);
}

function getIntervalAnswerCount(intervalType: SettingsState['intervalType']): number {
  switch (intervalType) {
    case '5ª':
    case '5ª, 4ª, 8ª':
      return 3;
    case 'Scala maggiore':
      return 7;
    case 'Scala cromatica':
      return 14;
    default:
      return 2;
  }
}