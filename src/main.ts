import { PianoEngine } from './audio/piano';
import { computeScoreBreakdown, getMistakePenalty } from './app/scoring';
import { createRound, evaluatePlacements } from './app/rounds';
import { clampSlotCount, loadScore, loadSettings, persistScore, persistSettings } from './app/storage';
import type {
  AppState,
  ChordOption,
  DragState,
  FeedbackTone,
  IntervalDirection,
  IntervalPlaybackModeSetting,
  IntervalType,
  PlaybackMode,
  PlayMode,
  ScaleFamily,
  SettingsState
} from './app/types';
import { syncLiveUi } from './ui/live';
import { renderApp } from './ui/templates';

const CARD_ACCENTS = ['#ffb7d5', '#ffd98e', '#bce6ff', '#bdf2c5', '#d2c4ff', '#ffd0ae', '#ffe69c'];

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Elemento #app non trovato');
}

const appRoot = appElement;
const initialSettings = loadSettings();
const piano = new PianoEngine();

const state: AppState = {
  settings: initialSettings,
  score: loadScore(),
  round: createRound(initialSettings),
  feedback: '',
  feedbackTone: 'idle',
  isPlaying: false,
  audioReady: false
};

let dragState: DragState | null = null;
let playbackTimerId: number | null = null;
let backgroundResetTimerId: number | null = null;
let backdropNotesIntervalId: number | null = null;
let backdropNotesStopTimerId: number | null = null;

render();

document.addEventListener('pointermove', handlePointerMove);
document.addEventListener('pointerup', handlePointerUp);
document.addEventListener('pointercancel', handlePointerUp);

function render(): void {
  appRoot.innerHTML = renderApp(state);
  bindUi();
  syncLiveUi(appRoot, state);
}

function bindUi(): void {
  appRoot.querySelector('[data-action="play-sequence"]')?.addEventListener('click', () => {
    void playSequence();
  });

  appRoot.querySelector('[data-action="play-answer"]')?.addEventListener('click', () => {
    void playAnswer();
  });

  appRoot.querySelector('[data-action="check-answer"]')?.addEventListener('click', () => {
    checkAnswer();
  });

  appRoot.querySelector('[data-action="reset-slots"]')?.addEventListener('click', () => {
    if (state.isPlaying || state.round.locked) {
      return;
    }

    state.round.placements = Array.from({ length: state.round.slotCount }, () => null);
    state.round.lastCheckResults = Array.from({ length: state.round.slotCount }, () => null);
    setFeedback('', 'idle');
    render();
  });

  appRoot.querySelector('[data-action="new-round"]')?.addEventListener('click', () => {
    if (state.isPlaying) {
      return;
    }

    startNewRound('');
  });

  appRoot.querySelectorAll<HTMLSelectElement>('[data-setting]').forEach((select) => {
    select.addEventListener('change', handleSettingsChange);
  });

  appRoot.querySelectorAll<HTMLElement>('.chord-card[data-source]').forEach((card) => {
    card.addEventListener('pointerdown', handleCardPointerDown);
  });

  appRoot.querySelectorAll<HTMLButtonElement>('[data-action="choose-interval-answer"]').forEach((button) => {
    button.addEventListener('click', () => {
      chooseIntervalAnswer(button.dataset.answerId ?? '', button);
    });
  });
}

function handleSettingsChange(): void {
  if (state.isPlaying) {
    return;
  }

  const slotCountValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="slot-count"]')?.value;
  const scaleFamilyValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="scale-family"]')?.value;
  const playModeValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="play-mode"]')?.value;
  const playbackModeValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="playback-mode"]')?.value;
  const intervalTypeValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="interval-type"]')?.value;
  const intervalPlaybackModeValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="interval-playback-mode"]')?.value;
  const intervalDirectionValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="interval-direction"]')?.value;
  const nextSettings: SettingsState = {
    slotCount: clampSlotCount(Number(slotCountValue)),
    scaleFamily: isScaleFamily(scaleFamilyValue) ? scaleFamilyValue : 'maggiore',
    playMode: isPlayMode(playModeValue) ? playModeValue : 'triadi',
    playbackMode: playbackModeValue === 'melodico' ? 'melodico' : 'armonico',
    intervalType: isIntervalType(intervalTypeValue) ? intervalTypeValue : '2ª',
    intervalPlaybackMode: isIntervalPlaybackMode(intervalPlaybackModeValue) ? intervalPlaybackModeValue : 'armonico',
    intervalDirection: intervalDirectionValue === 'discendente' ? 'discendente' : 'ascendente'
  };

  if (nextSettings.playMode === 'nota singola') {
    nextSettings.playbackMode = 'armonico';
  }

  if (
    nextSettings.slotCount === state.settings.slotCount
    && nextSettings.scaleFamily === state.settings.scaleFamily
    && nextSettings.playMode === state.settings.playMode
    && nextSettings.playbackMode === state.settings.playbackMode
    && nextSettings.intervalType === state.settings.intervalType
    && nextSettings.intervalPlaybackMode === state.settings.intervalPlaybackMode
    && nextSettings.intervalDirection === state.settings.intervalDirection
  ) {
    return;
  }

  state.settings = nextSettings;
  persistSettings(nextSettings);
  startNewRound('');
}

