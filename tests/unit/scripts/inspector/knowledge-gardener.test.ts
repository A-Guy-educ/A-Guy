import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as childProcess from 'child_process'

import {
  parseMemoryJson,
  toKnowledgeEntry,
  findNewMemoryFiles,
  readKnowledgeIndex,
} from '../../../../scripts/inspector/plugins/cody/knowledge-gardener/extractor'
import {
  cultivate,
  MAX_ENTRIES,
  SKILL_CANDIDATE_THRESHOLD,
} from '../../../../scripts/inspector/plugins/cody/knowledge-gardener/pruner'
import { knowledgeGardenerPlugin } from '../../../../scripts/inspector/plugins/cody/knowledge-gardener/index'
import type { InspectorContext, GitHubClient } from '../../../../scripts/inspector/core/types'
import type {
  KnowledgeEntry,
  KnowledgeIndex,
} from '../../../../scripts/inspector/plugins/cody/knowledge-gardener/extractor'

vi.mock('fs')
vi.mock('child_process', () => ({ execFileSync: vi.fn().mockReturnValue('') }))

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<InspectorContext> = {}): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    cycleNumber: 10,
    runTimestamp: new Date().toISOString(),
    state: { get: vi.fn(), set: vi.fn(), save: vi.fn() },
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
    ...overrides,
  }
}

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    date: '2026-01-01T00:00:00Z',
    domain: 'frontend',
    taskType: 'fix_bug',
    complexity: 3,
    patterns: ['css-styling'],
    summary: 'Fixed a CSS issue',
    ...overrides,
  }
}

function makeIndex(overrides: Partial<KnowledgeIndex> = {}): KnowledgeIndex {
  return {
    version: 1,
    description: 'Test knowledge base',
    entries: [],
    patternFrequency: {},
    skillsCreated: [],
    lastUpdated: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================================================
// parseMemoryJson
// ============================================================================

describe('parseMemoryJson', () => {
  it('parses valid memory.json', () => {
    const raw = JSON.stringify({
      taskId: 'task-123',
      date: '2026-01-01',
      summary: 'Fixed a bug',
      domain: 'frontend',
      taskType: 'fix_bug',
      patterns: ['css-styling'],
      filesChanged: ['src/Component.tsx'],
    })
    const result = parseMemoryJson(raw)
    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('task-123')
    expect(result!.patterns).toContain('css-styling')
  })

  it('returns null for missing taskId', () => {
    expect(parseMemoryJson(JSON.stringify({ summary: 'test' }))).toBeNull()
  })

  it('returns null for missing summary', () => {
    expect(parseMemoryJson(JSON.stringify({ taskId: 'test' }))).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseMemoryJson('not json')).toBeNull()
  })
})

// ============================================================================
// toKnowledgeEntry
// ============================================================================

describe('toKnowledgeEntry', () => {
  it('computes complexity from filesChanged count', () => {
    const mem = {
      taskId: 'task-1',
      date: '2026-01-01',
      summary: 'Test',
      filesChanged: ['a.ts', 'b.ts', 'c.ts'],
    }
    const entry = toKnowledgeEntry(mem)
    expect(entry.complexity).toBe(3)
  })

  it('uses zero complexity when filesChanged is missing', () => {
    const entry = toKnowledgeEntry({ taskId: 'task-1', date: '2026-01-01', summary: 'Test' })
    expect(entry.complexity).toBe(0)
  })

  it('uses unknown domain and taskType as defaults', () => {
    const entry = toKnowledgeEntry({ taskId: 'task-1', date: '2026-01-01', summary: 'Test' })
    expect(entry.domain).toBe('unknown')
    expect(entry.taskType).toBe('unknown')
  })
})

// ============================================================================
// findNewMemoryFiles
// ============================================================================

describe('findNewMemoryFiles', () => {
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when tasks dir does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    expect(findNewMemoryFiles('/tasks', new Set())).toHaveLength(0)
  })

  it('skips task already in existingTaskIds', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-known', isDirectory: () => true }] as unknown as fs.Dirent[])

    const result = findNewMemoryFiles('/tasks', new Set(['task-known']))
    expect(result).toHaveLength(0)
  })

  it('reads and returns valid memory.json from new tasks', () => {
    const memContent = JSON.stringify({
      taskId: 'task-new',
      date: '2026-01-01',
      summary: 'Did something',
    })

    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-new', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue(memContent)

    const result = findNewMemoryFiles('/tasks', new Set())
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('task-new')
  })

  it('skips _archive directory', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: '_archive', isDirectory: () => true }] as unknown as fs.Dirent[])

    expect(findNewMemoryFiles('/tasks', new Set())).toHaveLength(0)
  })
})

// ============================================================================
// readKnowledgeIndex
// ============================================================================

describe('readKnowledgeIndex', () => {
  const mockFs = vi.mocked(fs)

  it('returns fresh default when file does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    const idx = readKnowledgeIndex('/some/path/index.json')
    expect(idx.entries).toEqual([])
    expect(idx.patternFrequency).toEqual({})
  })

  it('reads and returns existing index', () => {
    const stored = JSON.stringify({
      version: 1,
      description: 'test',
      entries: [makeEntry({ taskId: 'stored-task' })],
      patternFrequency: { 'css-styling': 1 },
      skillsCreated: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    })

    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readFileSync = vi.fn().mockReturnValue(stored)

    const idx = readKnowledgeIndex('/index.json')
    expect(idx.entries).toHaveLength(1)
    expect(idx.patternFrequency['css-styling']).toBe(1)
  })
})

// ============================================================================
// cultivate
// ============================================================================

