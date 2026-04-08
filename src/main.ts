import { PianoEngine } from './audio/piano';
import { computeScoreBreakdown, getMistakePenalty } from './app/scoring';
import { createRound, evaluatePlacements } from './app/rounds';
import { clampSlotCount, loadScore, loadSettings, persistScore, persistSettings, createEmptyScore } from './app/storage';
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

const CARD_ACCENTS = ['#ffb3ba', '#ffd6a5', '#fdffb6', '#caffbf', '#bde0fe', '#cde7ff', '#d7c6ff', '#f1c0e8', '#ffc8dd', '#d9ed92'];

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Elemento #app non trovato');
}

const appRoot = appElement;
const initialSettings = loadSettings();
const piano = new PianoEngine();
const initialRound = createRound(initialSettings);

const state: AppState = {
  settings: initialSettings,
  score: loadScore(),
  round: initialRound,
  feedback: initialRound.orderingChallenge?.prompt ?? '',
  feedbackTone: initialRound.orderingChallenge ? 'info' : 'idle',
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
document.addEventListener('keydown', handleKeyDown as EventListener);

function handleKeyDown(event: KeyboardEvent): void {
  // CMD+0 clears score statistics
  if ((event.metaKey || event.ctrlKey) && event.key === '0') {
    event.preventDefault();
    state.score = createEmptyScore();
    persistScore(state.score);
    render();
  }
}

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
    if (state.isPlaying || state.round.locked || state.round.solved) {
      return;
    }

    state.round.placements = Array.from({ length: state.round.slotCount }, () => null);
    state.round.lastCheckResults = Array.from({ length: state.round.slotCount }, () => null);
    restoreContextualFeedback();
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
  appRoot.querySelectorAll<HTMLButtonElement>('[data-action="choose-triad-answer"]')?.forEach((button) => {
    button.addEventListener('click', () => {
      chooseTriadAnswer(button.dataset.answerId ?? '', button);
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>('[data-action="choose-tetrad-answer"]')?.forEach((button) => {
    button.addEventListener('click', () => {
      chooseTetradAnswer(button.dataset.answerId ?? '', button);
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
  const intervalDifficultyValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="interval-difficulty"]')?.value;
  const typeDifficultyValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="type-difficulty"]')?.value;
  const noteNamingValue = appRoot.querySelector<HTMLSelectElement>('[data-setting="note-naming"]')?.value;
  const nextSettings: SettingsState = {
    slotCount: clampSlotCount(Number(slotCountValue)),
    scaleFamily: isScaleFamily(scaleFamilyValue) ? scaleFamilyValue : 'maggiore',
    playMode: isPlayMode(playModeValue) ? playModeValue : 'triadi',
    playbackMode: playbackModeValue === 'melodico' ? 'melodico' : 'armonico',
    intervalType: isIntervalType(intervalTypeValue) ? intervalTypeValue : '2ª',
    intervalPlaybackMode: isIntervalPlaybackMode(intervalPlaybackModeValue) ? intervalPlaybackModeValue : 'armonico',
    intervalDirection: intervalDirectionValue === 'discendente' ? 'discendente' : 'ascendente'
    ,intervalDifficulty: intervalDifficultyValue === 'difficile' ? 'difficile' : 'facile'
    ,typeDifficulty: typeDifficultyValue === 'difficile' ? 'difficile' : 'facile'
    ,noteNaming: noteNamingValue === 'eng' ? 'eng' : 'ita'
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
    && nextSettings.noteNaming === state.settings.noteNaming
    && nextSettings.intervalDifficulty === state.settings.intervalDifficulty
    && nextSettings.typeDifficulty === state.settings.typeDifficulty
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
    if (dragState.sourceType === 'slot' && dragState.sourceSlot !== null && dragState.sourceSlot !== slotIndex) {
      const displacedDegree = state.round.placements[slotIndex];
      state.round.placements[slotIndex] = dragState.degree;
      state.round.placements[dragState.sourceSlot] = displacedDegree;
    } else {
      state.round.placements[slotIndex] = dragState.degree;
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
  // Track that this option was listened to (preview) for ordering modes
  markOptionsPlayed([degree]);
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

  if (state.settings.playMode === 'tipo triade') {
    if (state.round.solved || state.round.locked) {
      startNewRound('');
    }

    await playTriadQuestion();
    return;
  }
  if (state.settings.playMode === 'tipo quadriadi') {
    if (state.round.solved || state.round.locked) {
      startNewRound('');
    }

    await playTetradQuestion();
    return;
  }

  if (isOrderingMode(state.settings.playMode)) {
    if (state.round.solved || state.round.locked) {
      startNewRound('');
    }

    await playOrderingSequence();
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
    // For ordering modes, mark all solution options as played now (sequence finished)
    if (isOrderingMode(state.settings.playMode)) {
      markOptionsPlayed(state.round.solution);
    }

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

  if (state.settings.playMode === 'tipo triade') {
    await playTriadAnswer();
    return;
  }
  if (state.settings.playMode === 'tipo quadriadi') {
    await playTetradAnswer();
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

  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  let cursor = startAt;
  const offsets: number[] = [];

  // Schedule each chosen placement using its option.sequenceGap or duration
  chosenPlacements.forEach(({ degree }) => {
    const option = state.round.options[degree];
    const duration = playOption(option, state.settings.playMode, state.settings.playbackMode, {
      preview: false,
      when: cursor
    });

    // record offset relative to startAt for animations
    offsets.push(cursor - startAt);

    // mark this option as played once
    if (isOrderingMode(state.settings.playMode)) {
      markOptionsPlayed([degree]);
    }

    const step = Math.max(option.sequenceGap ?? (duration + 0.2), duration + 0.2);
    cursor += step;
  });

  const durationMs = Math.ceil((cursor - startAt + 0.18) * 1000);
  pulseSequenceBackground(durationMs);
  animateAnswerSlots(chosenPlacements, offsets, currentRoundId);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

async function chooseIntervalAnswer(answerId: string, source: HTMLElement): Promise<void> {
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

  // If difficulty is 'difficile', the selection is final: play preview (non-blocking) and finalize immediately
  if (state.settings.intervalDifficulty === 'difficile') {
    void previewIntervalAnswer(answerId);
    finalizeIntervalAnswer(answerId);
    return;
  }

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
    setFeedback(`Risposta Corretta +${breakdown.earned}`, 'success');
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

async function chooseTriadAnswer(answerId: string, source: HTMLElement): Promise<void> {
  if (!answerId || state.isPlaying) {
    return;
  }

  const question = state.round.triadQuestion;
  if (!question) {
    return;
  }

  const idxMap = ['maggiore', 'minore', 'diminuita', 'aumentata'];
  const accentIndex = Math.max(0, idxMap.indexOf(answerId as any));

  if (state.round.locked || state.round.solved) {
    animateCardTap(source, getCardAccent(accentIndex));
    void previewTriadAnswer(answerId);
    return;
  }

  state.round.selectedAnswerId = answerId;
  if (state.feedback === 'Scegli una risposta' && state.feedbackTone === 'info') {
    setFeedback('', 'idle');
  }

  animateCardTap(source, getCardAccent(accentIndex));
  render();

  // If difficulty for types is 'difficile' finalize immediately
  if (state.settings.typeDifficulty === 'difficile') {
    void previewTriadAnswer(answerId);
    finalizeTriadAnswer(answerId);
    return;
  }

  void previewTriadAnswer(answerId);
}

async function previewTriadAnswer(answerId: string): Promise<void> {
  const question = state.round.triadQuestion;
  if (!question) {
    return;
  }
  const quality = answerId as 'maggiore' | 'minore' | 'diminuita' | 'aumentata';
  let midi: number[];
  const root = question.rootMidi;

  if (quality === 'maggiore') {
    midi = [root, root + 4, root + 7];
  } else if (quality === 'minore') {
    midi = [root, root + 3, root + 7];
  } else if (quality === 'diminuita') {
    midi = [root, root + 3, root + 6];
  } else {
    midi = [root, root + 4, root + 8];
  }

  const idxMap = ['maggiore', 'minore', 'diminuita', 'aumentata'];
  const accentIndex = Math.max(0, idxMap.indexOf(quality));

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  syncLiveUi(appRoot, state);

  const startAt = piano.currentTime + 0.01;
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
    pulseCardBackground(getCardAccent(accentIndex), durationMs);
  } else {
    piano.playArpeggio(midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
    pulseCardBackground(getCardAccent(accentIndex), durationMs);
  }

  const currentRoundId = state.round.id;
  startBackdropNotes(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function finalizeTriadAnswer(answerId: string): void {
  const question = state.round.triadQuestion;
  if (!question) {
    return;
  }

  if (!state.round.counted) {
    state.score.roundsPlayed += 1;
    state.round.counted = true;
  }

  state.round.selectedAnswerId = answerId;
  const correct = answerId === question.correctQuality;

  if (correct) {
    const breakdown = computeScoreBreakdown(state.round, state.settings);
    state.score.totalPoints = Math.max(0, state.score.totalPoints + breakdown.earned);
    state.score.streak += 1;
    state.score.bestStreak = Math.max(state.score.bestStreak, state.score.streak);
    state.score.roundsSolved += 1;
    state.round.solved = true;
    persistScore(state.score);
    setFeedback(`Risposta Corretta +${breakdown.earned}`, 'success');
    render();
    return;
  }

  state.round.attempts += 1;
  state.round.locked = true;
  state.score.streak = 0;
  state.score.totalPoints = Math.max(0, state.score.totalPoints - getMistakePenalty(state.round));
  persistScore(state.score);
  const correctLabel = question.correctQuality ?? 'Risposta corretta';
  setFeedback(`Era ${correctLabel}`, 'error');
  render();
}

function checkTriadAnswer(): void {
  if (state.isPlaying || state.round.locked || state.round.solved) {
    return;
  }

  if (!state.round.selectedAnswerId) {
    setFeedback('Scegli una risposta', 'info');
    return;
  }

  finalizeTriadAnswer(state.round.selectedAnswerId);
}

async function chooseTetradAnswer(answerId: string, source: HTMLElement): Promise<void> {
  if (!answerId || state.isPlaying) {
    return;
  }

  const question = state.round.tetradQuestion;
  if (!question) {
    return;
  }

  const idxMap = ['maj7', 'm7', '7', 'm7b5', 'mMaj7', 'maj7#5', 'dim7'];
  const accentIndex = Math.max(0, idxMap.indexOf(answerId as any));

  if (state.round.locked || state.round.solved) {
    animateCardTap(source, getCardAccent(accentIndex));
    void previewTetradAnswer(answerId);
    return;
  }

  state.round.selectedAnswerId = answerId;
  if (state.feedback === 'Scegli una risposta' && state.feedbackTone === 'info') {
    setFeedback('', 'idle');
  }

  animateCardTap(source, getCardAccent(accentIndex));
  render();

  // If difficulty for types is 'difficile' finalize immediately
  if (state.settings.typeDifficulty === 'difficile') {
    void previewTetradAnswer(answerId);
    finalizeTetradAnswer(answerId);
    return;
  }

  void previewTetradAnswer(answerId);
}

async function previewTetradAnswer(answerId: string): Promise<void> {
  const question = state.round.tetradQuestion;
  if (!question) {
    return;
  }

  const quality = answerId as Exclude<string, ''>;
  const root = question.rootMidi;
  let midi: number[];

  switch (quality) {
    case 'maj7': midi = [root, root + 4, root + 7, root + 11]; break;
    case 'm7': midi = [root, root + 3, root + 7, root + 10]; break;
    case '7': midi = [root, root + 4, root + 7, root + 10]; break;
    case 'm7b5': midi = [root, root + 3, root + 6, root + 10]; break;
    case 'mMaj7': midi = [root, root + 3, root + 7, root + 11]; break;
    case 'maj7#5': midi = [root, root + 4, root + 8, root + 11]; break;
    case 'dim7': midi = [root, root + 3, root + 6, root + 9]; break;
    default: midi = [root, root + 4, root + 7, root + 11];
  }

  const idxMap = ['maj7', 'm7', '7', 'm7b5', 'mMaj7', 'maj7#5', 'dim7'];
  const accentIndex = Math.max(0, idxMap.indexOf(quality));

  const ready = await piano.ensureReady();
  state.audioReady = ready;
  if (!ready) {
    setFeedback('Audio non disponibile', 'error');
    return;
  }

  clearPendingTimers();
  state.isPlaying = true;
  syncLiveUi(appRoot, state);

  const startAt = piano.currentTime + 0.01;
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
    pulseCardBackground(getCardAccent(accentIndex), durationMs);
  } else {
    piano.playArpeggio(midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
    pulseCardBackground(getCardAccent(accentIndex), durationMs);
  }

  const currentRoundId = state.round.id;
  startBackdropNotes(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function finalizeTetradAnswer(answerId: string): void {
  const question = state.round.tetradQuestion;
  if (!question) {
    return;
  }

  if (!state.round.counted) {
    state.score.roundsPlayed += 1;
    state.round.counted = true;
  }

  state.round.selectedAnswerId = answerId;
  const correct = answerId === question.correctQuality;

  if (correct) {
    const breakdown = computeScoreBreakdown(state.round, state.settings);
    state.score.totalPoints = Math.max(0, state.score.totalPoints + breakdown.earned);
    state.score.streak += 1;
    state.score.bestStreak = Math.max(state.score.bestStreak, state.score.streak);
    state.score.roundsSolved += 1;
    state.round.solved = true;
    persistScore(state.score);
    setFeedback(`Risposta Corretta +${breakdown.earned}`, 'success');
    render();
    return;
  }

  state.round.attempts += 1;
  state.round.locked = true;
  state.score.streak = 0;
  state.score.totalPoints = Math.max(0, state.score.totalPoints - getMistakePenalty(state.round));
  persistScore(state.score);
  const correctLabel = question.correctQuality ?? 'Risposta corretta';
  setFeedback(`Era ${correctLabel}`, 'error');
  render();
}

function checkTetradAnswer(): void {
  if (state.isPlaying || state.round.locked || state.round.solved) {
    return;
  }

  if (!state.round.selectedAnswerId) {
    setFeedback('Scegli una risposta', 'info');
    return;
  }

  finalizeTetradAnswer(state.round.selectedAnswerId);
}

async function playTetradQuestion(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const question = state.round.tetradQuestion;
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
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(question.midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
  } else {
    piano.playArpeggio(question.midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
  }

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

async function playTetradAnswer(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const question = state.round.tetradQuestion;
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
  syncLiveUi(appRoot, state);

  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(question.midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
  } else {
    piano.playArpeggio(question.midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
  }

  pulseSequenceBackground(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

async function playTriadQuestion(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const question = state.round.triadQuestion;
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
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(question.midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
  } else {
    piano.playArpeggio(question.midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
  }

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

async function playTriadAnswer(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const question = state.round.triadQuestion;
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
  syncLiveUi(appRoot, state);

  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  let durationMs = 0;

  if (question.playbackMode === 'armonico') {
    piano.playChord(question.midi, { when: startAt, duration: 1.02, velocity: 0.34 });
    durationMs = 1180;
  } else {
    piano.playArpeggio(question.midi, { when: startAt, step: 0.22, noteDuration: 0.46, velocity: 0.34 });
    durationMs = 1880;
  }

  pulseSequenceBackground(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function checkAnswer(): void {
  if (state.settings.playMode === 'intervalli') {
    checkIntervalAnswer();
    return;
  }

  if (state.settings.playMode === 'tipo triade') {
    checkTriadAnswer();
    return;
  }

  if (state.settings.playMode === 'tipo quadriadi') {
    checkTetradAnswer();
    return;
  }

  if (state.isPlaying) {
    return;
  }

  if (state.round.locked) {
    return;
  }

  if (isOrderingMode(state.settings.playMode)) {
    if (state.round.placements.some((degree) => degree === null)) {
      setFeedback('Riempi tutti gli slot', 'error');
      return;
    }
  } else if (state.round.sequencePlayCount === 0) {
    setFeedback('Ascolta prima', 'error');
    return;
  }

  if (!isOrderingMode(state.settings.playMode) && state.round.placements.some((degree) => degree === null)) {
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
    setFeedback(`Risposta Corretta +${breakdown.earned}`, 'success');
    render();
    return;
  }

  state.round.attempts += 1;
  state.round.locked = true;
  state.score.streak = 0;
  state.score.totalPoints = Math.max(0, state.score.totalPoints - getMistakePenalty(state.round));
  persistScore(state.score);
  const correctCount = state.round.lastCheckResults.filter((result) => result === 'correct').length;
  const correctSequence = isOrderingMode(state.settings.playMode)
    ? buildOrderingSolutionMarkup(state.round.solution)
    : state.round.solution
      .map((degree) => state.round.options[degree].symbol)
      .join(' · ');
  setFeedback(`${correctCount}/${state.round.slotCount} · ${correctSequence}`, 'error');
  render();
}

function startNewRound(message: string): void {
  clearPendingTimers();
  state.isPlaying = false;
  state.round = createRound(state.settings);
  const fallbackMessage = !message ? getContextualFeedbackMessage() : message;
  setFeedback(fallbackMessage, fallbackMessage ? 'info' : 'idle');
  render();
}

function setFeedback(message: string, tone: FeedbackTone): void {
  state.feedback = message;
  state.feedbackTone = tone;
  syncLiveUi(appRoot, state);
}

function clearPlacementHintIfNeeded(): void {
  if (state.feedbackTone !== 'error' && state.feedbackTone !== 'info') {
    return;
  }

  restoreContextualFeedback();
}

function restoreContextualFeedback(): void {
  const message = getContextualFeedbackMessage();
  setFeedback(message, message ? 'info' : 'idle');
}

function getContextualFeedbackMessage(): string {
  return state.round.orderingChallenge?.prompt ?? '';
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

function buildOrderingSolutionMarkup(solution: number[]): string {
  return `<span class="feedback-swatches">${solution.map((degree, index) => `<span class="feedback-swatch" style="--swatch:${getCardAccent(degree)}" aria-label="Carta ${index + 1}" title="Carta ${index + 1}"></span>`).join('')}</span>`;
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

  if (playMode === 'altezza' || playMode === 'durata' || playMode === 'intensita') {
    const duration = option.playDuration ?? 0.82;
    const velocity = option.playVelocity ?? 0.34;
    piano.playSingle(option.midi[0], {
      when,
      duration,
      velocity,
      timbre: option.soundTimbre,
      flatEnvelope: option.useFlatEnvelope
    });
    return duration;
  }

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
  if (playMode === 'altezza' || playMode === 'durata' || playMode === 'intensita') {
    return 0.98;
  }

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
  spacingOrOffsets: number | number[],
  roundId: number
): void {
  chosenPlacements.forEach(({ degree, slotIndex }, index) => {
    const delayMs = Array.isArray(spacingOrOffsets)
      ? Math.round((spacingOrOffsets[index] + 0.08) * 1000)
      : Math.round((0.08 + index * spacingOrOffsets) * 1000);

    window.setTimeout(() => {
      if (state.round.id !== roundId) {
        return;
      }

      const slotCard = appRoot.querySelector<HTMLElement>(`[data-slot-index="${slotIndex}"] .chord-card`);
      animateCardTap(slotCard ?? undefined, getCardAccent(degree));
    }, delayMs);
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
  return value === 'intervalli' || value === 'altezza' || value === 'durata' || value === 'intensita' || value === 'nota singola' || value === 'triadi' || value === 'quadriadi' || value === 'tipo triade' || value === 'tipo quadriadi';
}

function isIntervalType(value: string | undefined): value is IntervalType {
  return value === '2ª'
    || value === '3ª'
    || value === '4ª'
    || value === '5ª'
    || value === '6ª'
    || value === '7ª'
    || value === '4ª, 5ª, 8ª'
    || value === '5ª, 4ª, 8ª'
    || value === '9ª'
    || value === 'Scala maggiore'
    || value === 'Scala cromatica';
}

function isIntervalPlaybackMode(value: string | undefined): value is IntervalPlaybackModeSetting {
  return value === 'armonico' || value === 'melodico' || value === 'entrambi';
}

async function playOrderingSequence(): Promise<void> {
  if (state.isPlaying) {
    return;
  }

  const challenge = state.round.orderingChallenge;
  if (!challenge) {
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

  const orderedDegrees = state.round.solution;
  const startAt = piano.currentTime + 0.08;
  const currentRoundId = state.round.id;
  let cursor = startAt;

  orderedDegrees.forEach((degree) => {
    const option = state.round.options[degree];
    const duration = playOption(option, state.settings.playMode, state.settings.playbackMode, { preview: false, when: cursor });
    cursor += Math.max(option.sequenceGap ?? (duration + 0.2), duration + 0.2);
  });

  const durationMs = Math.ceil((cursor - startAt + 0.18) * 1000);
  pulseSequenceBackground(durationMs);

  playbackTimerId = window.setTimeout(() => {
    if (state.round.id !== currentRoundId) {
      return;
    }

    state.isPlaying = false;
    state.round.sequenceFinishedAt = Date.now();
    // Mark all ordered degrees as played (sequence finished)
    markOptionsPlayed(state.round.solution);

    if (state.round.answerWindowStartedAt === null) {
      state.round.answerWindowStartedAt = state.round.sequenceFinishedAt;
    }
    syncLiveUi(appRoot, state);
  }, durationMs);
}

function isOrderingMode(playMode: PlayMode): playMode is 'altezza' | 'durata' | 'intensita' {
  return playMode === 'altezza' || playMode === 'durata' || playMode === 'intensita';
}

function ensureOptionPlayTracking(): void {
  if (!state.round) return;
  if (!Array.isArray(state.round.optionPlayCounts) || state.round.optionPlayCounts.length !== state.round.options.length) {
    state.round.optionPlayCounts = Array.from({ length: state.round.options.length }, () => 0);
  }
  if (typeof state.round.listensAfterCoverage !== 'number') {
    state.round.listensAfterCoverage = 0;
  }
  if (typeof state.round.coverageAchievedAt === 'undefined') {
    state.round.coverageAchievedAt = null;
  }
}

function markOptionsPlayed(degrees: number[]): void {
  if (!isOrderingMode(state.settings.playMode)) return;
  ensureOptionPlayTracking();
  const hadCoverage = state.round.coverageAchievedAt !== null;

  // Update play counts
  degrees.forEach((d) => {
    if (d == null || d < 0 || d >= state.round.optionPlayCounts.length) return;
    state.round.optionPlayCounts[d] = (state.round.optionPlayCounts[d] || 0) + 1;
    if (hadCoverage) {
      state.round.listensAfterCoverage += 1;
    }
  });

  // If we didn't have coverage yet, check whether we've just reached it
  if (!hadCoverage) {
    const allPlayed = state.round.optionPlayCounts.length > 0 && state.round.optionPlayCounts.every((c) => c >= 1);
    if (allPlayed) {
      state.round.coverageAchievedAt = Date.now();
    }
  }
}

function lightenHex(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const channels = normalized.length === 3
    ? normalized.split('').map((value) => parseInt(value + value, 16))
    : [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));

  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