function handleCardPointerDown(event: PointerEvent): void {
  if (state.isPlaying) {
    return;
  }

  const source = event.currentTarget as HTMLElement;
  dragState = {
    pointerId: event.pointerId,
    degree: Number(source.dataset.degree),
    startX: event.clientX,
    startY: event.clientY,
    dragging: false,
    ghost: null,
    source,
    hoverSlot: null,
    sourceType: source.dataset.source === 'slot' ? 'slot' : 'palette',
    sourceSlot: source.dataset.originSlot ? Number(source.dataset.originSlot) : null
  };

  source.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  if (state.round.locked) {
    return;
  }

  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (!dragState.dragging && distance > 10) {
    dragState.dragging = true;
    dragState.ghost = createGhost(dragState.source);
    dragState.source.classList.add('is-ghosted');
    document.body.classList.add('is-dragging');
  }

  if (!dragState.dragging || !dragState.ghost) {
    return;
  }

  dragState.ghost.style.transform = `translate(${event.clientX - 88}px, ${event.clientY - 64}px)`;
  const slotIndex = getSlotIndexFromPoint(event.clientX, event.clientY);
  if (slotIndex !== dragState.hoverSlot) {
    dragState.hoverSlot = slotIndex;
    setHoveredSlot(slotIndex);
  }
}

function handlePointerUp(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  dragState.source.releasePointerCapture(event.pointerId);

  if (!dragState.dragging) {
    void previewChord(dragState.degree, dragState.source);
    cleanupDrag();
    return;
  }

  const slotIndex = getSlotIndexFromPoint(event.clientX, event.clientY);
  if (slotIndex !== null) {
    state.round.placements[slotIndex] = dragState.degree;
    if (dragState.sourceType === 'slot' && dragState.sourceSlot !== null && dragState.sourceSlot !== slotIndex) {
      state.round.placements[dragState.sourceSlot] = null;
    }
  } else if (dragState.sourceType === 'slot' && dragState.sourceSlot !== null) {
    state.round.placements[dragState.sourceSlot] = null;
  }

  state.round.lastCheckResults = Array.from({ length: state.round.slotCount }, () => null);
  clearPlacementHintIfNeeded();
  cleanupDrag();
  render();
}

function cleanupDrag(): void {
  if (dragState?.ghost) {
    dragState.ghost.remove();
  }

  dragState?.source.classList.remove('is-ghosted');
  document.body.classList.remove('is-dragging');
  setHoveredSlot(null);
  dragState = null;
}

