/**
 * Types for the interactive lesson visualization feature.
 * Defines the structured step data that the LLM generates
 * and the player component consumes.
 */

/** A single animation step in an interactive lesson */
export interface InteractiveLessonStep {
  /** Unique step identifier (1-based) */
  id: number
  /** Step title shown in the player UI */
  title: string
  /** Narration text for TTS and closed captions */
  narration: string
  /** HTML content to render for this step (SVG, text, formulas) */
  htmlContent: string
  /** Estimated duration in seconds for this step's narration */
  durationSeconds: number
  /** Base64-encoded MP3 audio for this step (null if TTS failed) */
  audioBase64?: string | null
}

/** Full interactive lesson generated from an image */
export interface InteractiveLesson {
  /** Overall title of the lesson/proof */
  title: string
  /** Language of the content */
  locale: 'he' | 'en'
  /** Ordered list of explanation steps */
  steps: InteractiveLessonStep[]
  /** Global CSS styles for the HTML content */
  globalStyles: string
}

/** Response from the generation pipeline */
export interface InteractiveLessonResponse {
  success: boolean
  data?: InteractiveLesson
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    imageSizeBytes: number
  }
}

/** Input for the generation pipeline */
export interface InteractiveLessonInput {
  imageBuffer: Buffer
  mimeType: string
  locale: 'he' | 'en'
}

/** Playback state shared between player and chat */
export interface PlayerStepContext {
  /** Current step being viewed (1-based) */
  currentStepId: number
  /** Total number of steps */
  totalSteps: number
  /** Title of current step */
  stepTitle: string
  /** Narration text of current step */
  stepNarration: string
}
