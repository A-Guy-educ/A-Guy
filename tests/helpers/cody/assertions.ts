/**
 * @fileType test-helper
 * @domain cody | testing
 * @pattern pipeline-assertions
 * @ai-summary Reusable assertion helpers for pipeline stage ordering and composition tests
 */

import { expect } from 'vitest'
import { flattenTypedPipeline } from '../../../scripts/cody/stages/registry'
import type { StageName, TypedPipelineStep } from '../../../scripts/cody/stages/registry'

/**
 * Assert that a pipeline contains a specific stage (anywhere in the order).
 */
export function expectPipelineContains(order: TypedPipelineStep[], stage: StageName): void {
  const flat = flattenTypedPipeline(order)
  expect(flat).toContain(stage)
}

/**
 * Assert that `before` appears earlier than `after` in the flattened pipeline.
 * Both stages must be present.
 */
export function expectStageOrder(
  order: TypedPipelineStep[],
  before: StageName,
  after: StageName,
): void {
  const flat = flattenTypedPipeline(order)
  const beforeIdx = flat.indexOf(before)
  const afterIdx = flat.indexOf(after)
  expect(beforeIdx).toBeGreaterThanOrEqual(0)
  expect(afterIdx).toBeGreaterThanOrEqual(0)
  expect(beforeIdx).toBeLessThan(afterIdx)
}

/**
 * Assert that a pipeline has at least `min` stages (after flattening parallel groups).
 */
export function expectMinimumStages(order: TypedPipelineStep[], min: number): void {
  const flat = flattenTypedPipeline(order)
  expect(flat.length).toBeGreaterThanOrEqual(min)
}

/**
 * Assert that no ghost stages appear in the pipeline.
 * Ghost stages are names that were removed from the pipeline but may linger in tests:
 * - 'spec' — merged into 'gap'
 * - 'autofix' — not a real stage; it's a sub-behavior of build feedback loops
 * - 'reflect' — never existed as a pipeline stage
 */
export function expectNoGhostStages(order: TypedPipelineStep[]): void {
  const flat = flattenTypedPipeline(order) as string[]
  expect(flat).not.toContain('spec')
  expect(flat).not.toContain('autofix')
  expect(flat).not.toContain('reflect')
}
