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
// Graph data — coordinate plane with plotted functions and marked points
// ─────────────────────────────────────────────────────────────────────────────

/** A function plotted as a polyline of pre-sampled (x, y) pairs. */
export interface GraphPlot {
  /** Unique id targeted by step actions (e.g. "plot-f"). */
  id: string
  /** Sampled points in data space, ordered by x. */
  points: Array<[number, number]>
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple'
  style?: 'solid' | 'dashed'
  /** Optional label rendered near the end of the curve (e.g. "f(x) = x²"). */
  label?: string
}

/** A single labeled point on the coordinate plane (root, extremum, intersection). */
export interface GraphMarker {
  id: string
  x: number
  y: number
  label?: string
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple'
}

/** Coordinate plane scene: axes + plotted curves + marked points. */
export interface GraphData {
  xRange: [number, number]
  yRange: [number, number]
  /** Tick spacing on the x-axis; default 1. */
  xStep?: number
  /** Tick spacing on the y-axis; default 1. */
  yStep?: number
  plots: GraphPlot[]
  markers: GraphMarker[]
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
  /** Segments to highlight: array of [from, to] label pairs (geometry). */
  highlightSegments?: string[][]
  /** Points to highlight during this step (geometry). */
  highlightPoints?: string[]
  /** Plot ids to draw during this step (graph scene). */
  highlightPlots?: string[]
  /** Marker ids to reveal during this step (graph scene). */
  highlightMarkers?: string[]
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
  /**
   * Optional coordinate-plane scene for function-analysis problems. Takes
   * rendering precedence over `geometry` when present and non-empty.
   */
  graph?: GraphData
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
