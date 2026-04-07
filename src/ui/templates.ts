import type { AppState, ChordOption, DragSource, IntervalAnswerOption, SlotResult } from '../app/types';

const CARD_ACCENTS = ['#ffb3ba', '#ffd6a5', '#fdffb6', '#caffbf', '#bde0fe', '#cde7ff', '#d7c6ff', '#f1c0e8', '#ffc8dd', '#d9ed92'];

export function renderApp(state: AppState): string {
  const totalAnswers = state.score.roundsPlayed;
  const wrongAnswers = Math.max(0, totalAnswers - state.score.roundsSolved);
  const accuracy = state.score.roundsPlayed === 0
    ? 100
    : Math.round((state.score.roundsSolved / state.score.roundsPlayed) * 100);
  const isIntervalMode = state.settings.playMode === 'intervalli';
  const isTriadType = state.settings.playMode === 'tipo triade';
  const isTetradType = state.settings.playMode === 'tipo quadriadi';
  const isOrderingMode = state.settings.playMode === 'altezza' || state.settings.playMode === 'durata' || state.settings.playMode === 'intensita';
  const hideQuestionButton = isOrderingMode;
  const usedDegrees = new Set(state.round.placements.filter((degree): degree is number => degree !== null));
  const visibleOptions = isOrderingMode
    ? state.round.options.filter((option) => !usedDegrees.has(option.degree))
    : state.round.options;
  const showCardsPanel = !isIntervalMode && !isTriadType && !isTetradType;
  const primaryActionLabel = state.isPlaying ? 'Suona...' : getPrimaryActionLabel(state);

  return `
    <div class="playback-backdrop" data-role="playback-backdrop"></div>
    <main class="app-shell">
      <section class="topbar panel">
        <div class="brand">
          <div class="brand__badge">♪</div>
          <div class="brand__copy">
            <h1>Alleniamo l'orecchio</h1>
            <p class="brand__hint">Scegli la modalità che preferisci per allenare il tuo orecchio musicale</p>
          </div>
        </div>
        <div class="topbar__stats">
          ${statChip('Punti', String(state.score.totalPoints))}
          ${statChip('Corrette', `${state.score.roundsSolved}/${totalAnswers}`)}
          ${statChip('Sbagliate', `${wrongAnswers}/${totalAnswers}`)}
          ${statChip('Prec.', `${accuracy}%`)}
        </div>
      </section>

      <section class="panel controls-panel">
        <div class="controls-panel__row controls-panel__row--left">
          <label class="mini-control">
            <span>Modalita</span>
            <select data-setting="play-mode">
              <option value="altezza" ${state.settings.playMode === 'altezza' ? 'selected' : ''}>Altezza</option>
              <option value="durata" ${state.settings.playMode === 'durata' ? 'selected' : ''}>Durata</option>
              <option value="intensita" ${state.settings.playMode === 'intensita' ? 'selected' : ''}>Intensità</option>
              <option value="intervalli" ${state.settings.playMode === 'intervalli' ? 'selected' : ''}>Intervalli</option>
              <option value="tipo triade" ${state.settings.playMode === 'tipo triade' ? 'selected' : ''}>Tipo Triadi</option>
              <option value="tipo quadriadi" ${state.settings.playMode === 'tipo quadriadi' ? 'selected' : ''}>Tipo Quadriadi</option>
              <option value="nota singola" ${state.settings.playMode === 'nota singola' ? 'selected' : ''}>Progressione Note</option>
              <option value="triadi" ${state.settings.playMode === 'triadi' ? 'selected' : ''}>Progressione Triadi</option>
              <option value="quadriadi" ${state.settings.playMode === 'quadriadi' ? 'selected' : ''}>Progressione Quadriadi</option>
            </select>
          </label>
          ${isIntervalMode ? `
            <label class="mini-control">
              <span>Tipo di intervallo</span>
              <select data-setting="interval-type">
                <option value="2ª" ${state.settings.intervalType === '2ª' ? 'selected' : ''}>2ª</option>
                <option value="3ª" ${state.settings.intervalType === '3ª' ? 'selected' : ''}>3ª</option>
                <option value="4ª" ${state.settings.intervalType === '4ª' ? 'selected' : ''}>4ª</option>
                <option value="5ª" ${state.settings.intervalType === '5ª' ? 'selected' : ''}>5ª</option>
                <option value="6ª" ${state.settings.intervalType === '6ª' ? 'selected' : ''}>6ª</option>
                <option value="7ª" ${state.settings.intervalType === '7ª' ? 'selected' : ''}>7ª</option>
                <option value="5ª, 4ª, 8ª" ${state.settings.intervalType === '5ª, 4ª, 8ª' ? 'selected' : ''}>5ª, 4ª, 8ª</option>
                <option value="9ª" ${state.settings.intervalType === '9ª' ? 'selected' : ''}>9ª</option>
                <option value="Scala maggiore" ${state.settings.intervalType === 'Scala maggiore' ? 'selected' : ''}>Scala maggiore</option>
                <option value="Scala cromatica" ${state.settings.intervalType === 'Scala cromatica' ? 'selected' : ''}>Scala cromatica</option>
              </select>
            </label>
            <label class="mini-control">
              <span>Riproduzione</span>
              <select data-setting="interval-playback-mode">
                <option value="armonico" ${state.settings.intervalPlaybackMode === 'armonico' ? 'selected' : ''}>Armonico</option>
                <option value="melodico" ${state.settings.intervalPlaybackMode === 'melodico' ? 'selected' : ''}>Melodico</option>
                <option value="entrambi" ${state.settings.intervalPlaybackMode === 'entrambi' ? 'selected' : ''}>Entrambi</option>
              </select>
            </label>
            ${state.settings.intervalPlaybackMode === 'melodico' ? `
              <label class="mini-control">
                <span>Direzione</span>
                <select data-setting="interval-direction">
                  <option value="ascendente" ${state.settings.intervalDirection === 'ascendente' ? 'selected' : ''}>Ascendente</option>
                  <option value="discendente" ${state.settings.intervalDirection === 'discendente' ? 'selected' : ''}>Discendente</option>
                </select>
              </label>
            ` : ''}
          ` : isOrderingMode ? `
            <label class="mini-control">
              <span>Slot</span>
              <select data-setting="slot-count">
                ${Array.from({ length: 7 }, (_, offset) => offset + 2).map((value) => `<option value="${value}" ${value === state.settings.slotCount ? 'selected' : ''}>${value}</option>`).join('')}
              </select>
            </label>
          ` : isTriadType ? `
            <label class="mini-control">
              <span>Riproduzione</span>
              <select data-setting="playback-mode">
                <option value="armonico" ${state.settings.playbackMode === 'armonico' ? 'selected' : ''}>Armonico</option>
                <option value="melodico" ${state.settings.playbackMode === 'melodico' ? 'selected' : ''}>Melodico</option>
              </select>
            </label>
          ` : isTetradType ? `
            <label class="mini-control">
              <span>Riproduzione</span>
              <select data-setting="playback-mode">
                <option value="armonico" ${state.settings.playbackMode === 'armonico' ? 'selected' : ''}>Armonico</option>
                <option value="melodico" ${state.settings.playbackMode === 'melodico' ? 'selected' : ''}>Melodico</option>
              </select>
            </label>
          ` : `
            <label class="mini-control">
              <span>Slot</span>
              <select data-setting="slot-count">
                ${Array.from({ length: 7 }, (_, offset) => offset + 2).map((value) => `<option value="${value}" ${value === state.settings.slotCount ? 'selected' : ''}>${value}</option>`).join('')}
              </select>
            </label>
            <label class="mini-control">
              <span>Scala</span>
              <select data-setting="scale-family">
                <option value="maggiore" ${state.settings.scaleFamily === 'maggiore' ? 'selected' : ''}>Maggiore</option>
                <option value="minore naturale" ${state.settings.scaleFamily === 'minore naturale' ? 'selected' : ''}>Minore naturale</option>
                <option value="minore melodica" ${state.settings.scaleFamily === 'minore melodica' ? 'selected' : ''}>Minore melodica</option>
                <option value="minore armonica" ${state.settings.scaleFamily === 'minore armonica' ? 'selected' : ''}>Minore armonica</option>
              </select>
            </label>
            ${state.settings.playMode === 'nota singola' ? '' : `
              <label class="mini-control">
                <span>Riproduzione</span>
                <select data-setting="playback-mode">
                  <option value="armonico" ${state.settings.playbackMode === 'armonico' ? 'selected' : ''}>Armonico</option>
                  <option value="melodico" ${state.settings.playbackMode === 'melodico' ? 'selected' : ''}>Melodico</option>
                </select>
              </label>
            `}
          `}
        </div>
        <div class="controls-panel__row controls-panel__row--actions">
          ${hideQuestionButton ? '' : `<button class="pill pill--question" data-role="play-sequence" data-action="play-sequence">${primaryActionLabel}</button>`}
          ${isIntervalMode || isTriadType || isTetradType ? '' : '<button class="pill pill--answer" data-role="play-answer" data-action="play-answer">Ascolta risposta</button>'}
          <button class="pill pill--check" data-role="check-answer" data-action="check-answer">Verifica</button>
          ${isIntervalMode || isTriadType || isTetradType ? '' : '<button class="pill pill--reset" data-role="reset-slots" data-action="reset-slots">Pulisci</button>'}
          <button class="pill pill--new" data-role="new-round" data-action="new-round">Nuovo</button>
        </div>
      </section>

      <section class="panel board-panel${isIntervalMode ? ' board-panel--interval' : ''}">
        ${isIntervalMode ? renderIntervalBoard(state) : isTriadType ? renderTriadBoard(state) : isTetradType ? renderTetradBoard(state) : `
        <div class="sequence-strip" style="--slot-columns:${state.round.slotCount}; --slot-mobile-columns:${getBalancedSlotColumns(state.round.slotCount)};">
          ${state.round.placements.map((degree, index) => renderSlot(state, degree, index, state.round.lastCheckResults[index])).join('')}
        </div>
        <div class="feedback feedback--${state.feedbackTone}" data-role="feedback-box">
          <p data-role="feedback-text">${state.feedback}</p>
        </div>
        `}
      </section>

      ${showCardsPanel ? `
      <section class="panel cards-panel">
        <div class="card-grid" style="--card-mobile-columns:${isOrderingMode ? 4 : getBalancedCardColumns(visibleOptions.length)}; --card-mobile-min:${isOrderingMode ? '0px' : '70px'};">
          ${visibleOptions.map((chord, index) => renderPaletteCard(state, chord, index)).join('')}
        </div>
      </section>
      ` : ''}
    </main>
    <div class="app-signature" aria-hidden="true">© Emanuele Valente</div>
  `;
}

