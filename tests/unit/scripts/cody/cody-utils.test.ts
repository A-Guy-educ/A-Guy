import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execFileSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

import {
  discoverTaskIdFromIssue,
  ensureTaskMarkerComment,
  validateTaskId,
} from '../../../../scripts/cody/cody-utils'

describe('discoverTaskIdFromIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return task-id when bot comment contains Task created marker', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(
      '🎯 Task created: `260219-youtube-embed-integration`\n\nCody will now process this task.',
    )

    const result = discoverTaskIdFromIssue(42)
    expect(result).toBe('260219-youtube-embed-integration')
  })

  it('should return null when no bot comments contain the marker', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(
      '🔄 Cody starting for `260219-foo` (mode: full)\nRun: https://...',
    )

    const result = discoverTaskIdFromIssue(42)
    expect(result).toBeNull()
  })

  it('should return null when gh command fails', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('gh: command not found')
    })

    const result = discoverTaskIdFromIssue(42)
    expect(result).toBeNull()
  })

  it('should return null when issueNumber is 0', () => {
    const result = discoverTaskIdFromIssue(0)
    expect(result).toBeNull()
    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should return the first task-id when multiple markers exist', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(
      '🎯 Task created: `260218-first-task`\n\nCody will now process this task.\n' +
        '🎯 Task created: `260219-second-task`\n\nCody will now process this task.',
    )

    const result = discoverTaskIdFromIssue(42)
    expect(result).toBe('260218-first-task')
  })
})

describe('ensureTaskMarkerComment', () => {
  let execFileSyncCalls: Array<{ file: string; args: string[]; opts?: unknown }>

  beforeEach(() => {
    vi.clearAllMocks()
    execFileSyncCalls = []

    // Track all execFileSync calls to distinguish discover vs postComment calls
    vi.mocked(childProcess.execFileSync).mockImplementation(
      (...args: Parameters<typeof childProcess.execFileSync>) => {
        const [file, execArgs, opts] = args
        execFileSyncCalls.push({ file, args: [...(execArgs || [])], opts })

        // For discoverTaskIdFromIssue: gh issue view ... --json comments
        if (
          execArgs?.includes('issue') &&
          execArgs?.includes('view') &&
          execArgs?.includes('--json')
        ) {
          // Default: no marker found
          return ''
        }
        // For postComment: gh issue comment ... --body-file -
        if (execArgs?.includes('issue') && execArgs?.includes('comment')) {
          return ''
        }
        return ''
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should post marker comment when no existing marker found on issue', () => {
    ensureTaskMarkerComment(42, '260219-my-task')

    // Should have called execFileSync twice:
    // 1. discoverTaskIdFromIssue (gh issue view)
    // 2. postComment (gh issue comment)
    const postCalls = execFileSyncCalls.filter((c) => c.args.includes('comment') && c.file === 'gh')
    expect(postCalls).toHaveLength(1)
    expect(postCalls[0].args).toContain('42')
  })

  it('should NOT post marker when marker already exists for same task-id', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(
      (...args: Parameters<typeof childProcess.execFileSync>) => {
        const [, execArgs] = args
        if (execArgs?.includes('--json')) {
          return '🎯 Task created: `260219-my-task`\n\nCody will now process this task.'
        }
        return ''
      },
    )

    ensureTaskMarkerComment(42, '260219-my-task')

    // Should NOT have posted a comment
    const postCalls = execFileSyncCalls.filter(
      (c) => c.args.includes('issue') && c.args.includes('comment'),
    )
    expect(postCalls).toHaveLength(0)
  })

  it('should NOT post marker when marker exists for a different task-id', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(
      (...args: Parameters<typeof childProcess.execFileSync>) => {
        const [, execArgs] = args
        if (execArgs?.includes('--json')) {
          return '🎯 Task created: `260218-other-task`\n\nCody will now process this task.'
        }
        return ''
      },
    )

    ensureTaskMarkerComment(42, '260219-my-task')

    // Should NOT post — an existing marker means the issue already has a task
    const postCalls = execFileSyncCalls.filter(
      (c) => c.args.includes('issue') && c.args.includes('comment'),
    )
    expect(postCalls).toHaveLength(0)
  })

  it('should do nothing when issueNumber is 0', () => {
    ensureTaskMarkerComment(0, '260219-my-task')
    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should do nothing when taskId is empty', () => {
    ensureTaskMarkerComment(42, '')
    expect(childProcess.execFileSync).not.toHaveBeenCalled()
  })

  it('should handle gh command failure gracefully in discovery', () => {
    const localCalls: Array<{ file: string; args: string[] }> = []
    vi.mocked(childProcess.execFileSync).mockImplementation(
      (...args: Parameters<typeof childProcess.execFileSync>) => {
        const [file, execArgs] = args
        localCalls.push({ file, args: [...(execArgs || [])] })
        if (execArgs?.includes('--json')) {
          throw new Error('gh: Not Found (HTTP 404)')
        }
        // postComment should still be called
        return ''
      },
    )

    // Should not throw
    ensureTaskMarkerComment(42, '260219-my-task')

    // Discovery failed (returns null), so it should try to post
    const postCalls = localCalls.filter((c) => c.args.includes('comment'))
    expect(postCalls).toHaveLength(1)
  })
})

