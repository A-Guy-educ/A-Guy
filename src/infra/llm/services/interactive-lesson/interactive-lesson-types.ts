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
// Number-line data — inequalities, intervals, set operations
// ─────────────────────────────────────────────────────────────────────────────

/** A single value marked on the number line (e.g. a boundary value, an answer). */
export interface NumberLineMark {
  id: string
  value: number
  label?: string
  /** 'closed' (filled dot, value included) or 'open' (hollow dot, excluded). */
  inclusion?: 'open' | 'closed'
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple'
}

/**
 * A contiguous interval drawn on the number line. Use `'unbounded'` on an
 * inclusion side to draw an arrow (→ / ←) instead of an endpoint dot; the
 * corresponding `from` / `to` is then the visible extent of the range.
 */
export interface NumberLineInterval {
  id: string
  from: number
  to: number
  fromInclusion: 'open' | 'closed' | 'unbounded'
  toInclusion: 'open' | 'closed' | 'unbounded'
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple'
  label?: string
}

/** Horizontal number-line scene for inequalities / intervals / set ops. */
export interface NumberLineData {
  range: [number, number]
  /** Tick spacing; default 1. */
  step?: number
  marks: NumberLineMark[]
  intervals: NumberLineInterval[]
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
  /** Mark ids to reveal during this step (number-line scene). */
  highlightMarks?: string[]
  /** Interval ids to draw during this step (number-line scene). */
  highlightIntervals?: string[]
  /**
   * Pre-generated narration MP3 (base64) baked in by the server at lesson
   * generation. Persisted in the lesson cache, so subsequent plays don't
   * re-call Google TTS. Optional — falls through to live cloud TTS when
   * absent (older cached lessons or per-step TTS failures).
   */
  audioBase64?: string
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
  /**
   * Optional number-line scene for inequalities / intervals / set operations.
   * Rendered when `graph` is empty but number line has marks or intervals.
   */
  numberLine?: NumberLineData
}

/** Provenance of the source admin Prompts row used to generate the lesson. */
export interface InteractiveLessonPromptSource {
  /** Source Prompts collection row id. */
  id: string
  /** updatedAt of the row at generation time, ISO string. */
  updatedAt: string
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
  /**
   * Identity of the admin Prompts row used. Persisted on the cache row so
   * a later prompt edit invalidates the cache automatically. Absent on
   * error responses where no prompt lookup happened.
   */
  promptSource?: InteractiveLessonPromptSource
}

/** Input for the generation pipeline */
export interface InteractiveLessonInput {
  imageBuffer: Buffer
  mimeType: string
  locale: 'he' | 'en'
}