function renderIntervalBoard(state: AppState): string {
  const question = state.round.intervalQuestion;
  if (!question) {
    return '';
  }

  return `
    <div class="interval-intro">
      <p>Ascolta le due note e scegli l'intervallo corretto.</p>
    </div>
    <div class="feedback feedback--${state.feedbackTone}" data-role="feedback-box">
      <p data-role="feedback-text">${state.feedback}</p>
    </div>
    <div class="interval-answer-grid" style="--interval-answer-columns:${getIntervalAnswerColumns(question.answerOptions.length)};">
      ${question.answerOptions.map((answer, index) => renderIntervalAnswerButton(state, answer, index)).join('')}
    </div>
  `;
}

function renderTriadBoard(state: AppState): string {
  const question = state.round.triadQuestion;
  if (!question) {
    return '';
  }

  return `
    <div class="interval-intro">
      <p style="margin-bottom:12px;">Ascolta la triade e scegli la qualità corretta.</p>
    </div>
    <div class="feedback feedback--${state.feedbackTone}" data-role="feedback-box">
      <p data-role="feedback-text">${state.feedback}</p>
    </div>
    <div class="interval-answer-grid" style="--interval-answer-columns:4;">
      ${['maggiore', 'minore', 'diminuita', 'aumentata'].map((q, index) => renderTriadAnswerButton(state, q as any, index)).join('')}
    </div>
  `;
}

