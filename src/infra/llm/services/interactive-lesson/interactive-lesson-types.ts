/**
 * Types for the interactive lesson visualization feature.
 * Defines the structured step data that the LLM generates
 * and the player component consumes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Geometry data — extracted by the LLM, rendered deterministically by us
// ─────────────────────────────────────────────────────────────────────────────

/** A labeled point in the diagram */
export interface GeoPoint {
  label: string
  x: number
  y: number
}

/** A line segment between two labeled points */
export interface GeoSegment {
  from: string
  to: string
  /** Optional style: solid (default), dashed, bold */
  style?: 'solid' | 'dashed' | 'bold'
  /** Optional color override (design system key) */
  color?: string
}

/** An angle marker between three points (vertex is the middle point) */
export interface GeoAngle {
  points: [string, string, string]
  /** true for 90-degree square marker */
  rightAngle?: boolean
}

/** A text label placed at specific coordinates */
export interface GeoLabel {
  text: string
  x: number
  y: number
  fontSize?: number
}

/** Full geometry diagram data extracted from the image */
export interface GeometryData {
  points: GeoPoint[]
  segments: GeoSegment[]
  angles?: GeoAngle[]
  labels?: GeoLabel[]
  /** viewBox dimensions */
  width: number
  height: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps & Lesson
// ─────────────────────────────────────────────────────────────────────────────

/** A single step in an interactive lesson */
export interface InteractiveLessonStep {
  /** Unique step identifier (1-based) */
  id: number
  /** Step title shown in the step table */
  title: string
  /** Mathematical claim for the proof table (e.g., "BC = CD") */
  claim: string
  /** Reason/justification for the claim (e.g., "נתון") */
  reason: string
  /** Narration text for TTS and closed captions */
  narration: string
  /** Longer explanation shown in the explanation box */
  explanation: string
  /** Estimated duration in seconds for this step's narration */
  durationSeconds: number
  /** Segments to highlight: array of [from, to] label pairs */
  highlightSegments?: string[][]
  /** Points to highlight during this step */
  highlightPoints?: string[]
}

/** Full interactive lesson generated from an image */
export interface InteractiveLesson {
  /** Overall title of the lesson/proof */
  title: string
  /** Language of the content */
  locale: 'he' | 'en'
  /** Ordered list of explanation steps */
  steps: InteractiveLessonStep[]
  /** Structured geometry data for deterministic SVG rendering */
  geometry: GeometryData
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