describe('cultivate', () => {
  it('returns unchanged index when no new entries', () => {
    const idx = makeIndex({ entries: [makeEntry()] })
    const result = cultivate(idx, [])
    expect(result.newEntries).toHaveLength(0)
    expect(result.updatedIndex.entries).toEqual(idx.entries)
  })

  it('merges new entries and updates pattern frequency', () => {
    const idx = makeIndex()
    const entry = makeEntry({ patterns: ['react-component', 'typescript'] })
    const result = cultivate(idx, [entry])

    expect(result.newEntries).toHaveLength(1)
    expect(result.updatedIndex.patternFrequency['react-component']).toBe(1)
    expect(result.updatedIndex.patternFrequency['typescript']).toBe(1)
  })

  it('deduplicates entries already in the index', () => {
    const existing = makeEntry({ taskId: 'existing-task' })
    const idx = makeIndex({ entries: [existing] })
    const result = cultivate(idx, [existing]) // try to add again

    expect(result.newEntries).toHaveLength(0)
    expect(result.updatedIndex.entries).toHaveLength(1)
  })

  it(`enforces MAX_ENTRIES cap (${MAX_ENTRIES}) by removing oldest`, () => {
    const entries = Array.from({ length: MAX_ENTRIES }, (_, i) =>
      makeEntry({
        taskId: `task-${i}`,
        date: new Date(2026, 0, i + 1).toISOString(),
      }),
    )
    const idx = makeIndex({ entries })
    const newEntry = makeEntry({ taskId: 'brand-new', date: new Date(2026, 3, 1).toISOString() })

    const result = cultivate(idx, [newEntry])
    expect(result.updatedIndex.entries).toHaveLength(MAX_ENTRIES)
    expect(result.removedEntries).toHaveLength(1)
    // Oldest (task-0) should have been removed
    const removedId = result.removedEntries[0].taskId
    expect(removedId).toBe('task-0')
    // New entry should be present
    expect(result.updatedIndex.entries.some((e) => e.taskId === 'brand-new')).toBe(true)
  })

  it(`detects skill candidates when pattern frequency >= ${SKILL_CANDIDATE_THRESHOLD}`, () => {
    const idx = makeIndex({
      patternFrequency: { 'react-hooks': SKILL_CANDIDATE_THRESHOLD - 1 },
    })
    const entry = makeEntry({ patterns: ['react-hooks'] })
    const result = cultivate(idx, [entry])

    expect(result.skillCandidates).toContain('react-hooks')
  })

  it('does not flag patterns already in skillsCreated', () => {
    const idx = makeIndex({
      patternFrequency: { 'react-hooks': SKILL_CANDIDATE_THRESHOLD },
      skillsCreated: ['react-hooks'],
    })
    const entry = makeEntry({ patterns: ['react-hooks'] })
    const result = cultivate(idx, [entry])

    expect(result.skillCandidates).not.toContain('react-hooks')
  })
})

// ============================================================================
// knowledgeGardenerPlugin integration
// ============================================================================

describe('knowledgeGardenerPlugin', () => {
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    vi.mocked(childProcess.execFileSync).mockReturnValue(
      '' as unknown as ReturnType<typeof childProcess.execFileSync>,
    )
  })

  it('returns no actions when no new memory files found', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi.fn().mockReturnValue([])
    // Knowledge index is empty
    mockFs.readFileSync = vi.fn().mockReturnValue(
      JSON.stringify({
        version: 1,
        description: '',
        entries: [],
        patternFrequency: {},
        skillsCreated: [],
        lastUpdated: '',
      }),
    )

    const ctx = makeCtx()
    const actions = await knowledgeGardenerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns commit action when new memory files found', async () => {
    const memContent = JSON.stringify({
      taskId: 'task-new',
      date: '2026-01-10',
      summary: 'Added new feature',
      domain: 'backend',
      taskType: 'feature',
      patterns: ['api-design'],
    })

    // existsSync: tasks dir → true, memory.json → true, knowledge index → false
    mockFs.existsSync = vi
      .fn()
      .mockReturnValueOnce(false) // knowledge index path
      .mockReturnValueOnce(true) // tasks dir
      .mockReturnValueOnce(true) // memory.json for task-new

    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-new', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue(memContent)

    const ctx = makeCtx()
    const actions = await knowledgeGardenerPlugin.run(ctx)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('commit-knowledge-base')
  })

  it('has correct schedule (every 6)', () => {
    expect(knowledgeGardenerPlugin.schedule?.every).toBe(6)
  })

  it('uses 23h dedup window', async () => {
    const memContent = JSON.stringify({
      taskId: 'task-x',
      date: '2026-01-10',
      summary: 'Test',
    })

    mockFs.existsSync = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-x', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue(memContent)

    const ctx = makeCtx()
    const actions = await knowledgeGardenerPlugin.run(ctx)
    expect(actions[0].dedupWindowMinutes).toBe(23 * 60)
  })

  it('execute writes updated knowledge index and commits', async () => {
    const memContent = JSON.stringify({
      taskId: 'task-write',
      date: '2026-01-15',
      summary: 'Write test',
      patterns: ['test-pattern'],
    })

    mockFs.existsSync = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true) // dir exists check during write
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-write', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue(memContent)
    mockFs.writeFileSync = vi.fn()
    mockFs.mkdirSync = vi.fn()

    const ctx = makeCtx()
    const actions = await knowledgeGardenerPlugin.run(ctx)
    const result = await actions[0].execute(ctx)

    expect(result.success).toBe(true)
    expect(mockFs.writeFileSync).toHaveBeenCalled()
  })
})
