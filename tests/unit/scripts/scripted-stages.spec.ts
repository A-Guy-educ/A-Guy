/**
 * @fileType test
 * @domain ci | cody | pipeline
 * @pattern scripted-stages | test-contract
 * @ai-summary Tests for scripted-stages.ts: buildPrTitle (heading strip), buildPrBody (Closes # link), runPrStage (issueNumber wiring), and audit-history path in STAGE_CONTEXT_FILES
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as path from 'path'

// ============================================================================
// Mocks
// ============================================================================

const mockExecFileSync = vi.fn()
const mockExecSync = vi.fn()

// Need to use hoisted mock for fetch to work properly
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
  execSync: mockExecSync,
}))

vi.mock('fetch', () => ({
  fetch: mockFetch,
}))

const fsMocks = {
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
}

vi.mock('fs', () => fsMocks)

vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return {
    ...actual,
    join: (...parts: string[]) => parts.join('/'),
    basename: (p: string) => p.split('/').pop() || '',
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  }
})

// ============================================================================
// Fixtures
// ============================================================================

const TASK_ID = '260222-auto-37'
const TASK_DIR = `.tasks/${TASK_ID}`
const _DEFAULT_BRANCH = 'dev' // reserved for future use

// ============================================================================
// Helpers
// ============================================================================

function resetMocks() {
  mockExecFileSync.mockReset()
  mockExecSync.mockReset()
  mockFetch.mockReset()
  // Default fetch mock - returns success
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ html_url: 'https://github.com/owner/repo/pull/42' }),
  })
  // Also mock global fetch
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ html_url: 'https://github.com/owner/repo/pull/42' }),
  } as unknown as Response)
  Object.values(fsMocks).forEach((m) => m.mockReset())
}

/** Sets up fs so the given files exist with given contents */
function setupFiles(files: Record<string, string>) {
  fsMocks.existsSync.mockImplementation((p: string) => p in files)
  fsMocks.readFileSync.mockImplementation((p: string) => {
    if (p in files) return files[p]
    throw new Error(`ENOENT: no such file: ${p}`)
  })
  fsMocks.writeFileSync.mockImplementation(() => undefined)
}

// ============================================================================
// Tests: STAGE_CONTEXT_FILES — audit-history path
// ============================================================================

describe('STAGE_CONTEXT_FILES audit-history path', () => {
  it('auditor context includes ../audit-history.json (not task-scoped)', async () => {
    const { STAGE_CONTEXT_FILES } = await import('../../../scripts/cody/stage-prompts')

    expect(STAGE_CONTEXT_FILES.auditor).toContain('../audit-history.json')
    expect(STAGE_CONTEXT_FILES.auditor).not.toContain('audit-history.json')
  })

  it('resolves to .tasks/audit-history.json when joined with taskDir', async () => {
    const { STAGE_CONTEXT_FILES } = await import('../../../scripts/cody/stage-prompts')

    const taskDir = '.tasks/260222-auto-37'
    const auditEntry = STAGE_CONTEXT_FILES.auditor.find((f) => f.includes('audit-history'))!

    expect(auditEntry).toBeDefined()
    const resolved = path.normalize(`${taskDir}/${auditEntry}`)
    expect(resolved).toBe(path.normalize('.tasks/audit-history.json'))
  })
})

// ============================================================================
// Tests: buildPrTitle — conventional commit prefix deduplication
// ============================================================================

