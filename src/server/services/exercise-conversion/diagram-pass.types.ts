/**
 * Diagram Pass Types
 * Types for the diagram-to-TikZ conversion pass
 */

import type { EnrichedExercise } from './idempotency'

export interface DiagramPassMetrics {
  detected: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  latencyMs: number
}

export interface DiagramPassResult {
  tikz: string
  confidence: 'low' | 'medium' | 'high'
  notes?: string
}

export interface DiagramBlockInfo {
  exerciseIndex: number
  blockIndex: number
  blockId: string
  description: string // The "Diagram:" block value (without prefix)
}

export interface DiagramPassContext {
  attachments: Array<{ data: string; mimeType: string }>
  segment: { pageStart: number; pageEnd: number }
  diagramPrompt: string
  exercises: EnrichedExercise[]
}
