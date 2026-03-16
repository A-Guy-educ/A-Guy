import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execFileSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
}))

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

import { setClassificationLabels } from '../../../../scripts/cody/github-api'

// Helper to get all gh calls
const getGhCalls = () => {
  const calls = vi.mocked(childProcess.execFileSync).mock.calls
  return calls.filter((c) => c[0] === 'gh').map((c) => c[1] as string[])
}

// Helper to find the add-label call
const getAddCall = () => getGhCalls().find((args) => args.includes('--add-label'))

// Helper to find the remove-label call
const getRemoveCall = () => getGhCalls().find((args) => args.includes('--remove-label'))

// ============================================================================
// setClassificationLabels — split add/remove calls
// ============================================================================

describe('setClassificationLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should make separate gh calls for add and remove (split for resilience)', () => {
    setClassificationLabels(100, { risk_level: 'medium' })

    const ghCalls = getGhCalls()
    // Should be 2 calls: one for add, one for remove
    expect(ghCalls.length).toBe(2)

    const addCall = getAddCall()
    const removeCall = getRemoveCall()
    expect(addCall).toBeDefined()
    expect(removeCall).toBeDefined()
  })

  it('should add risk label and remove other risk labels', () => {
    setClassificationLabels(100, { risk_level: 'medium' })

    const addCall = getAddCall()!
    const addIdx = addCall.indexOf('--add-label')
    const addedLabels = addCall[addIdx + 1]
    expect(addedLabels).toContain('risk:medium')

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1]
    expect(removedLabels).toContain('risk:high')
    expect(removedLabels).toContain('risk:low')
    expect(removedLabels).not.toContain('risk:medium')
  })

  it('should remove old risk labels when risk changes from low to high', () => {
    setClassificationLabels(200, { risk_level: 'high' })

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1]

    expect(removedLabels).toContain('risk:low')
    expect(removedLabels).toContain('risk:medium')
    expect(removedLabels).not.toContain('risk:high')
  })

  it('should remove old type labels when setting a new type', () => {
    setClassificationLabels(300, { task_type: 'fix_bug' })

    const addCall = getAddCall()!
    const addIdx = addCall.indexOf('--add-label')
    const addedLabels = addCall[addIdx + 1]
    expect(addedLabels).toContain('type:bug')

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1]
    expect(removedLabels).toContain('type:feature')
    expect(removedLabels).toContain('type:refactor')
    expect(removedLabels).not.toContain('type:bug')
  })

  it('should remove old complexity labels when setting new complexity', () => {
    setClassificationLabels(400, { complexity: 75 }) // complex

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1]

    expect(removedLabels).toContain('complexity:simple')
    expect(removedLabels).toContain('complexity:moderate')
    expect(removedLabels).not.toContain('complexity:complex')
  })

  it('should remove old domain labels when setting new domain', () => {
    setClassificationLabels(500, { primary_domain: 'frontend' })

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1]

    expect(removedLabels).toContain('domain:backend')
    expect(removedLabels).toContain('domain:infra')
    expect(removedLabels).not.toContain('domain:frontend')
  })

  it('should handle multiple categories at once', () => {
    setClassificationLabels(600, {
      task_type: 'implement_feature',
      risk_level: 'low',
      complexity: 20,
      primary_domain: 'backend',
    })

    const addCall = getAddCall()!
    const addIdx = addCall.indexOf('--add-label')
    const addedLabels = addCall[addIdx + 1].split(',')

    // Added labels
    expect(addedLabels).toContain('type:feature')
    expect(addedLabels).toContain('risk:low')
    expect(addedLabels).toContain('complexity:moderate')
    expect(addedLabels).toContain('domain:backend')

    const removeCall = getRemoveCall()!
    const removeIdx = removeCall.indexOf('--remove-label')
    const removedLabels = removeCall[removeIdx + 1].split(',')

    // Removed labels should NOT include the ones we're adding
    expect(removedLabels).not.toContain('type:feature')
    expect(removedLabels).not.toContain('risk:low')
    expect(removedLabels).not.toContain('complexity:moderate')
    expect(removedLabels).not.toContain('domain:backend')

    // But should include competing labels
    expect(removedLabels).toContain('type:bug')
    expect(removedLabels).toContain('risk:high')
    expect(removedLabels).toContain('complexity:complex')
    expect(removedLabels).toContain('domain:frontend')
  })

  it('should not include remove call when no labels to remove', () => {
    // No valid labels to add means no labels to remove either
    setClassificationLabels(700, {})

    const ghCalls = getGhCalls()
    expect(ghCalls).toHaveLength(0)
  })

  it('should not call gh when issueNumber is 0', () => {
    setClassificationLabels(0, { risk_level: 'high' })

    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    expect(calls).toHaveLength(0)
  })

  // NEW: Tests for the split add/remove resilience fix
  it('should succeed adding labels even when remove fails (missing repo labels)', () => {
    let callCount = 0
    vi.mocked(childProcess.execFileSync).mockImplementation((..._args: unknown[]) => {
      callCount++
      const args = _args[1] as string[]
      // Fail only the remove call (second call)
      if (args.includes('--remove-label')) {
        throw new Error("'domain:data' not found")
      }
      return Buffer.from('')
    })

    // Should not throw — remove failure is silently ignored
    expect(() =>
      setClassificationLabels(123, { task_type: 'fix_bug', primary_domain: 'frontend' }),
    ).not.toThrow()

    // Both calls were attempted
    expect(callCount).toBe(2)
  })

  it('should use pipe stdio instead of inherit to avoid leaking stderr', () => {
    setClassificationLabels(123, { risk_level: 'high' })

    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    for (const call of calls) {
      if (call[0] === 'gh') {
        const opts = call[2] as { stdio: string[] }
        expect(opts.stdio).toEqual(['pipe', 'pipe', 'pipe'])
      }
    }
  })
})
