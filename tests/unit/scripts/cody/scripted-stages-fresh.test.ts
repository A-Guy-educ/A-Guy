/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern fresh-branch
 * @ai-summary Tests for --fresh flag branch suffixing in PR stage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFreshBranch } from 'scripts/cody/scripted-stages'

// Mock execFileSync
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    execFileSync: vi.fn(),
  }
})

import { execFileSync } from 'child_process'

describe('createFreshBranch', () => {
  const mockExecFileSync = execFileSync as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns -v2 when no versioned branches exist', () => {
    // Mock: no remote branches matching pattern
    mockExecFileSync.mockReturnValue('')

    const result = createFreshBranch('feat/260225-task', '/mock/cwd')

    expect(result).toBe('feat/260225-task-v2')
    // Verify branch list was called
    expect(mockExecFileSync).toHaveBeenCalled()
    // Verify checkout -b was called
    expect(mockExecFileSync).toHaveBeenLastCalledWith(
      'git',
      ['checkout', '-b', 'feat/260225-task-v2'],
      expect.any(Object),
    )
  })

  it('returns -v3 when -v2 already exists on remote', () => {
    // Mock: remote has feat/260225-task-v2
    mockExecFileSync.mockReturnValue('  origin/feat/260225-task-v2')

    const result = createFreshBranch('feat/260225-task', '/mock/cwd')

    expect(result).toBe('feat/260225-task-v3')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'feat/260225-task-v3'],
      expect.any(Object),
    )
  })

  it('returns -v4 when -v2 and -v3 exist on remote', () => {
    // Mock: remote has both v2 and v3
    mockExecFileSync.mockReturnValue('  origin/feat/260225-task-v2\n  origin/feat/260225-task-v3')

    const result = createFreshBranch('feat/260225-task', '/mock/cwd')

    expect(result).toBe('feat/260225-task-v4')
  })

  it('strips existing -vN suffix before computing next version', () => {
    // If current branch is already feat/260225-task-v2, should create v3 not v2-v3
    mockExecFileSync.mockReturnValue('  origin/feat/260225-task-v2')

    const result = createFreshBranch('feat/260225-task-v2', '/mock/cwd')

    expect(result).toBe('feat/260225-task-v3')
    // Should have stripped -v2 and found only v2 on remote, so returns v3
  })

  it('handles git command failure gracefully', () => {
    // Mock: git branch -r --list fails - use mockImplementationOnce
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('git command failed')
    })

    const result = createFreshBranch('feat/260225-task', '/mock/cwd')

    // Should fallback to -v2
    expect(result).toBe('feat/260225-task-v2')
  })

  it('handles branch already existing locally', () => {
    // First call (list) returns empty, second call (checkout -b) throws "already exists"
    mockExecFileSync
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => {
        throw new Error('fatal: A branch named feat/260225-task-v2 already exists')
      })
      // Third call is checkout (not -b)
      .mockReturnValueOnce('')

    const result = createFreshBranch('feat/260225-task', '/mock/cwd')

    expect(result).toBe('feat/260225-task-v2')
  })
})