describe('validateTaskId', () => {
  it('should accept valid task IDs', () => {
    expect(validateTaskId('260219-my-task')).toBe(true)
    expect(validateTaskId('260219-youtube-embed-integration')).toBe(true)
    expect(validateTaskId('260218-55')).toBe(true)
    expect(validateTaskId('260219-auto-34')).toBe(true)
  })

  it('should reject invalid task IDs', () => {
    expect(validateTaskId('')).toBe(false)
    expect(validateTaskId('my-task')).toBe(false)
    expect(validateTaskId('260219')).toBe(false)
    expect(validateTaskId('youtube-embed-integration')).toBe(false)
    expect(validateTaskId('26021-short')).toBe(false)
  })
})

// ============================================================================
// getLastFailedStage Tests
// ============================================================================

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

import * as fs from 'fs'
import { getLastFailedStage } from '../../../../scripts/cody/cody-utils'

describe('getLastFailedStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when status.json does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const result = getLastFailedStage('260219-test')
    expect(result).toBeNull()
  })

  it('should return null when no stages have failed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          'gsd-plan': { state: 'completed', retries: 0 },
          'gsd-execute': { state: 'completed', retries: 0 },
        },
      }),
    )

    const result = getLastFailedStage('260219-test')
    expect(result).toBeNull()
  })

  it('should return the last failed stage', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          'gsd-plan': { state: 'completed', retries: 0 },
          'gsd-execute': { state: 'failed', retries: 1, error: 'Build failed' },
          verify: { state: 'completed', retries: 0 },
        },
      }),
    )

    const result = getLastFailedStage('260219-test')
    expect(result).toBe('gsd-execute')
  })

  it('should return the last stage when multiple stages failed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          'gsd-plan': { state: 'failed', retries: 1 },
          'gsd-execute': { state: 'failed', retries: 1 },
          verify: { state: 'failed', retries: 1 },
        },
      }),
    )

    const result = getLastFailedStage('260219-test')
    expect(result).toBe('verify')
  })

  it('should return stage with timeout state', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          'gsd-execute': { state: 'timeout', retries: 1 },
        },
      }),
    )

    const result = getLastFailedStage('260219-test')
    expect(result).toBe('gsd-execute')
  })

  it('should return null when stages object is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
      }),
    )

    const result = getLastFailedStage('260219-test')
    expect(result).toBeNull()
  })
})

// ============================================================================
// getLastPausedStage Tests (FIX #5)
// ============================================================================

import { getLastPausedStage } from '../../../../scripts/cody/cody-utils'

