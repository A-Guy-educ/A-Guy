/**
 * Conversion Service - Type definitions and interfaces
 *
 * This module exports the types and service interface for conversion jobs.
 * Implementation is in the endpoint handlers.
 */

// Re-export v2 types
export * from '../jobs/types'

/**
 * Create conversion input
 */
export interface CreateConversionInput {
  lessonId: string
  sourceMediaId: string
  templateId?: string
}

/**
 * Start conversion input
 */
export interface StartConversionInput {
  config?: {
    pageRange: { start: number; end?: number; excludePages: number[] }
    segmentation: { pagesPerSegment: number }
    extraction: { mode: string; exerciseTypes: string[]; customInstructions?: string }
    reviewMode: string
  }
  prompts?: {
    // Support both wizard format and API override format
    extractorPromptId?: string
    verifierPromptId?: string
    extractor?: string // Wizard sends this
    verifier?: string // Wizard sends this
  }
  additionalRounds?: Array<{
    name: string
    promptId: string
    targetField: string
    triggerCondition: 'always' | 'has_image' | 'has_table' | 'has_diagram' | 'custom'
    customCondition?: string
    order: number
    isEnabled: boolean
  }>
}

/**
 * Review action input
 */
export interface ReviewActionInput {
  action: 'approve' | 'reject' | 'skip'
  segmentIndex?: number
  exerciseIndices?: number[]
  reason?: string
  content?: Record<string, unknown>
  adminNotes?: string
}

/**
 * Exercise edit input
 */
export interface EditExerciseInput {
  title?: string
  content?: Record<string, unknown>
  adminNotes?: string
}
