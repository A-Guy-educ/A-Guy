import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execFileSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

import {
  setLifecycleLabel,
  setClassificationLabels,
  setProfileLabel,
  closeIssue,
  LIFECYCLE_LABELS,
  TASK_TYPE_LABELS,
  RISK_LABELS,
  COMPLEXITY_LABELS,
  DOMAIN_LABELS,
  PROFILE_LABELS,
} from '../../../../scripts/cody/github-api'

describe('setLifecycleLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call gh with --add-label and --remove-label for valid label', () => {
    setLifecycleLabel(123, 'cody:building')

    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['--add-label', 'cody:building']),
      expect.any(Object),
    )
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['--remove-label']),
      expect.any(Object),
    )
  })

  it('should remove all OTHER lifecycle labels (mutual exclusion)', () => {
    setLifecycleLabel(123, 'cody:building')

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const removeIndex = callArgs.indexOf('--remove-label')
    const removedLabels = callArgs[removeIndex + 1]

    // Should remove all lifecycle labels EXCEPT cody:building
    LIFECYCLE_LABELS.forEach((label) => {
      if (label !== 'cody:building') {
        expect(removedLabels).toContain(label)
      }
    })
    expect(removedLabels).not.toContain('cody:building')
  })

  it('should not call gh for invalid label', () => {
    setLifecycleLabel(123, 'invalid-label')

    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should not call gh when issueNumber is 0 or falsy', () => {
    setLifecycleLabel(0, 'cody:building')
    setLifecycleLabel(undefined as unknown as number, 'cody:building')
    setLifecycleLabel(null as unknown as number, 'cody:building')

    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should not throw when execFileSync throws (fire-and-forget)', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('gh command failed')
    })

    // Should not throw
    expect(() => setLifecycleLabel(123, 'cody:building')).not.toThrow()
  })
})

describe('setClassificationLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should map task_type fix_bug to type:bug', () => {
    setClassificationLabels(123, { task_type: 'fix_bug' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('type:bug')
  })

  it('should map task_type implement_feature to type:feature', () => {
    setClassificationLabels(123, { task_type: 'implement_feature' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('type:feature')
  })

  it('should map risk_level high to risk:high (bug #1 regression test)', () => {
    setClassificationLabels(123, { risk_level: 'high' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('risk:high')
  })

  it('should map risk_level low to risk:low', () => {
    setClassificationLabels(123, { risk_level: 'low' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('risk:low')
  })

  it('should map primary_domain backend to domain:backend (bug #2 regression test)', () => {
    setClassificationLabels(123, { primary_domain: 'backend' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('domain:backend')
  })

  it('should map primary_domain data to domain:data (new domain, bug #9)', () => {
    setClassificationLabels(123, { primary_domain: 'data' })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('domain:data')
  })

  it('should map complexity 25 to complexity:simple', () => {
    setClassificationLabels(123, { complexity: 25 })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('complexity:simple')
  })

  it('should map complexity 50 to complexity:moderate', () => {
    setClassificationLabels(123, { complexity: 50 })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('complexity:moderate')
  })

  it('should map complexity 80 to complexity:complex', () => {
    setClassificationLabels(123, { complexity: 80 })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('complexity:complex')
  })

  it('should set multiple labels in one call', () => {
    setClassificationLabels(123, {
      task_type: 'fix_bug',
      risk_level: 'high',
      complexity: 25,
      primary_domain: 'backend',
    })

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]
    const addIndex = callArgs.indexOf('--add-label')
    const labels = callArgs[addIndex + 1]

    expect(labels).toContain('type:bug')
    expect(labels).toContain('risk:high')
    expect(labels).toContain('complexity:simple')
    expect(labels).toContain('domain:backend')
  })

  it('should not call gh when no labels to set', () => {
    setClassificationLabels(123, {})

    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should not throw when execFileSync throws (fire-and-forget)', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('gh command failed')
    })

    // Should not throw
    expect(() => setClassificationLabels(123, { task_type: 'fix_bug' })).not.toThrow()
  })

  it('should ignore unknown risk_level values', () => {
    setClassificationLabels(123, { risk_level: 'unknown' })

    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should ignore unknown domain values', () => {
    setClassificationLabels(123, { primary_domain: 'unknown-domain' })

    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })
})

describe('setProfileLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add profile:lightweight and remove profile:standard', () => {
    setProfileLabel(123, 'lightweight')

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]

    expect(callArgs).toContain('--add-label')
    expect(callArgs).toContain('profile:lightweight')
    expect(callArgs).toContain('--remove-label')
    expect(callArgs).toContain('profile:standard')
  })

  it('should add profile:standard and remove profile:lightweight', () => {
    setProfileLabel(123, 'standard')

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]

    expect(callArgs).toContain('--add-label')
    expect(callArgs).toContain('profile:standard')
    expect(callArgs).toContain('--remove-label')
    expect(callArgs).toContain('profile:lightweight')
  })

  it('should not throw when execFileSync throws', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('gh command failed')
    })

    // Should not throw
    expect(() => setProfileLabel(123, 'lightweight')).not.toThrow()
  })
})

describe('closeIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call gh issue close with completed reason by default', () => {
    closeIssue(123)

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]

    expect(callArgs[0]).toBe('issue')
    expect(callArgs[1]).toBe('close')
    expect(callArgs[2]).toBe('123')
    expect(callArgs[3]).toBe('--reason')
    expect(callArgs[4]).toBe('completed')
  })

  it('should call gh issue close with not planned (space, not underscore) (bug #6 regression test)', () => {
    closeIssue(123, 'not planned')

    const callArgs = vi.mocked(childProcess.execFileSync).mock.calls[0]?.[1] as string[]

    expect(callArgs[3]).toBe('--reason')
    expect(callArgs[4]).toBe('not planned')
    expect(callArgs[4]).not.toBe('not_planned')
  })

  it('should not throw when execFileSync throws', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('gh command failed')
    })

    // Should not throw
    expect(() => closeIssue(123)).not.toThrow()
  })
})

describe('Label constants', () => {
  it('should have valid LIFECYCLE_LABELS', () => {
    expect(LIFECYCLE_LABELS).toContain('cody:planning')
    expect(LIFECYCLE_LABELS).toContain('cody:building')
    expect(LIFECYCLE_LABELS).toContain('cody:review')
    expect(LIFECYCLE_LABELS).toContain('cody:done')
    expect(LIFECYCLE_LABELS).toContain('cody:failed')
  })

  it('should have valid TASK_TYPE_LABELS', () => {
    expect(TASK_TYPE_LABELS).toContain('type:bug')
    expect(TASK_TYPE_LABELS).toContain('type:feature')
  })

  it('should have valid RISK_LABELS', () => {
    expect(RISK_LABELS).toContain('risk:high')
    expect(RISK_LABELS).toContain('risk:medium')
    expect(RISK_LABELS).toContain('risk:low')
  })

  it('should have valid COMPLEXITY_LABELS', () => {
    expect(COMPLEXITY_LABELS).toContain('complexity:simple')
    expect(COMPLEXITY_LABELS).toContain('complexity:moderate')
    expect(COMPLEXITY_LABELS).toContain('complexity:complex')
  })

  it('should have valid DOMAIN_LABELS', () => {
    expect(DOMAIN_LABELS).toContain('domain:backend')
    expect(DOMAIN_LABELS).toContain('domain:frontend')
    expect(DOMAIN_LABELS).toContain('domain:data')
  })

  it('should have valid PROFILE_LABELS', () => {
    expect(PROFILE_LABELS).toContain('profile:lightweight')
    expect(PROFILE_LABELS).toContain('profile:standard')
  })
})
