/**
 * @fileType engine
 * @domain cody | engine
 * @pattern pipeline-resolver
 * @ai-summary Pipeline construction based on mode and profile
 */

import type { PipelineDefinition, PipelineContext } from '../engine/types'
import {
  buildPipeline,
  rebuildPipelineAfterTaskify as rebuildFromDefinitions,
  FIX_ORDER,
} from '../pipeline/definitions'

/**
 * Resolve pipeline for a given mode
 */
export function resolvePipelineForMode(
  mode: 'spec' | 'impl' | 'full' | 'rerun' | 'fix' | 'status',
  profile: 'standard' | 'lightweight',
  clarify: boolean,
  ctx: PipelineContext,
): PipelineDefinition {
  switch (mode) {
    case 'spec':
    case 'full':
      return buildPipeline(mode, profile, clarify, ctx)
    case 'impl':
      return buildPipeline('impl', profile, clarify, ctx)
    case 'rerun':
      // Rerun needs BOTH spec and impl stages to support resuming from any stage
      return buildPipeline('rerun', profile, clarify, ctx)
    case 'fix': {
      // Fix mode uses FIX_ORDER (review → fix → commit-fix → verify → pr)
      const fixPipeline = buildPipeline('full', profile, clarify, ctx)
      return { stages: fixPipeline.stages, order: FIX_ORDER }
    }
    case 'status':
      // No pipeline for status mode
      return { stages: new Map(), order: [] }
    default:
      return buildPipeline('full', profile, clarify, ctx)
  }
}

/**
 * Rebuild pipeline after taskify completes
 * Extends the pipeline with remaining stages based on profile.
 *
 * Uses the dedicated rebuildPipelineAfterTaskify from definitions.ts
 * which correctly respects the resolved profile for spec stage order,
 * unlike buildPipeline('rerun') which always uses SPEC_ORDER_STANDARD.
 */
export function rebuildPipelineAfterTaskify(
  currentPipeline: PipelineDefinition,
  ctx: PipelineContext,
): PipelineDefinition {
  return rebuildFromDefinitions(currentPipeline, ctx)
}

/**
 * Create rebuild callback for the engine
 */
export function createRebuildCallback(
  _mode: 'spec' | 'impl' | 'full' | 'rerun' | 'fix',
  _clarify: boolean,
): (ctx: PipelineContext) => PipelineDefinition {
  return (ctx) => rebuildPipelineAfterTaskify({ stages: new Map(), order: [] }, ctx)
}