function createGhost(source: HTMLElement): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement;
  const rect = source.getBoundingClientRect();
  ghost.classList.remove('chord-card--slot');
  ghost.classList.add('drag-ghost');
  ghost.style.width = `${Math.round(rect.width)}px`;
  ghost.style.height = `${Math.round(rect.height)}px`;
  ghost.style.minHeight = `${Math.round(rect.height)}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function getSlotIndexFromPoint(x: number, y: number): number | null {
  const slots = Array.from(appRoot.querySelectorAll<HTMLElement>('[data-slot-index]'));
  const hit = slots.find((slot) => {
    const rect = slot.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });

  return hit ? Number(hit.dataset.slotIndex) : null;
}

function setHoveredSlot(slotIndex: number | null): void {
  appRoot.querySelectorAll<HTMLElement>('.slot').forEach((slot) => {
    slot.classList.toggle('slot--hover', slotIndex !== null && Number(slot.dataset.slotIndex) === slotIndex);
  });
}

async function previewChord(degree: number, source?: HTMLElement): Promise<void> {
  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  state.round.cardPreviewCount += 1;
  const option = state.round.options[degree];
  const duration = playOption(option, state.settings.playMode, state.settings.playbackMode, { preview: true });
  pulseCardBackground(getCardAccent(degree), duration * 1000 + 120);
  animateCardTap(source, getCardAccent(degree));
  syncLiveUi(appRoot, state);
}

async function playSequence(): Promise<void> {
  if (state.settings.playMode === 'intervalli') {
    if (state.round.solved || state.round.locked) {
      startNewRound('');
    }

    await playIntervalQuestion();
    return;
  }

  if (state.round.solved) {
    startNewRound('');
  }

  if (state.isPlaying) {
    return;
  }

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  state.round.sequencePlayCount += 1;
  syncLiveUi(appRoot, state);

  const spacing = getSequenceStep(state.settings.playMode, state.settings.playbackMode);
  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  pulseSequenceBackground(Math.ceil((state.round.slotCount * spacing + 0.4) * 1000));

  state.round.solution.forEach((degree, index) => {
    playOption(state.round.options[degree], state.settings.playMode, state.settings.playbackMode, {
      preview: false,
      when: startAt + index * spacing
    });
  });

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    state.round.sequenceFinishedAt = Date.now();
    if (state.round.answerWindowStartedAt === null) {
      state.round.answerWindowStartedAt = state.round.sequenceFinishedAt;
    }

    syncLiveUi(appRoot, state);
  }, Math.ceil((state.round.slotCount * spacing + 0.4) * 1000));
}

async function playIntervalQuestion(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const question = state.round.intervalQuestion;
  if (!question) {
    return;
  }

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  state.round.sequencePlayCount += 1;
  syncLiveUi(appRoot, state);

  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  const durationMs = playIntervalPrompt(question, startAt);
  pulseSequenceBackground(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    state.round.sequenceFinishedAt = Date.now();
    if (state.round.answerWindowStartedAt === null) {
      state.round.answerWindowStartedAt = state.round.sequenceFinishedAt;
    }

    syncLiveUi(appRoot, state);
  }, durationMs);
}

async function playAnswer(): Promise<void> {
  if (state.settings.playMode === 'intervalli') {
    return;
  }

  if (state.isPlaying) {
    return;
  }

  const chosenPlacements = state.round.placements.flatMap((degree, slotIndex) => {
    if (degree === null) {
      return [];
    }

    return [{ degree, slotIndex }];
  });

  if (chosenPlacements.length === 0) {
    setFeedback('Inserisci almeno uno slot', 'info');
    return;
  }

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  syncLiveUi(appRoot, state);

  const spacing = getSequenceStep(state.settings.playMode, state.settings.playbackMode);
  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  const durationMs = Math.ceil((chosenPlacements.length * spacing + 0.4) * 1000);
  pulseSequenceBackground(durationMs);
  animateAnswerSlots(chosenPlacements, spacing, currentRoundId);

  chosenPlacements.forEach(({ degree }, index) => {
    playOption(state.round.options[degree], state.settings.playMode, state.settings.playbackMode, {
      preview: false,
      when: startAt + index * spacing
    });
  });

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function chooseIntervalAnswer(answerId: string, source: HTMLElement): void {
  if (!answerId || state.isPlaying || state.round.locked || state.round.solved) {
    return;
  }

  const question = state.round.intervalQuestion;
  if (!question) {
    return;
  }

  state.round.selectedAnswerId = answerId;
  if (state.feedback === 'Scegli una risposta' && state.feedbackTone === 'info') {
    setFeedback('', 'idle');
  }

  animateCardTap(source, getCardAccent(question.answerOptions.findIndex((option) => option.id === answerId)));
  render();
  void previewIntervalAnswer(answerId);
}

async function previewIntervalAnswer(answerId: string): Promise<void> {
  const question = state.round.intervalQuestion;
  if (!question) {
    return;
  }

  const answer = question.answerOptions.find((option) => option.id === answerId);
  const answerIndex = question.answerOptions.findIndex((option) => option.id === answerId);
  if (!answer) {
    return;
  }

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  syncLiveUi(appRoot, state);

  const previewQuestion = {
    ...question,
    midi: buildIntervalMidi(question.baseMidi, answer.semitones, question.playbackMode, question.direction)
  };
  const currentRoundId = state.round.id;
  const startAt = piano.currentTime + 0.01;
  const durationMs = playIntervalPrompt(previewQuestion, startAt);
  pulseCardBackground(getCardAccent(answerIndex), durationMs);
  startBackdropNotes(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function finalizeIntervalAnswer(answerId: string): void {
  const question = state.round.intervalQuestion;
  if (!question) {
    return;
  }

  if (!state.round.counted) {
    state.score.roundsPlayed += 1;
    state.round.counted = true;
  }

  state.round.selectedAnswerId = answerId;
  const correct = answerId === question.correctAnswerId;

  if (correct) {
    const breakdown = computeScoreBreakdown(state.round, state.settings);
    state.score.totalPoints = Math.max(0, state.score.totalPoints + breakdown.earned);
    state.score.streak += 1;
    state.score.bestStreak = Math.max(state.score.bestStreak, state.score.streak);
    state.score.roundsSolved += 1;
    state.round.solved = true;
    persistScore(state.score);
    setFeedback(`+${breakdown.earned}`, 'success');
    render();
    return;
  }

  state.round.attempts += 1;
  state.round.locked = true;
  state.score.streak = 0;
  state.score.totalPoints = Math.max(0, state.score.totalPoints - getMistakePenalty(state.round));
  persistScore(state.score);
  const correctLabel = question.answerOptions.find((option) => option.id === question.correctAnswerId)?.label ?? 'Risposta corretta';
  setFeedback(`Era ${correctLabel}`, 'error');
  render();
}

function checkIntervalAnswer(): void {
  if (state.isPlaying || state.round.locked || state.round.solved) {
    return;
  }

  if (!state.round.selectedAnswerId) {
    setFeedback('Scegli una risposta', 'info');
    return;
  }

  finalizeIntervalAnswer(state.round.selectedAnswerId);
}

function checkAnswer(): void {
  if (state.settings.playMode === 'intervalli') {
    checkIntervalAnswer();
    return;
  }

  if (state.isPlaying) {
    return;
  }

  if (state.round.locked) {
    return;
  }

  if (state.round.sequencePlayCount === 0) {
    setFeedback('Ascolta prima', 'error');
    return;
  }

  if (state.round.placements.some((degree) => degree === null)) {
    setFeedback('Completa gli slot', 'error');
    return;
  }

  if (!state.round.counted) {
    state.score.roundsPlayed += 1;
    state.round.counted = true;
  }

  state.round.lastCheckResults = evaluatePlacements(state.round);
  const correct = state.round.lastCheckResults.every((result) => result === 'correct');

  if (correct) {
    const breakdown = computeScoreBreakdown(state.round, state.settings);
    state.score.totalPoints = Math.max(0, state.score.totalPoints + breakdown.earned);
    state.score.streak += 1;
    state.score.bestStreak = Math.max(state.score.bestStreak, state.score.streak);
    state.score.roundsSolved += 1;
    state.round.solved = true;
    persistScore(state.score);
    setFeedback(`+${breakdown.earned}`, 'success');
    render();
    return;
  }

  state.round.attempts += 1;
  state.round.locked = true;
  state.score.streak = 0;
  state.score.totalPoints = Math.max(0, state.score.totalPoints - getMistakePenalty(state.round));
  persistScore(state.score);
  const correctCount = state.round.lastCheckResults.filter((result) => result === 'correct').length;
  const correctSequence = state.round.solution
    .map((degree) => state.round.options[degree].symbol)
    .join(' · ');
  setFeedback(`${correctCount}/${state.round.slotCount} · ${correctSequence}`, 'error');
  render();
}

function startNewRound(message: string): void {
  clearPendingTimers();
  state.isPlaying = false;
  state.round = createRound(state.settings);
  setFeedback(message, message ? 'info' : 'idle');
  render();
}

function setFeedback(message: string, tone: FeedbackTone): void {
  state.feedback = message;
  state.feedbackTone = tone;
  syncLiveUi(appRoot, state);
}

function clearPlacementHintIfNeeded(): void {
  if (state.feedback !== 'Inserisci almeno uno slot' || state.feedbackTone !== 'info') {
    return;
  }

  if (state.round.placements.every((degree) => degree === null)) {
    return;
  }

  setFeedback('', 'idle');
}

function clearPendingTimers(): void {
  if (playbackTimerId !== null) {
    window.clearTimeout(playbackTimerId);
    playbackTimerId = null;
  }

  if (backgroundResetTimerId !== null) {
    window.clearTimeout(backgroundResetTimerId);
    backgroundResetTimerId = null;
  }

  if (backdropNotesIntervalId !== null) {
    window.clearInterval(backdropNotesIntervalId);
    backdropNotesIntervalId = null;
  }

  if (backdropNotesStopTimerId !== null) {
    window.clearTimeout(backdropNotesStopTimerId);
    backdropNotesStopTimerId = null;
  }

  resetPlaybackBackdrop();
}

function pulseCardBackground(color: string, durationMs: number): void {
  const lighter = lightenHex(color, 0.24);
  showPlaybackBackdrop(lighter, durationMs + 120);
}

function pulseSequenceBackground(durationMs: number): void {
  showPlaybackBackdrop('linear-gradient(135deg, #ffe98f 0%, #ffbfd9 28%, #c7e8ff 55%, #d8ccff 78%, #bfecc6 100%)', durationMs + 160);
  startBackdropNotes(durationMs);
}

function showPlaybackBackdrop(background: string, durationMs: number): void {
  const backdrop = getPlaybackBackdrop();
  if (!backdrop) {
    return;
  }

  if (backgroundResetTimerId !== null) {
    window.clearTimeout(backgroundResetTimerId);
  }

  backdrop.style.background = background;
  backdrop.classList.add('playback-backdrop--visible');

  backgroundResetTimerId = window.setTimeout(() => {
    resetPlaybackBackdrop();
    backgroundResetTimerId = null;
  }, durationMs);
}

function getPlaybackBackdrop(): HTMLElement | null {
  return appRoot.querySelector<HTMLElement>('[data-role="playback-backdrop"]');
}

function resetPlaybackBackdrop(): void {
  const backdrop = getPlaybackBackdrop();
  if (!backdrop) {
    return;
  }

  backdrop.classList.remove('playback-backdrop--visible');
  backdrop.replaceChildren();
}

function getCardAccent(degree: number): string {
  const safeIndex = degree >= 0 ? degree : 0;
  return CARD_ACCENTS[safeIndex % CARD_ACCENTS.length];
}

function playIntervalPrompt(question: NonNullable<AppState['round']['intervalQuestion']>, startAt: number): number {
  if (question.playbackMode === 'armonico') {
    piano.playSingle(question.midi[0], { when: startAt, duration: 1.02, velocity: 0.34 });
    piano.playSingle(question.midi[1], { when: startAt, duration: 1.02, velocity: 0.34 });
    return 1180;
  }

  piano.playSingle(question.midi[0], { when: startAt, duration: 0.78, velocity: 0.34 });
  piano.playSingle(question.midi[1], { when: startAt + 0.64, duration: 0.78, velocity: 0.34 });
  return 1880;
}

function buildIntervalMidi(baseMidi: number, semitones: number, playbackMode: PlaybackMode, direction: IntervalDirection): number[] {
  const lowMidi = baseMidi;
  const highMidi = baseMidi + semitones;

  if (playbackMode === 'melodico' && direction === 'discendente') {
    return [highMidi, lowMidi];
  }

  return [lowMidi, highMidi];
}

function playOption(
  option: ChordOption,
  playMode: PlayMode,
  playbackMode: PlaybackMode,
  options: { preview: boolean; when?: number }
): number {
  const when = options.when;

  if (playMode === 'nota singola') {
    const duration = options.preview ? 0.86 : 0.76;
    piano.playSingle(option.midi[0], { when, duration, velocity: options.preview ? 0.34 : 0.36 });
    return duration;
  }

  if (playbackMode === 'melodico') {
    const step = playMode === 'quadriadi' ? 0.23 : 0.26;
    const noteDuration = playMode === 'quadriadi' ? 0.42 : 0.46;
    piano.playArpeggio(option.midi, { when, step, noteDuration, velocity: options.preview ? 0.32 : 0.34 });
    return noteDuration + step * Math.max(0, option.midi.length - 1);
  }

  const duration = playMode === 'quadriadi' ? 1.08 : 0.98;
  piano.playChord(option.midi, { when, duration, velocity: options.preview ? 0.33 : 0.36 });
  return duration;
}

function getSequenceStep(playMode: PlayMode, playbackMode: PlaybackMode): number {
  if (playMode === 'nota singola') {
    return 0.86;
  }

  if (playbackMode === 'melodico') {
    return playMode === 'quadriadi' ? 1.18 : 1.08;
  }

  return playMode === 'quadriadi' ? 1.2 : 1.08;
}

function animateCardTap(source: HTMLElement | undefined, accent: string): void {
  if (!source) {
    return;
  }

  source.classList.remove('chord-card--tapped');
  void source.offsetWidth;
  source.classList.add('chord-card--tapped');
  window.setTimeout(() => {
    source.classList.remove('chord-card--tapped');
  }, 320);

  const layer = source.querySelector<HTMLElement>('.card-notes-layer');
  if (!layer) {
    return;
  }

  Array.from({ length: 3 }, (_, index) => index).forEach((index) => {
    const note = document.createElement('span');
    note.className = 'floating-note';
    note.textContent = sampleNoteGlyph();
    note.style.left = `${18 + Math.random() * 58}%`;
    note.style.top = `${4 + Math.random() * 14}%`;
    note.style.color = 'rgba(99, 70, 58, 0.92)';
    note.style.animationDelay = `${index * 40}ms`;
    layer.appendChild(note);
    window.setTimeout(() => {
      note.remove();
    }, 900);
  });
}

function animateAnswerSlots(
  chosenPlacements: Array<{ degree: number; slotIndex: number }>,
  spacing: number,
  roundId: number
): void {
  chosenPlacements.forEach(({ degree, slotIndex }, index) => {
    window.setTimeout(() => {
      if (state.round.id !== roundId) {
        return;
      }

      const slotCard = appRoot.querySelector<HTMLElement>(`[data-slot-index="${slotIndex}"] .chord-card`);
      animateCardTap(slotCard ?? undefined, getCardAccent(degree));
    }, Math.round((0.08 + index * spacing) * 1000));
  });
}

function startBackdropNotes(durationMs: number): void {
  const backdrop = getPlaybackBackdrop();
  if (!backdrop) {
    return;
  }

  backdrop.querySelectorAll('.backdrop-note').forEach((note) => note.remove());
  spawnBackdropNotesBurst(backdrop, 10);

  if (backdropNotesIntervalId !== null) {
    window.clearInterval(backdropNotesIntervalId);
  }

  if (backdropNotesStopTimerId !== null) {
    window.clearTimeout(backdropNotesStopTimerId);
  }

  backdropNotesIntervalId = window.setInterval(() => {
    spawnBackdropNotesBurst(backdrop, 6);
  }, 260);

  backdropNotesStopTimerId = window.setTimeout(() => {
    if (backdropNotesIntervalId !== null) {
      window.clearInterval(backdropNotesIntervalId);
      backdropNotesIntervalId = null;
    }
    backdropNotesStopTimerId = null;
  }, durationMs);
}

function spawnBackdropNotesBurst(backdrop: HTMLElement, count: number): void {
  Array.from({ length: count }, (_, index) => index).forEach((index) => {
    const note = document.createElement('span');
    note.className = 'backdrop-note';
    note.textContent = sampleNoteGlyph();
    note.style.left = `${2 + Math.random() * 94}%`;
    note.style.top = `${52 + Math.random() * 34}%`;
    note.style.animationDelay = `${index * 36}ms`;
    backdrop.appendChild(note);
    window.setTimeout(() => {
      note.remove();
    }, 1700 + index * 36);
  });
}

function sampleNoteGlyph(): string {
  const glyphs = ['♪', '♫', '♬'];
  return glyphs[Math.floor(Math.random() * glyphs.length)];
}

function isScaleFamily(value: string | undefined): value is ScaleFamily {
  return value === 'maggiore' || value === 'minore naturale' || value === 'minore melodica' || value === 'minore armonica';
}

function isPlayMode(value: string | undefined): value is PlayMode {
  return value === 'intervalli' || value === 'nota singola' || value === 'triadi' || value === 'quadriadi';
}

function isIntervalType(value: string | undefined): value is IntervalType {
  return value === '2ª'
    || value === '3ª'
    || value === '4ª'
    || value === '5ª'
    || value === '6ª'
    || value === '7ª'
    || value === '5ª, 4ª, 8ª'
    || value === '9ª'
    || value === 'Scala maggiore'
    || value === 'Scala cromatica';
}

function isIntervalPlaybackMode(value: string | undefined): value is IntervalPlaybackModeSetting {
  return value === 'armonico' || value === 'melodico' || value === 'entrambi';
}

function lightenHex(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const channels = normalized.length === 3
    ? normalized.split('').map((value) => parseInt(value + value, 16))
    : [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));

  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
