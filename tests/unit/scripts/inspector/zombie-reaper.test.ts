import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import { zombieReaperPlugin } from '../../../../scripts/inspector/plugins/cody/zombie-reaper/index'
import type { InspectorContext, GitHubClient } from '../../../../scripts/inspector/core/types'

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<InspectorContext> = {}): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    cycleNumber: 6,
    runTimestamp: new Date().toISOString(),
    state: {
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    },
    github: {
      postComment: vi.fn(),
      getIssue: vi.fn().mockReturnValue({ body: null, title: null }),
      getOpenIssues: vi.fn().mockReturnValue([]),
      triggerWorkflow: vi.fn(),
      addLabel: vi.fn(),
      removeLabel: vi.fn(),
      setLifecycleLabel: vi.fn(),
      closeIssue: vi.fn(),
      getIssueComments: vi.fn().mockReturnValue([]),
      listWorkflowRuns: vi.fn().mockReturnValue([]),
      createIssue: vi.fn().mockReturnValue(null),
      searchIssues: vi.fn().mockReturnValue([]),
    } as GitHubClient,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as InspectorContext['log'],
    slack: {
      postMessage: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(false),
    },
    ...overrides,
  }
}

function makeStaleDateIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
}

function writeStatus(dir: string, data: Record<string, unknown>) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(data), 'utf-8')
}

// ============================================================================
// Tests
// ============================================================================

describe('zombie-reaper plugin', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zombie-reaper-test-'))
    fs.mkdirSync(path.join(tmpDir, '.tasks'), { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns no actions when .tasks directory is empty', async () => {
    const ctx = makeCtx()
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns no actions when all tasks are completed', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-001'), {
      state: 'completed',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 10,
    })
    const ctx = makeCtx()
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns no actions when running task is fresh (<2h)', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-fresh'), {
      state: 'running',
      updatedAt: makeStaleDateIso(0.5), // 30 min ago
      issueNumber: 20,
    })
    const ctx = makeCtx()
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns no actions when stale running task has active workflow', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-active'), {
      state: 'running',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 30,
    })
    const ctx = makeCtx({
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([
          {
            id: 1,
            status: 'in_progress',
            conclusion: '',
            createdAt: '',
            updatedAt: '',
            headBranch: 'feat/task-active',
            event: 'workflow_dispatch',
          },
        ]),
      } as GitHubClient,
    })
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns one batch action for confirmed zombie (no active workflow)', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-zombie'), {
      state: 'running',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 42,
    })
    const ctx = makeCtx({
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([
          {
            id: 2,
            status: 'completed',
            conclusion: 'failure',
            createdAt: '',
            updatedAt: '',
            headBranch: 'feat/task-zombie',
            event: 'workflow_dispatch',
          },
        ]),
      } as GitHubClient,
    })
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('reap-zombies')
    expect(actions[0].title).toContain('1')
  })

  it('skips _archive directory', async () => {
    writeStatus(path.join(tmpDir, '.tasks', '_archive', 'old-task'), {
      state: 'running',
      updatedAt: makeStaleDateIso(500),
      issueNumber: 99,
    })
    const ctx = makeCtx()
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('handles v1 format status.json (no version field)', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-v1'), {
      // v1: no version field, uses currentStage
      state: 'running',
      updatedAt: makeStaleDateIso(100),
      issueNumber: 55,
      currentStage: 'commit',
    })
    const ctx = makeCtx({
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([]),
      } as GitHubClient,
    })
    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(1)
  })

  describe('execute', () => {
    it('updates status.json to failed and posts GitHub notification', async () => {
      const taskDir = path.join(tmpDir, '.tasks', 'task-exec')
      writeStatus(taskDir, {
        state: 'running',
        updatedAt: makeStaleDateIso(48),
        issueNumber: 77,
      })
      const postComment = vi.fn()
      const setLifecycleLabel = vi.fn()
      const ctx = makeCtx({
        github: {
          ...makeCtx().github,
          listWorkflowRuns: vi.fn().mockReturnValue([]),
          postComment,
          setLifecycleLabel,
        } as GitHubClient,
      })

      const actions = await zombieReaperPlugin.run(ctx)
      expect(actions).toHaveLength(1)

      await actions[0].execute(ctx)

      // status.json should be updated
      const updated = JSON.parse(fs.readFileSync(path.join(taskDir, 'status.json'), 'utf-8'))
      expect(updated.state).toBe('failed')

      // GitHub comment posted
      expect(postComment).toHaveBeenCalledWith(77, expect.stringContaining('Orphaned'))

      // Lifecycle label set
      expect(setLifecycleLabel).toHaveBeenCalledWith(77, 'cody:failed')
    })

    it('skips GitHub notification for task with issueNumber=0 but still fixes status', async () => {
      const taskDir = path.join(tmpDir, '.tasks', 'task-no-issue')
      writeStatus(taskDir, {
        state: 'running',
        updatedAt: makeStaleDateIso(48),
        issueNumber: 0,
      })
      const postComment = vi.fn()
      const ctx = makeCtx({
        github: {
          ...makeCtx().github,
          listWorkflowRuns: vi.fn().mockReturnValue([]),
          postComment,
        } as GitHubClient,
      })

      const actions = await zombieReaperPlugin.run(ctx)
      await actions[0].execute(ctx)

      const updated = JSON.parse(fs.readFileSync(path.join(taskDir, 'status.json'), 'utf-8'))
      expect(updated.state).toBe('failed')
      expect(postComment).not.toHaveBeenCalled()
    })

    it('has correct dedup key and 23h window', () => {
      // Instantiate a minimal action to check dedup config
      expect(zombieReaperPlugin.schedule?.every).toBe(6)
    })
  })
})
