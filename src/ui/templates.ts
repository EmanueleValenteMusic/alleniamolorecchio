import type { AppState, ChordOption, DragSource, SlotResult } from '../app/types';

const CARD_ACCENTS = ['#ffb7d5', '#ffd98e', '#bce6ff', '#bdf2c5', '#d2c4ff', '#ffd0ae', '#ffe69c'];

export function renderApp(state: AppState): string {
  const accuracy = state.score.roundsPlayed === 0
    ? 100
    : Math.round((state.score.roundsSolved / state.score.roundsPlayed) * 100);

  return `
    <div class="playback-backdrop" data-role="playback-backdrop"></div>
    <main class="app-shell">
      <section class="topbar panel">
        <div class="brand">
          <div class="brand__badge">♪</div>
          <div class="brand__copy">
            <h1>Progressioni</h1>
            <p>${state.round.scale.key}</p>
            <p class="brand__hint">Ascolta la sequenza e ricostruiscila trascinando gli accordi.</p>
          </div>
        </div>
        <div class="topbar__stats">
          ${statChip('Punti', String(state.score.totalPoints))}
          ${statChip('Risposte', String(state.score.roundsPlayed))}
          ${statChip('Prec.', `${accuracy}%`)}
        </div>
      </section>

      <section class="panel controls-panel">
        <div class="controls-panel__row controls-panel__row--left">
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
          <label class="mini-control">
            <span>Modalita</span>
            <select data-setting="play-mode">
              <option value="nota singola" ${state.settings.playMode === 'nota singola' ? 'selected' : ''}>Nota singola</option>
              <option value="triadi" ${state.settings.playMode === 'triadi' ? 'selected' : ''}>Triadi</option>
              <option value="quadriadi" ${state.settings.playMode === 'quadriadi' ? 'selected' : ''}>Quadriadi</option>
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
        </div>
        <div class="controls-panel__row controls-panel__row--actions">
          <button class="pill pill--play" data-role="play-sequence" data-action="play-sequence">Ascolta</button>
          <button class="pill" data-role="check-answer" data-action="check-answer">Verifica</button>
          <button class="pill" data-role="reset-slots" data-action="reset-slots">Pulisci</button>
          <button class="pill pill--soft" data-role="new-round" data-action="new-round">Nuovo</button>
        </div>
      </section>

      <section class="panel board-panel">
        <div class="sequence-strip" style="--slot-columns:${state.round.slotCount}; --slot-mobile-columns:${getBalancedSlotColumns(state.round.slotCount)};">
          ${state.round.placements.map((degree, index) => renderSlot(state, degree, index, state.round.lastCheckResults[index])).join('')}
        </div>
        <div class="feedback feedback--${state.feedbackTone}" data-role="feedback-box">
          <p data-role="feedback-text">${state.feedback}</p>
        </div>
      </section>

      <section class="panel cards-panel">
        <div class="card-grid">
          ${state.round.options.map((chord, index) => renderPaletteCard(chord, index)).join('')}
        </div>
      </section>
    </main>
  `;
}

function renderSlot(state: AppState, degree: number | null, index: number, result: SlotResult): string {
  const assigned = degree === null ? null : state.round.options[degree];
  const resultClass = result ? ` slot--${result}` : '';

  return `
    <div class="slot${assigned ? ' slot--filled' : ''}${resultClass}" data-slot-index="${index}">
      <div class="slot__index">${index + 1}</div>
      <div class="slot__body">
        ${assigned ? renderCardMarkup(assigned, {
          accent: CARD_ACCENTS[assigned.degree % CARD_ACCENTS.length],
          sourceType: 'slot',
          sourceSlot: index,
          compact: true
        }) : '<div class="slot__empty"></div>'}
      </div>
    </div>
  `;
}

function renderPaletteCard(chord: ChordOption, index: number): string {
  return renderCardMarkup(chord, {
    accent: CARD_ACCENTS[index % CARD_ACCENTS.length],
    sourceType: 'palette',
    sourceSlot: null,
    compact: false
  });
}

function renderCardMarkup(
  chord: ChordOption,
  options: { accent: string; sourceType: DragSource; sourceSlot: number | null; compact: boolean; }
): string {
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