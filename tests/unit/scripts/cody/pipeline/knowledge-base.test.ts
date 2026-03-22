/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern knowledge-base
 * @ai-summary Unit tests for executeUpdateKnowledgeBase post-action
 */

import * as fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fs before importing the module
vi.mock('fs')

const mockFs = vi.mocked(fs)

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: 'info',
  }
  return { mockLogger }
})

vi.mock('../../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

vi.mock('../../../../../scripts/cody/engine/status', () => ({
  loadState: vi.fn(),
}))

vi.mock('../../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
}))

import { loadState } from '../../../../../scripts/cody/engine/status'
import type { PipelineContext, PipelineStateV2 } from '../../../../../scripts/cody/engine/types'
import { readTask } from '../../../../../scripts/cody/pipeline-utils'
import { executeUpdateKnowledgeBase } from '../../../../../scripts/cody/pipeline/post-actions/knowledge-base'
import type { TaskDefinition } from '../../../../../scripts/cody/pipeline/task-schema'

// ============================================================================
// Helpers
// ============================================================================

function makeTaskDef(overrides?: Partial<TaskDefinition>): TaskDefinition {
  return {
    task_type: 'fix_bug' as const,
    pipeline: 'spec_execute_verify' as const,
    risk_level: 'low' as const,
    confidence: 0.9,
    primary_domain: 'frontend' as const,
    scope: ['src/ui/web/button.tsx', 'tailwind'],
    missing_inputs: [],
    assumptions: [],
    complexity: 17,
    ...overrides,
  }
}

function makePipelineState(overrides?: Partial<PipelineStateV2>): PipelineStateV2 {
  return {
    version: 2,
    taskId: 'test-task-123',
    mode: 'full',
    pipeline: 'spec_execute_verify',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'completed',
    cursor: null,
    stages: {
      build: {
        state: 'completed',
        retries: 0,
        feedbackLoops: 1,
        feedbackErrors: ['type_error'],
      },
    },
    ...overrides,
  }
}