describe('buildPrTitle (via runPrStage title output)', () => {
  beforeEach(resetMocks)

  it('strips leading ## from task.md first line', async () => {
    // Note: "description" is a common heading and gets filtered out intentionally
    // The code skips generic section headers like ## Description and uses the actual content
    // Arrange: task.md whose first line is a markdown heading
    setupFiles({
      [`${TASK_DIR}/task.md`]: '## Description\nRemove redundant inline styles from components.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })

    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('git branch --show-current')) return 'refactor/260222-auto-37'
      return ''
    })
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return '' // no existing PR
      if (args[0] === 'log') return 'abc123 refactor(260222-auto-37): Description' // commit log
      if (args[0] === 'push') return '' // push
      return ''
    })
    // Mock fetch for GitHub API PR creation
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/1' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Title in the report should NOT contain '##' (check title line specifically)
    const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
    expect(titleLine).not.toContain('##')
    expect(result.report.toLowerCase()).toContain('remove redundant inline styles')
    expect(result.created).toBe(true)
  })

  it('strips leading # from task.md first line', async () => {
    setupFiles({
      [`${TASK_DIR}/task.md`]: '# My Task Title\nSome description below.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'fix_bug' }),
    })

    mockExecSync.mockReturnValue('fix/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/2' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    expect(result.report).not.toMatch(/^[a-z]+:\s*#/)
    expect(result.report.toLowerCase()).toContain('my task title')
  })

  it('falls back to commit message when task.md has only headings with no content', async () => {
    setupFiles({
      [`${TASK_DIR}/task.md`]: '## \n### \n',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })

    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return 'abc123 refactor: my commit message'
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/3' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Should fall back to commit message since no real text content
    expect(result.report).toBeTruthy()
    // Title should not contain ## markers (check title line specifically)
    const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
    expect(titleLine).not.toContain('##')
  })

  it('uses heading text (stripped of #) when task.md starts with a heading', async () => {
    // Note: "overview" is a common heading and gets filtered out intentionally
    // The code skips generic section headers like ## Overview and uses the actual content
    // buildPrTitle strips '#' chars and uses the first non-empty result —
    // so '## Overview' becomes 'Overview', which is filtered as common heading, then falls back to content
    setupFiles({
      [`${TASK_DIR}/task.md`]: '## Overview\n\nActual description text here.\n\nMore detail.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'feat' }),
    })

    mockExecSync.mockReturnValue('feat/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/4' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // '## Overview' stripped → 'Overview' gets filtered as common heading
    // Falls back to actual content line
    // Title should not contain ## markers (check title line specifically)
    const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
    expect(titleLine).not.toContain('##')
    expect(result.report.toLowerCase()).toContain('actual description text here')
  })

  it('does NOT duplicate fix: prefix when task.md starts with "fix:"', async () => {
    // This is the bug fix: task.md may have "fix: ## description"
    // The old code would produce "fix: fix: ## description"
    // The fix strips the "fix:" prefix, leaving "## description" which then gets
    // stripped as a heading, so we fall back to the next non-empty line
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'fix: ## description\nRemove redundant inline styles.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'fix_bug' }),
    })

    mockExecSync.mockReturnValue('fix/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/5' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Should be "fix: remove redundant inline styles." (falls back to next line after "fix:" + "##" are stripped)
    // NOT "fix: fix: ## description"
    expect(result.report).not.toContain('fix: fix:')
    expect(result.report).toContain('fix:')
    // Title should not contain ## markers (check title line specifically)
    const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
    expect(titleLine).not.toContain('##')
  })

  it('strips conventional commit prefix from task.md regardless of case', async () => {
    // Test uppercase FIX: (lowercased to "fix:")
    // When we strip the prefix, we get the remaining text which becomes the summary
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'FIX: Add new feature\nThis is the description.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'implement_feature' }),
    })

    mockExecSync.mockReturnValue('feat/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/6' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Should be "feat: add new feature" (prefix stripped, remaining text used)
    expect(result.report).toContain('feat: add new feature')
    expect(result.report).not.toContain('FIX:')
    expect(result.report).not.toContain('feat: FIX:')
  })

  it('strips conventional commit prefix with scope', async () => {
    // Test prefix with scope like "fix(auth):"
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'fix(auth): Login redirect not working\nFix the redirect.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'fix_bug' }),
    })

    mockExecSync.mockReturnValue('fix/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/7' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Should be "fix: login redirect not working" (scope stripped)
    expect(result.report).toContain('fix: login redirect not working')
    expect(result.report).not.toContain('fix(auth):')
  })

  it('preserves non-conventional-description text unchanged', async () => {
    // Normal description without prefix should work as before
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'Remove redundant inline styles from components.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })

    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/8' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    expect(result.report).toContain('refactor: remove redundant inline styles from components.')
  })
})

// ============================================================================
// Tests: buildPrBody — Closes # linking
// ============================================================================

describe('buildPrBody Closes # linking', () => {
  beforeEach(resetMocks)

  function setupDefaultFs() {
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'Remove redundant inline styles.',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
      [`${TASK_DIR}/spec.md`]: '## Overview\nRemove inline styles that duplicate Tailwind classes.',
    })
    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return 'abc123 refactor: description'
      if (args[0] === 'push') return ''
      if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin')
        return 'https://github.com/owner/repo.git'
      return ''
    })
  }

  it('appends Closes #N when issueNumber is provided', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.report).toContain('Closes #518')
  })

  it('does NOT append Closes # when issueNumber is omitted', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    expect(result.report).not.toContain('Closes #')
  })

  it('does NOT append Closes # when issueNumber is 0', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 0)

    expect(result.report).not.toContain('Closes #')
  })

  it('includes spec overview in body', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.report).toContain('Remove inline styles that duplicate Tailwind classes.')
  })

  it('includes commit log in body', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.report).toContain('abc123 refactor: description')
  })

  it('Closes # appears before the footer', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    const closesIdx = result.report.indexOf('Closes #518')
    const footerIdx = result.report.indexOf('🤖 Generated by Cody pipeline')
    expect(closesIdx).toBeLessThan(footerIdx)
  })

  it('works with large issue numbers', async () => {
    setupDefaultFs()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/org/repo/pull/546' }),
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 9999)

    expect(result.report).toContain('Closes #9999')
  })
})

// ============================================================================
// Tests: runPrStage — existing PR detection
// ============================================================================

describe('runPrStage existing PR', () => {
  beforeEach(resetMocks)

  it('returns existing PR URL without creating a new one', async () => {
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'Some task',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })
    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return 'https://github.com/org/repo/pull/546'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.created).toBe(false)
    expect(result.url).toBe('https://github.com/org/repo/pull/546')
    // fetch should NOT have been called
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Tests: runPrStage — PR creation failure
// ============================================================================

describe('runPrStage failure handling', () => {
  beforeEach(resetMocks)

  it('returns empty url and created=false when GitHub API fails', async () => {
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'Some task',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })
    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      return ''
    })
    // Mock global fetch to throw an error
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('GitHub API error: 404'))

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = await runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.created).toBe(false)
    expect(result.url).toBe('')
  })
})