function renderTriadAnswerButton(state: AppState, answerId: string, index: number): string {
  const question = state.round.triadQuestion;
  const isSelected = state.round.selectedAnswerId === answerId;
  const isCorrect = question?.correctQuality === answerId;
  const revealResult = state.round.solved || state.round.locked;
  const revealCorrect = revealResult && isCorrect;
  const resultClass = revealResult
    ? isSelected
      ? isCorrect ? ' interval-choice--correct' : ' interval-choice--wrong'
      : revealCorrect ? ' interval-choice--correct' : ''
    : isSelected ? ' interval-choice--selected' : '';

  const labels: Record<string, string> = {
    maggiore: 'Maggiore',
    minore: 'Minore',
    diminuita: 'Diminuita',
    aumentata: 'Aumentata'
  };

  return `
    <button
      class="chord-card interval-choice${resultClass}"
      type="button"
      data-role="triad-answer"
      data-action="choose-triad-answer"
      data-answer-id="${answerId}"
      style="--card-accent:${CARD_ACCENTS[index % CARD_ACCENTS.length]}"
    >
      <strong>${labels[answerId]}</strong>
      <small>${labels[answerId]}</small>
      <span class="card-notes-layer" aria-hidden="true"></span>
    </button>
  `;
}

function renderTetradBoard(state: AppState): string {
  const question = state.round.tetradQuestion;
  if (!question) {
    return '';
  }

  return `
    <div class="interval-intro">
      <p style="margin-bottom:12px;">Ascolta la quadriade e scegli la qualità corretta.</p>
    </div>
    <div class="feedback feedback--${state.feedbackTone}" data-role="feedback-box">
      <p data-role="feedback-text">${state.feedback}</p>
    </div>
    <div class="interval-answer-grid" style="--interval-answer-columns:${getIntervalAnswerColumns(7)};">
      ${['maj7', 'm7', '7', 'm7b5', 'mMaj7', 'maj7#5', 'dim7'].map((q, index) => renderTetradAnswerButton(state, q as any, index)).join('')}
    </div>
  `;
}

