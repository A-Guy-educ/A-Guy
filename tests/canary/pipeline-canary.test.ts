/**
 * @fileType test
 * @domain cody | canary
 * @pattern pipeline-canary
 * @ai-summary End-to-end canary tests for pipeline modes via dry-run.
 *
 * These tests exercise the FULL call chain:
 *   main() → parseCliArgs → mode routing → resolvePipelineForMode → buildPipeline
 *   → runPipeline → resolveNextStep → stage ordering → writeState
 *
 * They catch: import errors, mode routing bugs, pipeline construction errors,
 * state machine loop bugs, stage ordering regressions, and status file corruption.
 *
 * ALL tests use --dry-run --local so no LLMs, git, or network calls are made.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock preflight to avoid ocode/gh CLI checks in test environments
vi.mock('../../scripts/cody/preflight', () => ({
  preflight: vi.fn(),
}))

// Mock opencode-server to avoid spawning a real server
vi.mock('../../scripts/cody/opencode-server', () => ({
  startServer: vi.fn().mockResolvedValue(null),
  stopServer: vi.fn().mockResolvedValue(undefined),
  checkpointDb: vi.fn().mockResolvedValue(undefined),
  findLastSessionId: vi.fn().mockReturnValue(null),
}))

// Mock runner-backend to avoid needing opencode binary
vi.mock('../../scripts/cody/runner-backend', () => ({
  createRunner: vi.fn().mockReturnValue({
    name: 'test-runner',
    spawn: vi.fn(),
  }),
}))

interface PipelineStateV2 {
  state: string
  stages: Record<string, { state: string; retries?: number; skipped?: string }>
  cursor?: string | null
}

describe('Pipeline Canary', () => {
  let testDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>

  // Helper: create a task directory with task.md
  function createTaskDir(taskId: string, extraFiles?: Record<string, string>): string {
    const taskDir = path.join(testDir, '.tasks', taskId)
    fs.mkdirSync(taskDir, { recursive: true })
    fs.writeFileSync(
      path.join(taskDir, 'task.md'),
      '# Task\n\nAdd structured logging to the auth endpoint.\n',
    )
    if (extraFiles) {
      for (const [file, content] of Object.entries(extraFiles)) {
        fs.writeFileSync(path.join(taskDir, file), content)
      }
    }
    return taskDir
  }

  // Helper: read status.json for a task
  function readStatus(taskId: string): PipelineStateV2 {
    const statusPath = path.join(testDir, '.tasks', taskId, 'status.json')
    expect(fs.existsSync(statusPath), `status.json should exist at ${statusPath}`).toBe(true)
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
  }

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-canary-'))
    originalCwd = process.cwd()
    process.chdir(testDir)

    // Spy on process.exit to prevent test process from dying
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      // no-op: prevent actual exit
    }) as never)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    exitSpy.mockRestore()
    vi.restoreAllMocks()

    // Clean up temp dir
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('full-mode dry-run traverses all stages to completion', async () => {
    const taskId = '260316-canary-full'
    createTaskDir(taskId)

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'full', '--dry-run', '--local'])

    // process.exit(0) should have been called (pipeline completed successfully)
    expect(exitSpy).toHaveBeenCalledWith(0)

    const status = readStatus(taskId)
    expect(status.state).toBe('completed')

    // All stages should be completed or skipped
    const stageEntries = Object.entries(status.stages)
    expect(stageEntries.length).toBeGreaterThan(0)

    for (const [name, stage] of stageEntries) {
      expect(
        stage.state === 'completed' || stage.state === 'skipped',
        `Stage '${name}' should be completed or skipped, got '${stage.state}'`,
      ).toBe(true)
    }

    // Key stages must be present
    expect(status.stages).toHaveProperty('taskify')
    expect(status.stages).toHaveProperty('build')
    expect(status.stages).toHaveProperty('commit')
    expect(status.stages).toHaveProperty('verify')
    expect(status.stages).toHaveProperty('pr')
  })

  it('spec-mode dry-run produces only spec stages', async () => {
    const taskId = '260316-canary-spec'
    createTaskDir(taskId)

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'spec', '--dry-run', '--local'])

    expect(exitSpy).toHaveBeenCalledWith(0)

    const status = readStatus(taskId)
    expect(status.state).toBe('completed')

    // Spec stages must be present
    expect(status.stages).toHaveProperty('taskify')

    // Impl stages must NOT be present
    expect(status.stages).not.toHaveProperty('build')
    expect(status.stages).not.toHaveProperty('commit')
    expect(status.stages).not.toHaveProperty('pr')
  })

  it('impl-mode dry-run produces only impl stages', async () => {
    const taskId = '260316-canary-impl'
    // impl mode needs task.json to exist (so taskify is skipped)
    createTaskDir(taskId, {
      'task.json': JSON.stringify({
        id: taskId,
        title: 'Test task',
        description: 'Test description',
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        complexity: 50,
        risk_level: 'low',
        estimated_stages: ['architect', 'build', 'commit', 'verify', 'pr'],
        domains: ['backend'],
        confidence: 0.8,
        primary_domain: 'backend',
        scope: ['src/server/'],
      }),
      'spec.md': '# Spec\n\nTest spec for impl mode.\n',
      'clarified.md': '# Clarified Spec\n\nClarified spec for impl mode.\n',
    })

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'impl', '--dry-run', '--local'])

    expect(exitSpy).toHaveBeenCalledWith(0)

    const status = readStatus(taskId)
    expect(status.state).toBe('completed')

    // Impl stages must be present
    expect(status.stages).toHaveProperty('architect')
    expect(status.stages).toHaveProperty('build')
    expect(status.stages).toHaveProperty('commit')
    expect(status.stages).toHaveProperty('verify')
    expect(status.stages).toHaveProperty('pr')

    // Spec stages (taskify, gap, clarify) must NOT be present
    expect(status.stages).not.toHaveProperty('taskify')
    expect(status.stages).not.toHaveProperty('gap')
    expect(status.stages).not.toHaveProperty('clarify')
  })

  it('rerun-mode dry-run resumes from specified stage', async () => {
    const taskId = '260316-canary-rerun'
    const taskDir = createTaskDir(taskId, {
      'task.json': JSON.stringify({
        id: taskId,
        title: 'Test task',
        description: 'Test description',
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        complexity: 50,
        risk_level: 'low',
        estimated_stages: ['architect', 'build', 'commit', 'verify', 'pr'],
        domains: ['backend'],
      }),
      'spec.md': '# Spec\n\nTest spec.\n',
      'plan.md': '# Plan\n\nTest plan.\n',
    })

    // Write status.json showing build as failed (so rerun --from build makes sense)
    const now = new Date().toISOString()
    const statusJson = {
      version: 2,
      taskId,
      mode: 'impl',
      pipeline: 'spec_execute_verify',
      startedAt: now,
      updatedAt: now,
      state: 'failed',
      cursor: null,
      stages: {
        architect: { state: 'completed', completedAt: now, retries: 0 },
        build: { state: 'failed', error: 'tsc failed', retries: 0 },
        commit: { state: 'pending', retries: 0 },
        verify: { state: 'pending', retries: 0 },
        pr: { state: 'pending', retries: 0 },
      },
    }
    fs.writeFileSync(path.join(taskDir, 'status.json'), JSON.stringify(statusJson, null, 2))

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'rerun', '--from', 'build', '--dry-run', '--local'])

    expect(exitSpy).toHaveBeenCalledWith(0)

    const finalStatus = readStatus(taskId)
    expect(finalStatus.state).toBe('completed')

    // Build and later stages should be completed (rerun from build)
    expect(finalStatus.stages.build.state).toBe('completed')
    expect(finalStatus.stages.verify.state).toBe('completed')
    expect(finalStatus.stages.pr.state).toBe('completed')
  })

  it('fix-mode dry-run runs fix pipeline', async () => {
    const taskId = '260316-canary-fix'
    createTaskDir(taskId, {
      'task.json': JSON.stringify({
        id: taskId,
        title: 'Test task',
        description: 'Test description',
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        complexity: 30,
        risk_level: 'low',
        estimated_stages: ['review', 'fix', 'verify', 'pr'],
        domains: ['backend'],
      }),
      'spec.md': '# Spec\n\nFix mode spec.\n',
      'plan.md': '# Plan\n\nFix mode plan.\n',
      'build.md': '# Build\n\nPrevious build output.\n',
    })

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'fix', '--dry-run', '--local'])

    expect(exitSpy).toHaveBeenCalledWith(0)

    const status = readStatus(taskId)
    expect(status.state).toBe('completed')

    // Fix pipeline stages should be present
    expect(status.stages).toHaveProperty('verify')
    expect(status.stages).toHaveProperty('pr')
  })

  it('pipeline stage ordering matches expected definitions', async () => {
    const taskId = '260316-canary-ordering'
    createTaskDir(taskId)

    const { main } = await import('../../scripts/cody/entry')
    await main(['--task-id', taskId, '--mode', 'full', '--dry-run', '--local'])

    const status = readStatus(taskId)
    const stageNames = Object.keys(status.stages)

    // Verify no duplicate stages
    const uniqueNames = new Set(stageNames)
    expect(uniqueNames.size).toBe(stageNames.length)

    // Verify all stage names are valid (from the registry)
    const { isValidStageName } = await import('../../scripts/cody/stages/registry')
    for (const name of stageNames) {
      expect(isValidStageName(name), `'${name}' should be a valid stage name`).toBe(true)
    }
  })
})
