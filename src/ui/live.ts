import type { AppState } from '../app/types';

export function syncLiveUi(root: HTMLElement, state: AppState): void {
  const playButton = root.querySelector<HTMLButtonElement>('[data-role="play-sequence"]');
  const checkButton = root.querySelector<HTMLButtonElement>('[data-role="check-answer"]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-role="reset-slots"]');
  const newRoundButton = root.querySelector<HTMLButtonElement>('[data-role="new-round"]');
  const selects = root.querySelectorAll<HTMLSelectElement>('[data-setting]');
  const feedbackBox = root.querySelector<HTMLElement>('[data-role="feedback-box"]');
  const feedbackText = root.querySelector<HTMLElement>('[data-role="feedback-text"]');

  if (playButton) {
    playButton.disabled = state.isPlaying;
    playButton.textContent = state.isPlaying ? 'Suona...' : 'Ascolta';
  }

  if (checkButton) {
    checkButton.disabled = state.isPlaying || state.round.locked;
  }

  if (resetButton) {
    resetButton.disabled = state.isPlaying || state.round.locked;
  }

  if (newRoundButton) {
    newRoundButton.disabled = state.isPlaying;
  }

  selects.forEach((select) => {
    select.disabled = state.isPlaying;
  });

  if (feedbackBox) {
    feedbackBox.className = `feedback feedback--${state.feedbackTone}`;
  }

  if (feedbackText) {
    feedbackText.textContent = state.feedback;
  }
}