/**
 * @fileType test
 * @domain cody | engine
 * @pattern entry-mode-tests
 * @ai-summary Tests for pipeline mode resolution and construction
 */

import { describe, it, expect } from 'vitest'
import { resolvePipelineForMode } from '../../../../scripts/cody/engine/pipeline-resolver'
import { buildPipeline, flattenPipelineOrder } from '../../../../scripts/cody/pipeline/definitions'
import {
  isValidStageName,
  flattenTypedPipeline,
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
} from '../../../../scripts/cody/stages/registry'
import { createMockPipelineContext } from '../../../helpers/cody'

describe('entry modes: resolvePipelineForMode', () => {
  it('full mode produces spec + impl stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('full', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Should contain spec stages
    expect(stages).toContain('taskify')
    expect(stages).toContain('gap')

    // Should contain impl stages
    expect(stages).toContain('architect')
    expect(stages).toContain('build')
    expect(stages).toContain('pr')
  })

  it('spec mode produces only spec stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('spec', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Should contain spec stages
    expect(stages).toContain('taskify')
    expect(stages).toContain('gap')

    // Should NOT contain impl stages
    expect(stages).not.toContain('architect')
    expect(stages).not.toContain('build')
    expect(stages).not.toContain('pr')
  })

  it('impl mode produces only impl stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('impl', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Should NOT contain spec stages
    expect(stages).not.toContain('taskify')
    expect(stages).not.toContain('gap')

    // Should contain impl stages
    expect(stages).toContain('architect')
    expect(stages).toContain('build')
    expect(stages).toContain('pr')
  })

  it('fix mode produces full fix pipeline (taskify → architect → ... → pr)', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('fix', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Fix mode now uses FIX_FULL_ORDER: full pipeline with taskify prepended
    // This gives the agent proper planning context from previous run
    expect(stages).toContain('taskify')
    expect(stages).toContain('architect')
    expect(stages).toContain('build')
    expect(stages).toContain('review')
    expect(stages).toContain('fix')
    expect(stages).toContain('verify')
    expect(stages).toContain('pr')
  })

  it('lightweight profile excludes gap', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('full', 'lightweight', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Lightweight spec order: ['taskify', 'clarify'] — no gap
    // But clarify=false filters out clarify, leaving just taskify
    expect(stages).toContain('taskify')
    expect(stages).not.toContain('gap')
  })

  it('standard profile includes gap', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('full', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).toContain('taskify')
    expect(stages).toContain('gap')
  })

  it('lightweight impl excludes plan-gap', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('impl', 'lightweight', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).not.toContain('plan-gap')
    expect(stages).toContain('architect')
    expect(stages).toContain('build')
  })

  it('standard impl includes plan-gap', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('impl', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).toContain('plan-gap')
  })

  it('rerun mode includes both spec and impl stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('rerun', 'standard', true, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    // Rerun mode should have both spec and impl stages for resuming from any point
    expect(stages).toContain('taskify')
    expect(stages).toContain('gap')
    expect(stages).toContain('architect')
    expect(stages).toContain('build')
    expect(stages).toContain('pr')
  })

  it('status mode produces empty pipeline', () => {
    const ctx = createMockPipelineContext()
    const pipeline = resolvePipelineForMode('status', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).toHaveLength(0)
    expect(pipeline.stages.size).toBe(0)
  })

  it('clarify=true includes clarify in spec stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('spec', 'standard', true, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).toContain('clarify')
  })

  it('clarify=false excludes clarify from spec stages', () => {
    const ctx = createMockPipelineContext()
    const pipeline = buildPipeline('spec', 'standard', false, ctx)
    const stages = flattenPipelineOrder(pipeline.order)

    expect(stages).not.toContain('clarify')
  })
})

describe('pipeline orders use only valid StageName values', () => {
  const allOrders = [
    { name: 'SPEC_ORDER_STANDARD', order: SPEC_ORDER_STANDARD },
    { name: 'SPEC_ORDER_LIGHTWEIGHT', order: SPEC_ORDER_LIGHTWEIGHT },
    { name: 'IMPL_ORDER_STANDARD', order: IMPL_ORDER_STANDARD },
    { name: 'IMPL_ORDER_LIGHTWEIGHT', order: IMPL_ORDER_LIGHTWEIGHT },
  ]

  for (const { name, order } of allOrders) {
    it(`${name} contains only valid StageName values`, () => {
      const flat = flattenTypedPipeline(order)
      for (const stage of flat) {
        expect(isValidStageName(stage)).toBe(true)
      }
    })
  }

  it('all modes produce only valid stage names in pipeline', () => {
    const ctx = createMockPipelineContext()
    const modes = ['spec', 'impl', 'full', 'rerun', 'fix'] as const

    for (const mode of modes) {
      const pipeline = resolvePipelineForMode(mode, 'standard', false, ctx)
      const stages = flattenPipelineOrder(pipeline.order)

      for (const stage of stages) {
        expect(isValidStageName(stage)).toBe(true)
      }
    }
  })
})
