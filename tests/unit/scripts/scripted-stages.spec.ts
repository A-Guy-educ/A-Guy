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

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
  execSync: mockExecSync,
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
    expect(resolved).toBe('.tasks/audit-history.json')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/1'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    // Title passed to gh pr create should NOT contain '##'
    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    expect(createCall).toBeDefined()
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    expect(titleArg).not.toContain('##')
    // "Description" is a common heading that gets filtered out - we use actual content instead
    expect(titleArg).toContain('remove redundant inline styles')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/2'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    expect(titleArg).not.toMatch(/^[a-z]+:\s*#/)
    expect(titleArg.toLowerCase()).toContain('my task title')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/3'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    // Should fall back to commit message since no real text content
    expect(titleArg).toBeTruthy()
    expect(titleArg).not.toContain('##')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/4'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    // '## Overview' stripped → 'Overview' gets filtered as common heading
    // Falls back to actual content line
    expect(titleArg).not.toContain('##')
    expect(titleArg.toLowerCase()).toContain('actual description text here')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/5'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    // Should be "fix: remove redundant inline styles." (falls back to next line after "fix:" + "##" are stripped)
    // NOT "fix: fix: ## description"
    expect(titleArg).not.toContain('fix: fix:')
    expect(titleArg).toContain('fix:')
    expect(titleArg).not.toContain('##')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/6'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    // Should be "feat: add new feature" (prefix stripped, remaining text used)
    expect(titleArg).toBe('feat: add new feature')
    expect(titleArg).not.toContain('FIX:')
    expect(titleArg).not.toContain('feat: FIX:')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/7'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    // Should be "fix: login redirect not working" (scope stripped)
    expect(titleArg).toBe('fix: login redirect not working')
    expect(titleArg).not.toContain('fix(auth):')
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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/8'
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    const titleArg: string = createCall![1][createCall![1].indexOf('--title') + 1]
    expect(titleArg).toBe('refactor: remove redundant inline styles from components.')
  })
})

// ============================================================================
// Tests: buildPrBody — Closes # linking
// ============================================================================

describe('buildPrBody Closes # linking', () => {
  beforeEach(resetMocks)

  function captureBody(): string {
    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    // body is passed as stdin via `input` option — accessible in options arg
    const options = createCall![2] as { input?: string }
    return options.input ?? ''
  }

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
      if (args[0] === 'pr' && args[1] === 'create') return 'https://github.com/org/repo/pull/546'
      return ''
    })
  }

  it('appends Closes #N when issueNumber is provided', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    const body = captureBody()
    expect(body).toContain('Closes #518')
  })

  it('does NOT append Closes # when issueNumber is omitted', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd())

    const body = captureBody()
    expect(body).not.toContain('Closes #')
  })

  it('does NOT append Closes # when issueNumber is 0', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 0)

    const body = captureBody()
    expect(body).not.toContain('Closes #')
  })

  it('includes spec overview in body', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    const body = captureBody()
    expect(body).toContain('Remove inline styles that duplicate Tailwind classes.')
  })

  it('includes commit log in body', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    const body = captureBody()
    expect(body).toContain('abc123 refactor: description')
  })

  it('Closes # appears before the footer', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    const body = captureBody()
    const closesIdx = body.indexOf('Closes #518')
    const footerIdx = body.indexOf('🤖 Generated by Cody pipeline')
    expect(closesIdx).toBeLessThan(footerIdx)
  })

  it('works with large issue numbers', async () => {
    setupDefaultFs()

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 9999)

    const body = captureBody()
    expect(body).toContain('Closes #9999')
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
    const result = runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.created).toBe(false)
    expect(result.url).toBe('https://github.com/org/repo/pull/546')
    // gh pr create should NOT have been called
    const createCall = mockExecFileSync.mock.calls.find(
      (call) => call[1][0] === 'pr' && call[1][1] === 'create',
    )
    expect(createCall).toBeUndefined()
  })
})

// ============================================================================
// Tests: runPrStage — PR creation failure
// ============================================================================

describe('runPrStage failure handling', () => {
  beforeEach(resetMocks)

  it('returns empty url and created=false when gh pr create throws', async () => {
    setupFiles({
      [`${TASK_DIR}/task.md`]: 'Some task',
      [`${TASK_DIR}/task.json`]: JSON.stringify({ task_type: 'refactor' }),
    })
    mockExecSync.mockReturnValue('refactor/260222-auto-37')
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'pr' && args[1] === 'list') return ''
      if (args[0] === 'log') return ''
      if (args[0] === 'push') return ''
      if (args[0] === 'pr' && args[1] === 'create') throw new Error('gh: not authenticated')
      return ''
    })

    const { runPrStage } = await import('../../../scripts/cody/scripted-stages')
    const result = runPrStage(TASK_DIR, `${TASK_DIR}/pr.md`, process.cwd(), 518)

    expect(result.created).toBe(false)
    expect(result.url).toBe('')
  })
})
