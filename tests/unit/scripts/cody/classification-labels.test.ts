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

// Helper to get the last execFileSync call args
const getLastGhCall = () => {
  const calls = vi.mocked(childProcess.execFileSync).mock.calls
  const ghCalls = calls.filter((c) => c[0] === 'gh')
  return ghCalls[ghCalls.length - 1]
}

const getGhArgs = () => {
  const call = getLastGhCall()
  return call?.[1] as string[]
}

// ============================================================================
// setClassificationLabels — stale label removal
// ============================================================================

describe('setClassificationLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add risk label and remove other risk labels', () => {
    setClassificationLabels(100, { risk_level: 'medium' })

    const args = getGhArgs()
    expect(args).toContain('--add-label')
    expect(args).toContain('--remove-label')

    const addIdx = args.indexOf('--add-label')
    const removeIdx = args.indexOf('--remove-label')
    const addedLabels = args[addIdx + 1]
    const removedLabels = args[removeIdx + 1]

    expect(addedLabels).toContain('risk:medium')
    expect(removedLabels).toContain('risk:high')
    expect(removedLabels).toContain('risk:low')
    expect(removedLabels).not.toContain('risk:medium')
  })

  it('should remove old risk labels when risk changes from low to high', () => {
    setClassificationLabels(200, { risk_level: 'high' })

    const args = getGhArgs()
    const removeIdx = args.indexOf('--remove-label')
    const removedLabels = args[removeIdx + 1]

    expect(removedLabels).toContain('risk:low')
    expect(removedLabels).toContain('risk:medium')
    expect(removedLabels).not.toContain('risk:high')
  })

  it('should remove old type labels when setting a new type', () => {
    setClassificationLabels(300, { task_type: 'fix_bug' })

    const args = getGhArgs()
    const addIdx = args.indexOf('--add-label')
    const removeIdx = args.indexOf('--remove-label')
    const addedLabels = args[addIdx + 1]
    const removedLabels = args[removeIdx + 1]

    expect(addedLabels).toContain('type:bug')
    expect(removedLabels).toContain('type:feature')
    expect(removedLabels).toContain('type:refactor')
    expect(removedLabels).not.toContain('type:bug')
  })

  it('should remove old complexity labels when setting new complexity', () => {
    setClassificationLabels(400, { complexity: 75 }) // complex

    const args = getGhArgs()
    const removeIdx = args.indexOf('--remove-label')
    const removedLabels = args[removeIdx + 1]

    expect(removedLabels).toContain('complexity:simple')
    expect(removedLabels).toContain('complexity:moderate')
    expect(removedLabels).not.toContain('complexity:complex')
  })

  it('should remove old domain labels when setting new domain', () => {
    setClassificationLabels(500, { primary_domain: 'frontend' })

    const args = getGhArgs()
    const removeIdx = args.indexOf('--remove-label')
    const removedLabels = args[removeIdx + 1]

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

    const args = getGhArgs()
    const addIdx = args.indexOf('--add-label')
    const removeIdx = args.indexOf('--remove-label')
    const addedLabels = args[addIdx + 1].split(',')
    const removedLabels = args[removeIdx + 1].split(',')

    // Added labels
    expect(addedLabels).toContain('type:feature')
    expect(addedLabels).toContain('risk:low')
    expect(addedLabels).toContain('complexity:moderate')
    expect(addedLabels).toContain('domain:backend')

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

  it('should not include --remove-label when no labels to remove', () => {
    // No valid labels to add means no labels to remove either
    setClassificationLabels(700, {})

    // Should not have called gh at all (no labels)
    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    const ghCalls = calls.filter((c) => c[0] === 'gh')
    expect(ghCalls).toHaveLength(0)
  })

  it('should not call gh when issueNumber is 0', () => {
    setClassificationLabels(0, { risk_level: 'high' })

    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    expect(calls).toHaveLength(0)
  })
})