function renderTetradAnswerButton(state: AppState, answerId: string, index: number): string {
  const question = state.round.tetradQuestion;
  const isSelected = state.round.selectedAnswerId === answerId;
  const isCorrect = question?.correctQuality === answerId;
  const revealResult = state.round.solved || state.round.locked;
  const revealCorrect = revealResult && isCorrect;
  const resultClass = revealResult
    ? isSelected
      ? isCorrect ? ' interval-choice--correct' : ' interval-choice--wrong'
      : revealCorrect ? ' interval-choice--correct' : ''
    : isSelected ? ' interval-choice--selected' : '';

  const labels: Record<string, string> = {
    maj7: 'Maj7',
    m7: 'm7',
    '7': '7',
    m7b5: 'm7b5',
    mMaj7: 'mMaj7',
    'maj7#5': 'Maj7#5',
    dim7: 'dim7'
  };

  return `
    <button
      class="chord-card interval-choice${resultClass}"
      type="button"
      data-role="tetrad-answer"
      data-action="choose-tetrad-answer"
      data-answer-id="${answerId}"
      style="--card-accent:${CARD_ACCENTS[index % CARD_ACCENTS.length]}"
    >
      <strong>${labels[answerId]}</strong>
      <small>${labels[answerId]}</small>
      <span class="card-notes-layer" aria-hidden="true"></span>
    </button>
  `;
}

function renderSlot(state: AppState, degree: number | null, index: number, result: SlotResult): string {
  const assigned = degree === null ? null : state.round.options[degree];
  const resultClass = result ? ` slot--${result}` : '';

  return `
    <div class="slot${assigned ? ' slot--filled' : ''}${resultClass}" data-slot-index="${index}">
      <div class="slot__index">${index + 1}</div>
      <div class="slot__body">
        ${assigned ? renderCardMarkup(state, assigned, {
          accent: CARD_ACCENTS[assigned.degree % CARD_ACCENTS.length],
          sourceType: 'slot',
          sourceSlot: index,
          compact: true
        }) : '<div class="slot__empty"></div>'}
      </div>
    </div>
  `;
}

