/**
 * @fileType engine
 * @domain cody | engine
 * @pattern pipeline-resolver
 * @ai-summary Pipeline construction based on mode and profile
 */

import type { PipelineDefinition, PipelineContext } from '../engine/types'
import { buildPipeline } from '../pipeline/definitions'

/**
 * Resolve pipeline for a given mode
 */
export function resolvePipelineForMode(
  mode: 'spec' | 'impl' | 'full' | 'rerun' | 'status',
  profile: 'standard' | 'lightweight',
  clarify: boolean,
  ctx: PipelineContext,
): PipelineDefinition {
  switch (mode) {
    case 'spec':
    case 'full':
      return buildPipeline(mode, profile, clarify, ctx)
    case 'impl':
    case 'rerun':
      return buildPipeline('impl', profile, clarify, ctx)
    case 'status':
      // No pipeline for status mode
      return { stages: new Map(), order: [] }
    default:
      return buildPipeline('full', profile, clarify, ctx)
  }
}

/**
 * Rebuild pipeline after taskify completes
 * Extends the pipeline with remaining stages based on profile
 */
export function rebuildPipelineAfterTaskify(
  _currentPipeline: PipelineDefinition,
  ctx: PipelineContext,
): PipelineDefinition {
  // Re-build with the resolved profile
  return buildPipeline('full', ctx.profile, ctx.input.clarify ?? false, ctx)
}

/**
 * Create rebuild callback for the engine
 */
export function createRebuildCallback(
  _mode: 'spec' | 'impl' | 'full' | 'rerun',
  _clarify: boolean,
): (ctx: PipelineContext) => PipelineDefinition {
  return (ctx) => rebuildPipelineAfterTaskify({ stages: new Map(), order: [] }, ctx)
}
