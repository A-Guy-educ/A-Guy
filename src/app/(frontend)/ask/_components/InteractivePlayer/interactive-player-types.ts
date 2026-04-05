import type { InteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

/** Props for the main InteractivePlayer component */
export interface InteractivePlayerProps {
  lesson: InteractiveLesson
  /** Called whenever the active step changes */
  onStepChange?: (stepId: number) => void
}

/** Playback speed multiplier options */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

/** Internal player state managed by the hook */
export interface PlayerState {
  currentStepIndex: number
  isPlaying: boolean
  playbackSpeed: PlaybackSpeed
  /** Progress within current step (0-1) */
  stepProgress: number
  /** Total elapsed time across all steps in seconds */
  elapsedTime: number
}

/** Actions the player hook exposes */
export interface PlayerActions {
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  goToStep: (index: number) => void
  nextStep: () => void
  prevStep: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  seekToProgress: (progress: number) => void
}
