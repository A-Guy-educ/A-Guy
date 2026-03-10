import { describe, it, expect } from 'vitest'

/**
 * Test the rerun feedback routing logic:
 * When --feedback is provided and --from is build or later,
 * fromStage should be backed up to architect so the plan can be revised.
 */
import { resolveRerunFromStage } from '../../../../scripts/cody/rerun-utils'

describe('resolveRerunFromStage', () => {
  const IMPL_STAGES = [
    'gsd-research',
    'gsd-plan',
    'gsd-execute',
    'commit',
    'verify',
    'autofix',
    'pr',
  ]

  it('backs up to gsd-plan when feedback provided and from=gsd-execute', () => {
    const result = resolveRerunFromStage('gsd-execute', 'fix the type error', IMPL_STAGES)
    expect(result).toBe('gsd-plan')
  })

  it('backs up to gsd-plan when feedback provided and from=verify', () => {
    const result = resolveRerunFromStage('verify', 'lint errors found', IMPL_STAGES)
    expect(result).toBe('gsd-plan')
  })

  it('backs up to gsd-plan when feedback provided and from=commit', () => {
    const result = resolveRerunFromStage('commit', 'push failed', IMPL_STAGES)
    expect(result).toBe('gsd-plan')
  })

  it('stays at gsd-plan when feedback provided and from=gsd-plan', () => {
    const result = resolveRerunFromStage('gsd-plan', 'revise the plan', IMPL_STAGES)
    expect(result).toBe('gsd-plan')
  })

  it('keeps fromStage unchanged when NO feedback provided', () => {
    const result = resolveRerunFromStage('gsd-execute', undefined, IMPL_STAGES)
    expect(result).toBe('gsd-execute')
  })

  it('keeps fromStage unchanged when feedback is empty string', () => {
    const result = resolveRerunFromStage('gsd-execute', '', IMPL_STAGES)
    expect(result).toBe('gsd-execute')
  })

  it('keeps fromStage for spec stages even with feedback (spec stages not in impl list)', () => {
    const result = resolveRerunFromStage('taskify', 'some feedback', IMPL_STAGES)
    expect(result).toBe('taskify')
  })

  it('keeps fromStage for gsd-research (already before gsd-execute, after gsd-plan)', () => {
    const result = resolveRerunFromStage('gsd-research', 'feedback', IMPL_STAGES)
    expect(result).toBe('gsd-research')
  })
})
