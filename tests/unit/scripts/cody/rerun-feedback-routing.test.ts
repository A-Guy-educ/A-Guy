import { describe, it, expect } from 'vitest'

/**
 * Test the rerun feedback routing logic:
 * When --feedback is provided and --from is build or later,
 * fromStage should be backed up to architect so the plan can be revised.
 */
import { resolveRerunFromStage } from '../../../../scripts/cody/rerun-utils'

describe('resolveRerunFromStage', () => {
  const IMPL_STAGES = ['architect', 'plan-gap', 'build', 'commit', 'verify', 'autofix', 'pr']

  it('backs up to architect when feedback provided and from=build', () => {
    const result = resolveRerunFromStage('build', 'fix the type error', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('backs up to architect when feedback provided and from=verify', () => {
    const result = resolveRerunFromStage('verify', 'lint errors found', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('backs up to architect when feedback provided and from=commit', () => {
    const result = resolveRerunFromStage('commit', 'push failed', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('stays at architect when feedback provided and from=architect', () => {
    const result = resolveRerunFromStage('architect', 'revise the plan', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('keeps fromStage unchanged when NO feedback provided', () => {
    const result = resolveRerunFromStage('build', undefined, IMPL_STAGES)
    expect(result).toBe('build')
  })

  it('keeps fromStage unchanged when feedback is empty string', () => {
    const result = resolveRerunFromStage('build', '', IMPL_STAGES)
    expect(result).toBe('build')
  })

  it('keeps fromStage for spec stages even with feedback (spec stages not in impl list)', () => {
    const result = resolveRerunFromStage('taskify', 'some feedback', IMPL_STAGES)
    expect(result).toBe('taskify')
  })

  it('keeps fromStage for plan-gap (already before build, after architect)', () => {
    const result = resolveRerunFromStage('plan-gap', 'feedback', IMPL_STAGES)
    expect(result).toBe('plan-gap')
  })
})
