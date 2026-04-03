export type ScaleFamily = 'maggiore' | 'minore naturale' | 'minore armonica' | 'minore melodica';
export type PlayMode = 'intervalli' | 'altezza' | 'durata' | 'intensita' | 'nota singola' | 'triadi' | 'quadriadi';
export type PlaybackMode = 'armonico' | 'melodico';
export type IntervalType = '2ª' | '3ª' | '4ª' | '5ª' | '6ª' | '7ª' | '5ª, 4ª, 8ª' | '9ª' | 'Scala maggiore' | 'Scala cromatica';
export type IntervalPlaybackModeSetting = 'armonico' | 'melodico' | 'entrambi';
export type IntervalDirection = 'ascendente' | 'discendente';
export type OrderingDirection = 'ascendente' | 'discendente';
export type FeedbackTone = 'idle' | 'success' | 'error' | 'info';
export type DragSource = 'palette' | 'slot';
export type SlotResult = 'correct' | 'wrong' | null;

export interface OrderingChallenge {
  kind: 'altezza' | 'durata' | 'intensita';
  direction: OrderingDirection;
  prompt: string;
}

export interface IntervalAnswerOption {
  id: string;
  label: string;
  shortLabel: string;
  semitones: number;
}

export interface IntervalQuestion {
  family: IntervalType;
  answerOptions: IntervalAnswerOption[];
  correctAnswerId: string;
  notes: string[];
  midi: number[];
  baseMidi: number;
  playbackMode: PlaybackMode;
  direction: IntervalDirection;
}

export interface ScaleDefinition {
  key: string;
  family: ScaleFamily;
  notes: string[];
  semitones: number[];
  tonicMidi: number;
  triadQualities: string[];
  tetradQualities: string[];
  triadNumerals: string[];
  tetradNumerals: string[];
}

export interface ChordOption {
  degree: number;
  numeral: string;
  quality: string;
  label: string;
  symbol: string;
  notes: string[];
  midi: number[];
  playDuration?: number;
  playVelocity?: number;
  sequenceGap?: number;
  sortRank?: number;
}

export interface SettingsState {
  slotCount: number;
  scaleFamily: ScaleFamily;
  playMode: PlayMode;
  playbackMode: PlaybackMode;
  intervalType: IntervalType;
  intervalPlaybackMode: IntervalPlaybackModeSetting;
  intervalDirection: IntervalDirection;
}

export interface ScoreState {
  totalPoints: number;
  streak: number;
  bestStreak: number;
  roundsPlayed: number;
  roundsSolved: number;
}

export interface RoundState {
  id: number;
  scale: ScaleDefinition | null;
  options: ChordOption[];
  solution: number[];
  placements: Array<number | null>;
  lastCheckResults: SlotResult[];
  attempts: number;
  counted: boolean;
  locked: boolean;
  solved: boolean;
  slotCount: number;
  playMode: PlayMode;
  playbackMode: PlaybackMode;
  sequencePlayCount: number;
  cardPreviewCount: number;
  answerWindowStartedAt: number | null;
  sequenceFinishedAt: number | null;
  intervalQuestion: IntervalQuestion | null;
  selectedAnswerId: string | null;
  orderingChallenge: OrderingChallenge | null;
}

export interface AppState {
  settings: SettingsState;
  score: ScoreState;
  round: RoundState;
  feedback: string;
  feedbackTone: FeedbackTone;
  isPlaying: boolean;
  audioReady: boolean;
}

export interface DragState {
  pointerId: number;
  degree: number;
  startX: number;
  startY: number;
  dragging: boolean;
  ghost: HTMLElement | null;
  source: HTMLElement;
  hoverSlot: number | null;
  sourceType: DragSource;
  sourceSlot: number | null;
}

export interface ScoreBounds {
  maxScore: number;
  minScore: number;
}

export interface ScoreBreakdown extends ScoreBounds {
  earned: number;
  elapsedSeconds: number;
  sequencePenalty: number;
  cardPenalty: number;
  timePenalty: number;
  attemptPenalty: number;
}