function renderPaletteCard(state: AppState, chord: ChordOption, index: number): string {
  return renderCardMarkup(state, chord, {
    accent: CARD_ACCENTS[chord.degree % CARD_ACCENTS.length],
    sourceType: 'palette',
    sourceSlot: null,
    compact: false
  });
}

function renderIntervalAnswerButton(state: AppState, answer: IntervalAnswerOption, index: number): string {
  const question = state.round.intervalQuestion;
  const isSelected = state.round.selectedAnswerId === answer.id;
  const isCorrect = question?.correctAnswerId === answer.id;
  const revealResult = state.round.solved || state.round.locked;
  const revealCorrect = revealResult && isCorrect;
  const resultClass = revealResult
    ? isSelected
      ? isCorrect ? ' interval-choice--correct' : ' interval-choice--wrong'
      : revealCorrect ? ' interval-choice--correct' : ''
    : isSelected ? ' interval-choice--selected' : '';

  return `
    <button
      class="chord-card interval-choice${resultClass}"
      type="button"
      data-role="interval-answer"
      data-action="choose-interval-answer"
      data-answer-id="${answer.id}"
      style="--card-accent:${CARD_ACCENTS[index % CARD_ACCENTS.length]}"
    >
      <span class="chord-card__numeral">Intervallo</span>
      <strong>${answer.shortLabel}</strong>
      <small>${answer.label}</small>
      <span class="card-notes-layer" aria-hidden="true"></span>
    </button>
  `;
}

function renderCardMarkup(
  state: AppState,
  chord: ChordOption,
  options: { accent: string; sourceType: DragSource; sourceSlot: number | null; compact: boolean; }
): string {
  if (state.settings.playMode === 'altezza' || state.settings.playMode === 'durata' || state.settings.playMode === 'intensita') {
    return renderOrderingCardMarkup(chord, options);
  }

  const sourceSlot = options.sourceSlot === null ? '' : ` data-origin-slot="${options.sourceSlot}"`;
  const compactClass = options.compact ? ' chord-card--slot' : '';

  return `
    <button
      class="chord-card${compactClass}"
      type="button"
      data-source="${options.sourceType}"
      data-degree="${chord.degree}"
      style="--card-accent:${options.accent}"
      ${sourceSlot}
    >
      <span class="chord-card__numeral">${chord.numeral}</span>
      <strong>${chord.symbol}</strong>
      <small>${chord.notes.join(' · ')}</small>
      <span class="card-notes-layer" aria-hidden="true"></span>
    </button>
  `;
}

function renderOrderingCardMarkup(
  chord: ChordOption,
  options: { accent: string; sourceType: DragSource; sourceSlot: number | null; compact: boolean; }
): string {
  const sourceSlot = options.sourceSlot === null ? '' : ` data-origin-slot="${options.sourceSlot}"`;
  const compactClass = options.compact ? ' chord-card--slot' : '';

  return `
    <button
      class="chord-card chord-card--ordering${compactClass}"
      type="button"
      data-source="${options.sourceType}"
      data-degree="${chord.degree}"
      style="--card-accent:${options.accent}"
      ${sourceSlot}
    >
      <strong class="chord-card__glyph">♪</strong>
      <span class="card-notes-layer" aria-hidden="true"></span>
    </button>
  `;
}

function statChip(label: string, value: string): string {
  return `
    <div class="stat-chip">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function getBalancedSlotColumns(slotCount: number): number {
  return slotCount <= 4 ? slotCount : Math.ceil(slotCount / 2);
}

function getIntervalAnswerColumns(answerCount: number): number {
  return Math.min(answerCount >= 7 ? 4 : answerCount, 4);
}

function getBalancedCardColumns(cardCount: number): number {
  if (cardCount <= 0) {
    return 1;
  }

  return cardCount <= 4 ? cardCount : Math.ceil(cardCount / 2);
}

function getPrimaryActionLabel(state: AppState): string {
  if (state.settings.playMode === 'intervalli') {
    return state.round.solved || state.round.locked ? 'Prossima domanda' : 'Ascolta domanda';
  }

  return state.round.solved ? 'Prossima domanda' : 'Ascolta domanda';
}