describe('getLastPausedStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when status.json does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const result = getLastPausedStage('260219-test')
    expect(result).toBeNull()
  })

  it('should return null when no stages are paused', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          'gsd-plan': { state: 'completed', retries: 0 },
          'gsd-execute': { state: 'completed', retries: 0 },
        },
      }),
    )

    const result = getLastPausedStage('260219-test')
    expect(result).toBeNull()
  })

  it('should return the paused stage', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          'gsd-plan': { state: 'paused', retries: 0 },
          'gsd-execute': { state: 'pending', retries: 0 },
        },
      }),
    )

    const result = getLastPausedStage('260219-test')
    expect(result).toBe('gsd-plan')
  })

  it('should return the last paused stage when multiple are paused', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        taskId: '260219-test',
        stages: {
          taskify: { state: 'paused', retries: 0 },
          'gsd-plan': { state: 'paused', retries: 0 },
          'gsd-execute': { state: 'pending', retries: 0 },
        },
      }),
    )

    const result = getLastPausedStage('260219-test')
    expect(result).toBe('gsd-plan') // last one
  })

  it('should handle v2 format with version field', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        version: 2,
        taskId: '260219-test',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          'gsd-plan': { state: 'paused', retries: 0 },
        },
      }),
    )

    const result = getLastPausedStage('260219-test')
    expect(result).toBe('gsd-plan')
  })
})

// ============================================================================
// editComment Tests (R6: stdin-based implementation)
// ============================================================================

import { editComment } from '../../../../scripts/cody/cody-utils'

describe('editComment', () => {
  let execFileSyncSpy: ReturnType<typeof vi.spyOn>
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo')
    execFileSyncSpy = vi.spyOn(childProcess, 'execFileSync').mockReturnValue('')
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should call gh api to patch the comment using execFileSync with stdin', () => {
    editComment('42', 'Updated body')

    expect(execFileSyncSpy).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining([
        'api',
        expect.stringContaining('issues/comments/42'),
        '-X',
        'PATCH',
        '--input',
        '-',
      ]),
      expect.objectContaining({
        input: JSON.stringify({ body: 'Updated body' }),
        stdio: expect.any(Array),
      }),
    )
  })

  it('should not throw when gh api call fails', () => {
    execFileSyncSpy.mockImplementation(() => {
      throw new Error('gh api failed')
    })

    // Should not throw
    expect(() => editComment('42', 'Updated body')).not.toThrow()
  })

  it('should return early when commentId is empty', () => {
    editComment('', 'Updated body')

    expect(execFileSyncSpy).not.toHaveBeenCalled()
  })

  it('should return early when GITHUB_REPOSITORY is not set', () => {
    vi.stubEnv('GITHUB_REPOSITORY', '')

    // Should not throw and should not call execFileSync
    expect(() => editComment('42', 'Updated body')).not.toThrow()
    expect(execFileSyncSpy).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Issue #501: Duplicate comment fix tests
// Verify that the "Cody started" comment was removed to prevent duplicate
// comments on GitHub issues (both "Cody started" and "Task created" were posted)
// ============================================================================

import * as path from 'path'
import { createRequire } from 'module'

// Get the real fs module (bypass the mock)
const require = createRequire(import.meta.url)
const realFs: typeof import('fs') = require('fs')

describe('Issue #501: Duplicate comment fix', () => {
  const entryTsPath = path.resolve(__dirname, '../../../../scripts/cody/entry.ts')

  it('should NOT contain "Cody started" comment pattern that causes duplicates', () => {
    // Read the entry.ts file using real fs (bypass mock)
    const entryTsContent = realFs.readFileSync(entryTsPath, 'utf-8')

    // Verify the duplicate comment pattern is removed
    // The old code posted "🚀 Cody started for..." unconditionally
    // Now only "Task created" marker is posted (via ensureTaskMarkerComment)
    expect(entryTsContent).not.toContain('Cody started for')
    expect(entryTsContent).not.toContain('🚀 Cody started')
  })

  it('should still call ensureTaskMarkerComment for task tracking', () => {
    // Read the entry.ts file using real fs (bypass mock)
    const entryTsContent = realFs.readFileSync(entryTsPath, 'utf-8')

    // ensureTaskMarkerComment should still be called - this handles both:
    // - Posting "Task created" marker on fresh issues
    // - Skipping duplicate posts on reruns
    expect(entryTsContent).toContain('ensureTaskMarkerComment')
  })
})
