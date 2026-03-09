import { z } from 'zod'

// ── LLM Output Contract (spec FR-003) ──

export const DiagramToTikzOutputSchema = z.object({
  tikz: z.string().nullable(),
  diagramType: z.enum(['geometry', 'axis', 'other']),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  notes: z.string().optional(),
  requiredPackages: z.array(z.string()).optional(),
  refusal: z
    .object({
      reason: z.string(),
      detail: z.string().optional(),
    })
    .optional(),
})

export type DiagramToTikzOutput = z.infer<typeof DiagramToTikzOutputSchema>

// ── Detection Result ──

export interface DiagramBlockInfo {
  /** Index of exercise in the exercises array */
  exerciseIndex: number
  /** Index of the diagram block within exercise.blocks */
  blockIndex: number
  /** Block ID for correlation */
  blockId: string
  /** Diagram description text (without the "**Diagram:**" prefix) */
  description: string
  /** true if "**Diagram for X:**", false if "**Diagram:**" */
  isPerSubQuestion: boolean
  /** Sub-question label (e.g., "א", "ב", "a") — only when isPerSubQuestion */
  subQuestionLabel?: string
}

// ── Metrics ──

export interface DiagramPassMetrics {
  detected: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  latencyMs: number
  byType: {
    geometry: number
    axis: number
    other: number
  }
  failureReasons: string[]
}

// ── Per-Diagram Conversion Info (Step 1 Output) ──

/**
 * Information about each successful diagram-to-TikZ conversion from Step 1.
 * Used by Step 2 (geometry-pass) to convert TikZ to GeometrySpecV1/AxisSpecV1.
 */
export interface DiagramConversionInfo {
  /** Index of exercise in the exercises array */
  exerciseIndex: number
  /** ID of the inserted latex block */
  latexBlockId: string
  /** ID of the original rich_text diagram block */
  richTextBlockId: string
  /** Classification: geometry, axis, or other */
  diagramType: 'geometry' | 'axis' | 'other'
  /** Generated TikZ code */
  tikz: string
  /** Original diagram description text */
  description: string
  /** LLM confidence score from Step 1 */
  confidence: number
  /** true if "**Diagram for X:**", false if "**Diagram:**" */
  isPerSubQuestion: boolean
  /** Sub-question label (e.g., "א", "ב", "a") — only when isPerSubQuestion */
  subQuestionLabel?: string
}

// ── Combined Result ──

/**
 * Full result from the diagram pass (Step 1).
 * Includes both aggregate metrics and per-diagram conversion info.
 */
export interface DiagramPassResult {
  /** Aggregate metrics for the pass */
  metrics: DiagramPassMetrics
  /** Per-diagram conversion information for Step 2 */
  conversions: DiagramConversionInfo[]
}
