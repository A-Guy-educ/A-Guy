/**
 * @fileType test
 * @domain ci | cody
 * @pattern bug-fix-verification
 * @ai-summary Tests for gate comment extraction, dead code removal, mutation fix, and import hygiene
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Helpers: build realistic gate file content
// ============================================================================

/** Builds a realistic gate-taskify.md file content exactly as produced by handleGateApproval */
function buildTaskifyGateFile(): string {
  const comment = [
    '## 🚫 Hard Stop: Approval Required\n',
    'This task has been classified as **high risk** and requires mandatory approval before proceeding.\n',
    '| Field | Value |',
    '|-------|-------|',
    '| **Control Mode** | hard-stop |',
    '| **Risk Level** | high |',
    '| **Task Type** | new_feature |',
    '| **Confidence** | 0.6 |',
    '| **Scope** | `src/foo.ts`, `src/bar.ts` |',
    '',
    '### Task Summary',
    '> Add a new widget to the dashboard',
    '',
    '### Assumptions',
    '- The user wants a React component',
    '- No breaking changes expected',
    '',
    '---',
    '',
    'Reply with `/cody approve` to proceed or `/cody reject` to cancel.',
  ].join('\n')

  // This is exactly what handleGateApproval writes:
  return `# Gate Request\n\n${comment}\n`
}

/** Builds a realistic gate-architect.md file content */
function buildArchitectGateFile(): string {
  const comment = [
    '## 🚦 Risk Gate: Approval Required\n',
    'This task has been classified as **medium risk** and is paused for review before building.\n',
    '| Field | Value |',
    '|-------|-------|',
    '| **Control Mode** | risk-gated |',
    '| **Risk Level** | medium |',
    '| **Task Type** | enhancement |',
    '| **Confidence** | 0.7 |',
    '| **Scope** | 3 files |',
    '',
    '### Task Summary',
    '> Improve the search functionality',
    '',
    '### Plan',
    '```',
    '### Step 1: Update search index',
    '- Files: src/search.ts',
    '```',
    '',
    '---',
    '',
    'Reply with `/cody approve` to proceed or `/cody reject` to cancel.',
  ].join('\n')

  return `# Gate Request\n\n${comment}\n`
}

// ============================================================================
// Step 1: Gate comment extraction bugs
// ============================================================================

describe('Bug 1: Taskify gate extraction drops headers and approval instructions', () => {
  it('old extraction logic drops ## header and everything after ---', () => {
    const gateContent = buildTaskifyGateFile()

    // Simulate the OLD broken extraction (cody.ts:452-466)
    const lines = gateContent.split('\n')
    let inComment = false
    const commentLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('---')) {
        inComment = false
        break
      }
      if (inComment || (!line.startsWith('## ') && !line.startsWith('|'))) {
        commentLines.push(line)
      }
      if (line.startsWith('## ')) {
        inComment = true
      }
    }
    const oldResult = commentLines.join('\n').trim()

    // Bug 1a: The ## header line itself is dropped
    expect(oldResult).not.toContain('## 🚫 Hard Stop')

    // Bug 1b: The approval instructions after --- are dropped
    expect(oldResult).not.toContain('Reply with `/cody approve`')

    // Bug 1c: The # Gate Request file header stays (should be stripped)
    expect(oldResult).toContain('# Gate Request')
  })

  it('new extractGateCommentBody preserves full content', async () => {
    const { extractGateCommentBody } = await import('../../../../scripts/cody/cody-utils')
    const gateContent = buildTaskifyGateFile()

    const result = extractGateCommentBody(gateContent)

    // Must contain headers, tables, summary, and approval instructions
    expect(result).toContain('## 🚫 Hard Stop')
    expect(result).toContain('| **Risk Level** | high |')
    expect(result).toContain('### Task Summary')
    expect(result).toContain('> Add a new widget to the dashboard')
    expect(result).toContain('### Assumptions')
    expect(result).toContain('- The user wants a React component')
    expect(result).toContain('---')
    expect(result).toContain('Reply with `/cody approve`')
    // Must NOT contain the file-level header
    expect(result).not.toMatch(/^# Gate Request/)
    // Must not be empty
    expect(result.length).toBeGreaterThan(100)
  })
})