function makeCtx(overrides?: Partial<PipelineContext>): PipelineContext {
  const taskId = overrides?.taskId ?? 'test-task-123'
  return {
    taskId,
    taskDir: `/tmp/.tasks/${taskId}`,
    input: {
      taskId,
      mode: 'full',
      dryRun: false,
      local: true,
    },
    taskDef: null,
    profile: 'standard',
    backend: { name: 'test', spawn: vi.fn() },
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('executeUpdateKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    mockFs.mkdirSync = vi.fn()
    mockFs.writeFileSync = vi.fn()
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('')
  })

  it('skips update in dry-run mode', async () => {
    const ctx = makeCtx({ input: { taskId: 'test', mode: 'full', dryRun: true, local: true } })

    await executeUpdateKnowledgeBase(ctx, null)

    expect(mockLogger.info).toHaveBeenCalledWith('  ℹ️ Dry run, skipping knowledge base update')
    expect(mockFs.writeFileSync).not.toHaveBeenCalled()
  })

  it('skips update when task.json not found', async () => {
    vi.mocked(readTask).mockReturnValue(null)
    const ctx = makeCtx()

    await executeUpdateKnowledgeBase(ctx, null)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '  ⚠️ No task definition found, skipping knowledge base update',
    )
    expect(mockFs.writeFileSync).not.toHaveBeenCalled()
  })

  it('creates new knowledge base when none exists', async () => {
    const taskDef = makeTaskDef({
      task_type: 'fix_bug',
      primary_domain: 'frontend',
      scope: ['src/ui/web/button.tsx', 'tailwind'],
      complexity: 17,
    })
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState())

    // No existing knowledge base
    mockFs.existsSync.mockReturnValue(false)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('')

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    // Should have created directory and written new KB
    expect(mockFs.mkdirSync).toHaveBeenCalled()
    expect(mockFs.writeFileSync).toHaveBeenCalled()
    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.version).toBe(1)
    expect(kb.entries).toHaveLength(1)
    expect(kb.entries[0].taskId).toBe('test-task-123')
    expect(kb.entries[0].domain).toBe('frontend')
    expect(kb.entries[0].taskType).toBe('fix_bug')
    expect(kb.entries[0].complexity).toBe(17)
    expect(kb.entries[0].patterns).toContain('css-styling')
    expect(kb.entries[0].feedbackLoops).toBe(1)
  })

  it('appends to existing knowledge base', async () => {
    const taskDef = makeTaskDef({
      primary_domain: 'backend',
      scope: ['payload', 'collection', 'hook'],
      complexity: 42,
    })
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState())

    // Existing knowledge base
    const existingKb = {
      version: 1,
      description: 'Test',
      entries: [
        {
          taskId: 'prev-task',
          date: '2026-01-01',
          domain: 'frontend',
          taskType: 'fix_bug',
          complexity: 10,
          patterns: ['css-styling'],
          summary: 'prev',
        },
      ],
      patternFrequency: { 'css-styling': 1 },
      skillsCreated: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    }
    mockFs.existsSync.mockReturnValue(true)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingKb))

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    expect(mockFs.writeFileSync).toHaveBeenCalled()
    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries).toHaveLength(2)
    expect(kb.entries[1].taskId).toBe('test-task-123')
    expect(kb.entries[1].domain).toBe('backend')
    expect(kb.patternFrequency['css-styling']).toBe(1)
    expect(kb.patternFrequency['data-modeling']).toBe(1)
    expect(kb.patternFrequency['hook']).toBe(1)
  })

  it('updates existing entry for same taskId', async () => {
    const taskDef = makeTaskDef({ complexity: 25 })
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState())

    const existingKb = {
      version: 1,
      description: 'Test',
      entries: [
        {
          taskId: 'test-task-123',
          date: '2026-01-01',
          domain: 'frontend',
          taskType: 'fix_bug',
          complexity: 10,
          patterns: [],
          summary: 'old',
        },
      ],
      patternFrequency: {},
      skillsCreated: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    }
    mockFs.existsSync.mockReturnValue(true)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingKb))

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries).toHaveLength(1)
    expect(kb.entries[0].complexity).toBe(25) // Updated
  })

  it('extracts error patterns from verify-failures.md', async () => {
    const taskDef = makeTaskDef()
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState({ stages: {} })) // no feedbackLoops

    // verify-failures.md exists
    mockFs.existsSync.mockImplementation((p: unknown) => {
      return String(p).includes('verify-failures.md')
    })
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('verify-failures.md')) {
        return `# Verify Failures

## Error 1: type_error
some error output

## Error 2: lint_error
lint output
`
      }
      if (String(p).includes('task.json')) {
        return JSON.stringify(taskDef)
      }
      return ''
    })

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries[0].errorPatterns).toContain('type_error')
    expect(kb.entries[0].errorPatterns).toContain('lint_error')
    expect(kb.entries[0].patterns).toContain('type-error')
    expect(kb.entries[0].patterns).toContain('lint-error')
  })

  it('caps entries at MAX_KNOWLEDGE_ENTRIES (100)', async () => {
    const taskDef = makeTaskDef()
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState())

    // Create existing KB with 100 entries
    const existingEntries = Array.from({ length: 100 }, (_, i) => ({
      taskId: `old-task-${i}`,
      date: '2026-01-01',
      domain: 'frontend' as const,
      taskType: 'fix_bug' as const,
      complexity: 10,
      patterns: ['css-styling'] as string[],
      summary: `old task ${i}`,
    }))
    const existingKb = {
      version: 1,
      description: 'Test',
      entries: existingEntries,
      patternFrequency: { 'css-styling': 100 },
      skillsCreated: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    }
    mockFs.existsSync.mockReturnValue(true)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingKb))

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries).toHaveLength(100)
    // First entry should be removed, new one added at end
    expect(kb.entries[0].taskId).toBe('old-task-1') // shifted
    expect(kb.entries[99].taskId).toBe('test-task-123') // new one at end
  })

  it('continues pipeline when knowledge base update fails', async () => {
    const taskDef = makeTaskDef()
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState())

    // Simulate error reading file
    mockFs.existsSync.mockReturnValue(true)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Simulated read error')
    })

    const ctx = makeCtx()
    // Should not throw
    await expect(executeUpdateKnowledgeBase(ctx, null)).resolves.not.toThrow()
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('detects patterns from scope text', async () => {
    const taskDef = makeTaskDef({
      scope: ['typescript', 'interface', 'access', 'hook', 'beforeChange'],
    })
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState({ stages: {} }))

    mockFs.existsSync.mockReturnValue(false)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('')

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries[0].patterns).toContain('type-error')
    expect(kb.entries[0].patterns).toContain('access-control')
    expect(kb.entries[0].patterns).toContain('hook')
  })

  it('marks iterative-fix pattern when feedbackLoops > 0', async () => {
    const taskDef = makeTaskDef()
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(
      makePipelineState({
        stages: {
          build: { state: 'completed', retries: 0, feedbackLoops: 2 },
        },
      }),
    )

    mockFs.existsSync.mockReturnValue(false)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('')

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.entries[0].patterns).toContain('iterative-fix')
    expect(kb.entries[0].feedbackLoops).toBe(2)
  })

  it('updates pattern frequency correctly', async () => {
    const taskDef = makeTaskDef({
      scope: ['typescript', 'css', 'hook'],
    })
    vi.mocked(readTask).mockReturnValue(taskDef)
    vi.mocked(loadState).mockReturnValue(makePipelineState({ stages: {} }))

    const existingKb = {
      version: 1,
      description: 'Test',
      entries: [
        {
          taskId: 'prev',
          date: '2026-01-01',
          domain: 'frontend',
          taskType: 'fix_bug',
          complexity: 10,
          patterns: ['typescript'],
          summary: 'prev',
        },
      ],
      patternFrequency: { 'type-error': 2, 'css-styling': 1 },
      skillsCreated: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    }
    mockFs.existsSync.mockReturnValue(true)
    ;(mockFs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingKb))

    const ctx = makeCtx()
    await executeUpdateKnowledgeBase(ctx, null)

    const writtenContent = (mockFs.writeFileSync.mock.calls[0] as [string, string])[1]
    const kb = JSON.parse(writtenContent)
    expect(kb.patternFrequency['type-error']).toBe(3) // incremented
    expect(kb.patternFrequency['css-styling']).toBe(2) // incremented
    expect(kb.patternFrequency['hook']).toBe(1) // new
  })
})