describe('Bug 2: Architect gate extraction keeps wrong header and drops instructions', () => {
  it('old extraction keeps # Gate Request header and drops approval instructions', () => {
    const gateContent = buildArchitectGateFile()

    // Simulate the OLD broken extraction (cody.ts:772-776)
    // split('---')[0] drops approval instructions
    // The regex ^## [^]+\n doesn't match because content starts with "# Gate Request"
    const oldResult = gateContent
      .split('---')[0]
      .replace(/^## [^]+\n/, '')
      .trim()

    // Bug 2a: The # Gate Request file header is NOT stripped
    expect(oldResult).toContain('# Gate Request')

    // Bug 2b: The approval instructions after --- are dropped
    expect(oldResult).not.toContain('Reply with `/cody approve`')
  })

  it('new extractGateCommentBody preserves full architect content', async () => {
    const { extractGateCommentBody } = await import('../../../../scripts/cody/cody-utils')
    const gateContent = buildArchitectGateFile()

    const result = extractGateCommentBody(gateContent)

    // Must contain headers, tables, plan, and approval instructions
    expect(result).toContain('## 🚦 Risk Gate')
    expect(result).toContain('| **Risk Level** | medium |')
    expect(result).toContain('### Plan')
    expect(result).toContain('### Step 1: Update search index')
    expect(result).toContain('Reply with `/cody approve`')
    expect(result).not.toMatch(/^# Gate Request/)
    expect(result.length).toBeGreaterThan(100)
  })
})

describe('extractGateCommentBody edge cases', () => {
  it('handles file without # Gate Request prefix', async () => {
    const { extractGateCommentBody } = await import('../../../../scripts/cody/cody-utils')
    const content = '## Some Content\n\nBody text here.'

    const result = extractGateCommentBody(content)
    expect(result).toBe('## Some Content\n\nBody text here.')
  })

  it('returns empty string for empty input', async () => {
    const { extractGateCommentBody } = await import('../../../../scripts/cody/cody-utils')
    expect(extractGateCommentBody('')).toBe('')
  })

  it('handles # Gate Request with no content after', async () => {
    const { extractGateCommentBody } = await import('../../../../scripts/cody/cody-utils')
    expect(extractGateCommentBody('# Gate Request\n\n')).toBe('')
  })
})

// ============================================================================
// Step 2: Dead code and redundant readTask calls
// ============================================================================

describe('Bug 3: Dead _taskDefForSkip and redundant readTask calls', () => {
  const codySource = fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/cody/cody.ts'),
    'utf-8',
  )

  it('should not contain _taskDefForSkip variable', () => {
    expect(codySource).not.toContain('_taskDefForSkip')
  })

  it('should have exactly one readTask call between taskify validation and gate check', () => {
    const validateIdx = codySource.indexOf('Validate task.json immediately')
    const gateIdx = codySource.indexOf('GATE: Hard-stop check')
    expect(validateIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeGreaterThan(-1)

    const region = codySource.slice(validateIdx, gateIdx)
    const readTaskCalls = (region.match(/readTask\(taskDir\)/g) || []).length
    expect(readTaskCalls).toBe(1)
  })
})

// ============================================================================
// Step 3: Rerun mode mutation
// ============================================================================

describe('Bug 4: runRerunPipeline mutates input.mode', () => {
  const codySource = fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/cody/cody.ts'),
    'utf-8',
  )

  it('should not directly assign input.mode in runRerunPipeline', () => {
    const fnStart = codySource.indexOf('async function runRerunPipeline(')
    expect(fnStart).toBeGreaterThan(-1)
    const fnRegion = codySource.slice(fnStart, fnStart + 3000)
    expect(fnRegion).not.toMatch(/input\.mode\s*=\s*/)
  })

  it('should use spread pattern for mode override', () => {
    const fnStart = codySource.indexOf('async function runRerunPipeline(')
    const fnRegion = codySource.slice(fnStart, fnStart + 3000)
    expect(fnRegion).toContain('{ ...input, mode:')
  })
})

// ============================================================================
// Step 4: Redundant dynamic imports
// ============================================================================

describe('Bug 5: Redundant dynamic imports of cody-utils', () => {
  const codySource = fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/cody/cody.ts'),
    'utf-8',
  )

  it('should have zero dynamic imports of cody-utils', () => {
    const dynamicImports = (codySource.match(/await import\(['"]\.\/cody-utils['"]\)/g) || [])
      .length
    expect(dynamicImports).toBe(0)
  })

  it('should have postComment in static import block', () => {
    const importBlock = codySource.slice(0, 3000)
    expect(importBlock).toContain('postComment')
  })
})
