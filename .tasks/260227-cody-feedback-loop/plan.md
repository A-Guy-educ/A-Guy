# Plan: Cody Pipeline Smart Feedback Loop (TDD)

## Rerun Context

Revised plan from previous version. Now addresses all 4 discovered problems with strict TDD — every step writes the failing test FIRST, then implements the minimum code to pass.

---

## Problems Addressed

| # | Problem | Root Cause | File:Line |
|---|---------|-----------|-----------|
| P1 | Build post-actions have zero inner retry | `run-tsc`/`run-unit-tests` do `throw new Error()` immediately | `post-actions.ts:192-220` |
| P2 | Build agent never reads supervisor feedback | `rerun-feedback.md` not in build's context files | `stage-prompts.ts:75` |
| P3 | Supervisor rerun `--from=build` skips architect | `resetFromStage` only resets from the named stage onwards; architect stays completed | `entry.ts:504` |
| P4 | 25-min round-trip for 30-sec fix | No inner autofix at build → supervisor spins up full pipeline restart | Architecture gap |

## Target Architecture

```
INNER LOOP (30 sec)     → Build post-action autofix          [NEW — Steps 3-5]
MIDDLE LOOP (2 min)     → Verify stage autofix               [EXISTS — untouched]
OUTER LOOP (25 min, $)  → Supervisor → rerun with feedback   [FIX — Steps 1-2]
```

## Assumptions

1. Autofix agent (`.opencode/agents/autofix.md`) already handles tsc/lint/format fixes — we reuse it
2. Verify stage autofix loop in `scripted-handler.ts` is untouched
3. MongoDB unavailable during build — no integration tests at build time
4. `maxFeedbackLoops` default of 2 matches `MAX_AUTOFIX_ATTEMPTS` in scripted-handler
5. Supervisor code (`scripts/supervisor/`) is untouched — only feedback routing changes

---

## Step 1: Fix Build Agent Context — Read rerun-feedback.md

**Time**: ~10 min | **Fixes**: P2  
**TDD**: RED → GREEN → REFACTOR

**Files to Touch**:
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED — add 2 tests)
- `scripts/cody/stage-prompts.ts` (MODIFIED — line 75)

### RED — Write Failing Tests First

Add to existing `describe('STAGE_CONTEXT_FILES')` in `tests/unit/scripts/cody/stage-prompts.test.ts`:

```typescript
it('should include rerun-feedback.md in build context for supervisor feedback', () => {
  expect(STAGE_CONTEXT_FILES.build).toContain('rerun-feedback.md')
})
```

Add to existing `describe('buildStagePrompt')`:

```typescript
it('should include rerun-feedback.md path in build stage prompt', () => {
  const prompt = buildStagePrompt(mockInput, 'build')
  expect(prompt).toContain(getExpectedPath('rerun-feedback.md'))
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/stage-prompts.test.ts`  
**Expected**: 2 tests FAIL — build context is `['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md']`, doesn't contain `rerun-feedback.md`

### GREEN — Minimum Change

In `scripts/cody/stage-prompts.ts` line 75, change:

```typescript
// BEFORE:
build: ['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md'],

// AFTER:
build: ['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md', 'rerun-feedback.md'],
```

### REFACTOR

Update the existing exact-match test at line 84-89 of the test file that asserts the old array:

```typescript
// BEFORE:
expect(STAGE_CONTEXT_FILES.build).toEqual([
  'spec.md', 'clarified.md', 'plan.md', 'plan-gap.md',
])

// AFTER:
expect(STAGE_CONTEXT_FILES.build).toEqual([
  'spec.md', 'clarified.md', 'plan.md', 'plan-gap.md', 'rerun-feedback.md',
])
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/stage-prompts.test.ts`  
**Expected**: ALL tests pass (including old ones after updating the exact-match assertion)

**Acceptance Criteria**:
- [ ] `STAGE_CONTEXT_FILES.build` contains `'rerun-feedback.md'`
- [ ] `buildStagePrompt(input, 'build')` includes rerun-feedback.md path
- [ ] All existing stage-prompts tests pass (update exact-match assertion)
- [ ] Build agent works normally when `rerun-feedback.md` doesn't exist (already handled — agents ignore missing optional files)

---

## Step 2: Fix Supervisor Rerun — Back Up to Architect When Feedback Provided

**Time**: ~15 min | **Fixes**: P3  
**TDD**: RED → GREEN → REFACTOR

**Files to Touch**:
- `tests/unit/scripts/cody/rerun-feedback-routing.test.ts` (NEW)
- `scripts/cody/entry.ts` (MODIFIED — `runRerunMode`, ~line 454)

### RED — Write Failing Tests First

Create `tests/unit/scripts/cody/rerun-feedback-routing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

/**
 * Test the rerun feedback routing logic:
 * When --feedback is provided and --from is build or later,
 * fromStage should be backed up to architect so the plan can be revised.
 */

// Extract the logic as a pure function to test
// (we'll extract this from entry.ts in the GREEN phase)
import { resolveRerunFromStage } from '../../../../scripts/cody/rerun-utils'

describe('resolveRerunFromStage', () => {
  const IMPL_STAGES = ['architect', 'plan-gap', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']

  it('backs up to architect when feedback provided and from=build', () => {
    const result = resolveRerunFromStage('build', 'fix the type error', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('backs up to architect when feedback provided and from=verify', () => {
    const result = resolveRerunFromStage('verify', 'lint errors found', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('backs up to architect when feedback provided and from=commit', () => {
    const result = resolveRerunFromStage('commit', 'push failed', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('stays at architect when feedback provided and from=architect', () => {
    const result = resolveRerunFromStage('architect', 'revise the plan', IMPL_STAGES)
    expect(result).toBe('architect')
  })

  it('keeps fromStage unchanged when NO feedback provided', () => {
    const result = resolveRerunFromStage('build', undefined, IMPL_STAGES)
    expect(result).toBe('build')
  })

  it('keeps fromStage unchanged when feedback is empty string', () => {
    const result = resolveRerunFromStage('build', '', IMPL_STAGES)
    expect(result).toBe('build')
  })

  it('keeps fromStage for spec stages even with feedback (spec stages dont have architect)', () => {
    const result = resolveRerunFromStage('taskify', 'some feedback', IMPL_STAGES)
    expect(result).toBe('taskify')
  })

  it('keeps fromStage for plan-gap (already before build, after architect)', () => {
    const result = resolveRerunFromStage('plan-gap', 'feedback', IMPL_STAGES)
    expect(result).toBe('plan-gap')
  })
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/rerun-feedback-routing.test.ts`  
**Expected**: FAILS — `rerun-utils` module doesn't exist

### GREEN — Implement Minimum Code

Create `scripts/cody/rerun-utils.ts`:

```typescript
/**
 * @fileType utility
 * @domain cody | rerun
 * @ai-summary Pure function to resolve rerun fromStage with feedback routing
 */

/**
 * When feedback is provided and fromStage is AFTER architect in the impl pipeline,
 * back up to architect so the plan can be revised with the feedback.
 * 
 * Only backs up if fromStage is strictly AFTER architect (build, commit, verify, etc.)
 * If fromStage IS architect or plan-gap, keep it (architect already reads feedback,
 * plan-gap is between architect and build so architect would run first anyway).
 */
export function resolveRerunFromStage(
  fromStage: string,
  feedback: string | undefined,
  implStages: string[],
): string {
  // No feedback → no change
  if (!feedback) return fromStage

  const architectIdx = implStages.indexOf('architect')
  const fromIdx = implStages.indexOf(fromStage)

  // fromStage not in impl stages (e.g., spec stage) → no change
  if (fromIdx === -1 || architectIdx === -1) return fromStage

  // Only back up if fromStage is strictly after plan-gap (i.e., build or later)
  // architect=0, plan-gap=1, build=2, commit=3, ...
  const planGapIdx = implStages.indexOf('plan-gap')
  const threshold = planGapIdx !== -1 ? planGapIdx : architectIdx

  if (fromIdx > threshold) {
    return 'architect'
  }

  return fromStage
}
```

Then in `scripts/cody/entry.ts`, in `runRerunMode` after line ~454 (after `fromStage` is determined), add:

```typescript
import { resolveRerunFromStage } from './rerun-utils'
// ... in runRerunMode, after determining fromStage:
const implStages = ['architect', 'plan-gap', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']
const resolvedFrom = resolveRerunFromStage(input.fromStage || 'build', input.feedback, implStages)
if (resolvedFrom !== input.fromStage) {
  console.log(`  ℹ️ Feedback provided — backing up from ${input.fromStage} to ${resolvedFrom} for plan revision`)
  input.fromStage = resolvedFrom
}
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/rerun-feedback-routing.test.ts`  
**Expected**: ALL 8 tests pass

**Acceptance Criteria**:
- [ ] `resolveRerunFromStage('build', 'fix it', stages)` → `'architect'`
- [ ] `resolveRerunFromStage('build', undefined, stages)` → `'build'`
- [ ] `resolveRerunFromStage('architect', 'fix it', stages)` → `'architect'`
- [ ] `resolveRerunFromStage('taskify', 'fix it', stages)` → `'taskify'`
- [ ] Existing rerun tests in `pipeline-cli-contract.test.ts` still pass
- [ ] Function is pure, no side effects, easy to test

---

## Step 3: Add Error Classification Utility

**Time**: ~15 min | **Fixes**: P1 foundation  
**TDD**: RED → GREEN → REFACTOR

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/error-classifier.test.ts` (NEW)
- `scripts/cody/pipeline/error-classifier.ts` (NEW)

### RED — Write Failing Tests First

Create `tests/unit/scripts/cody/pipeline/error-classifier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyError, formatErrorsAsMarkdown } from '../../../../../scripts/cody/pipeline/error-classifier'

describe('classifyError', () => {
  describe('TypeScript errors', () => {
    it('classifies tsc output as type_error with file hints', () => {
      const raw = "src/foo.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'."
      const result = classifyError(raw, 'tsc')
      expect(result.category).toBe('type_error')
      expect(result.fileHints).toContain('src/foo.ts')
      expect(result.fixInstructions).toContain('TypeScript')
    })

    it('extracts multiple file paths from multi-error tsc output', () => {
      const raw = [
        "src/foo.ts(10,5): error TS2345: Argument...",
        "src/bar.ts(20,3): error TS2322: Type...",
        "src/foo.ts(15,1): error TS2554: Expected 2 arguments",
      ].join('\n')
      const result = classifyError(raw, 'tsc')
      expect(result.category).toBe('type_error')
      expect(result.fileHints).toContain('src/foo.ts')
      expect(result.fileHints).toContain('src/bar.ts')
      // Should deduplicate
      expect(result.fileHints.filter(f => f === 'src/foo.ts')).toHaveLength(1)
    })
  })

  describe('test failures', () => {
    it('classifies vitest output as test_failure with file hints', () => {
      const raw = "FAIL tests/unit/foo.test.ts > should work\n  Expected: true\n  Received: false"
      const result = classifyError(raw, 'test')
      expect(result.category).toBe('test_failure')
      expect(result.fileHints).toContain('tests/unit/foo.test.ts')
      expect(result.fixInstructions).toContain('test')
    })
  })

  describe('lint errors', () => {
    it('classifies eslint output as lint_error', () => {
      const raw = "/path/to/src/foo.ts\n  10:5  error  Unexpected any  @typescript-eslint/no-explicit-any"
      const result = classifyError(raw, 'lint')
      expect(result.category).toBe('lint_error')
      expect(result.fixInstructions).toContain('lint')
    })
  })

  describe('format errors', () => {
    it('classifies prettier output as format_error', () => {
      const raw = "Checking formatting...\n[warn] src/foo.ts\n[warn] Code style issues found"
      const result = classifyError(raw, 'format')
      expect(result.category).toBe('format_error')
      expect(result.fixInstructions).toContain('format')
    })
  })

  describe('edge cases', () => {
    it('returns unknown for empty input', () => {
      const result = classifyError('', 'tsc')
      expect(result.category).toBe('unknown')
    })

    it('truncates fullOutput to 5000 chars', () => {
      const long = 'x'.repeat(10000)
      const result = classifyError(long, 'tsc')
      expect(result.fullOutput.length).toBeLessThanOrEqual(5000)
    })

    it('truncates summary to 500 chars', () => {
      const long = 'x'.repeat(2000)
      const result = classifyError(long, 'tsc')
      expect(result.summary.length).toBeLessThanOrEqual(500)
    })
  })
})

describe('formatErrorsAsMarkdown', () => {
  it('produces markdown with attempt info and error sections', () => {
    const errors = [
      {
        category: 'type_error' as const,
        summary: 'TS2345 in foo.ts',
        fullOutput: "src/foo.ts(10,5): error TS2345: Argument...",
        fileHints: ['src/foo.ts'],
        fixInstructions: 'Fix TypeScript type errors.',
      },
    ]
    const md = formatErrorsAsMarkdown(errors, 1, 2)
    expect(md).toContain('# Build Errors')
    expect(md).toContain('Attempt 1/2')
    expect(md).toContain('type_error')
    expect(md).toContain('src/foo.ts')
    expect(md).toContain('Fix TypeScript type errors')
  })

  it('includes multiple error sections for different categories', () => {
    const errors = [
      { category: 'type_error' as const, summary: 'tsc', fullOutput: 'err1', fileHints: ['a.ts'], fixInstructions: 'fix types' },
      { category: 'test_failure' as const, summary: 'test', fullOutput: 'err2', fileHints: ['b.test.ts'], fixInstructions: 'fix tests' },
    ]
    const md = formatErrorsAsMarkdown(errors, 2, 2)
    expect(md).toContain('type_error')
    expect(md).toContain('test_failure')
    expect(md).toContain('a.ts')
    expect(md).toContain('b.test.ts')
  })
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/pipeline/error-classifier.test.ts`  
**Expected**: FAILS — module doesn't exist

### GREEN — Implement

Create `scripts/cody/pipeline/error-classifier.ts` with:
- `classifyError(rawOutput, source)` — regex-based classification
- `formatErrorsAsMarkdown(errors, attempt, max)` — markdown generation
- TSC regex: `/([^\s]+\.tsx?)\(\d+,\d+\)/g` for file extraction
- Test regex: `/(FAIL|❌)\s+(\S+\.test\.\w+)/g` for test file extraction
- Lint regex: `/^\s*\d+:\d+\s+(error|warning)/m` for lint detection
- Format regex: `/\[warn\]\s+(\S+\.\w+)/g` for prettier file extraction

**Run**: `pnpm vitest run tests/unit/scripts/cody/pipeline/error-classifier.test.ts`  
**Expected**: ALL 11 tests pass

**Acceptance Criteria**:
- [ ] Correct category for tsc, lint, format, test errors
- [ ] File path extraction and deduplication
- [ ] Truncation of output at 5000 chars and summary at 500 chars
- [ ] Empty input → `unknown` category
- [ ] `formatErrorsAsMarkdown` produces readable markdown with attempt info

---

## Step 4: Add Build Post-Action Feedback Loop

**Time**: ~30 min | **Fixes**: P1, P4  
**TDD**: RED → GREEN → REFACTOR

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` (NEW)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — add case)
- `scripts/cody/engine/types.ts` (MODIFIED — add type to union)
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — lines 190-193)

### RED — Write Failing Tests First

Create `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import type { PipelineContext } from '../../../../../scripts/cody/engine/types'

// Mock child_process
const mockExecSync = vi.fn()
vi.mock('child_process', () => ({ execSync: mockExecSync, execFileSync: vi.fn() }))

// Mock agent-runner
const mockRunAgent = vi.fn()
vi.mock('../../../../../scripts/cody/agent-runner', () => ({
  runAgentWithFileWatch: (...args: unknown[]) => mockRunAgent(...args),
  STAGE_TIMEOUTS: { autofix: 300000 },
  DEFAULT_TIMEOUT: 600000,
}))

// Mock fs partially (keep real join/existsSync behavior where needed)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return { ...actual, writeFileSync: vi.fn(), unlinkSync: vi.fn(), existsSync: vi.fn(() => false) }
})

// Mock other deps
vi.mock('../../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(),
  resolveControlMode: vi.fn(),
  stageOutputFile: vi.fn(),
}))
vi.mock('../../../../../scripts/cody/clarify-workflow', () => ({ handleGateApproval: vi.fn() }))
vi.mock('../../../../../scripts/cody/github-api', () => ({ extractGateCommentBody: vi.fn(), postComment: vi.fn() }))
vi.mock('../../../../../scripts/cody/git-utils', () => ({ commitPipelineFiles: vi.fn() }))
vi.mock('../../../../../scripts/cody/engine/status', () => ({
  loadState: vi.fn(() => null), updateStage: vi.fn((s) => s), writeState: vi.fn(),
}))

import { executePostAction } from '../../../../../scripts/cody/pipeline/post-actions'

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    taskId: 'test-123',
    taskDir: '/tmp/test-123',
    input: { taskId: 'test-123', mode: 'full', dryRun: false },
    taskDef: null,
    profile: 'standard',
    backend: { name: 'test', spawn: vi.fn() },
    ...overrides,
  }
}

describe('run-quality-with-autofix post-action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const action = {
    type: 'run-quality-with-autofix' as const,
    gates: [
      { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
      { name: 'Unit Tests', command: 'pnpm -s test:unit', source: 'test' as const },
    ],
    maxFeedbackLoops: 2,
  }

  it('completes immediately when all gates pass on first try', async () => {
    mockExecSync.mockReturnValue('') // all pass
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    // Autofix should NOT have been called
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('runs autofix when tsc fails, then retries and passes', async () => {
    let tscCallCount = 0
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('tsc')) {
        tscCallCount++
        if (tscCallCount === 1) throw { stdout: 'error TS2345', stderr: '', message: '' }
        return '' // passes on second call
      }
      return '' // unit tests pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    // Autofix was called once
    expect(mockRunAgent).toHaveBeenCalledTimes(1)
    // build-errors.md was written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('build-errors.md'),
      expect.stringContaining('type_error'),
    )
  })

  it('throws after exhausting maxFeedbackLoops', async () => {
    // tsc always fails
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('tsc')) throw { stdout: 'error TS2345', stderr: '', message: '' }
      return '' // unit tests pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await expect(executePostAction(ctx, action, null)).rejects.toThrow(
      /Quality gates failed after 2 autofix attempts/,
    )
    expect(mockRunAgent).toHaveBeenCalledTimes(2)
  })

  it('skips execution in dryRun mode', async () => {
    const ctx = makeCtx({ input: { taskId: 'test-123', mode: 'full', dryRun: true } })

    await executePostAction(ctx, action, null)

    expect(mockExecSync).not.toHaveBeenCalled()
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('only re-runs failed gates, not passing ones', async () => {
    const commandCalls: string[] = []
    let tscCallCount = 0
    mockExecSync.mockImplementation((cmd: string) => {
      commandCalls.push(cmd)
      if (cmd.includes('tsc')) {
        tscCallCount++
        if (tscCallCount === 1) throw { stdout: 'error TS2345', stderr: '', message: '' }
        return ''
      }
      return '' // tests always pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    // First run: both gates called (tsc fails, tests pass)
    // Re-run: only tsc called (it was the only failure)
    const tscCalls = commandCalls.filter(c => c.includes('tsc'))
    const testCalls = commandCalls.filter(c => c.includes('test:unit'))
    expect(tscCalls).toHaveLength(2) // initial + retry
    expect(testCalls).toHaveLength(1) // initial only, not retried
  })
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts`  
**Expected**: ALL 5 tests FAIL — `run-quality-with-autofix` case doesn't exist in `executePostAction`

### GREEN — Implement

**4a.** Add type to `scripts/cody/engine/types.ts`:

```typescript
// After RunUnitTestsAction (line ~214):
export type RunQualityWithAutofixAction = {
  type: 'run-quality-with-autofix'
  gates: Array<{ name: string; command: string; source: 'tsc' | 'lint' | 'format' | 'test' }>
  maxFeedbackLoops: number
}

// Add to PostAction union:
| RunQualityWithAutofixAction
```

**4b.** Add case to `scripts/cody/pipeline/post-actions.ts` (before the `default` case):

Implement the feedback loop as described in the test expectations:
1. Run all gates → collect pass/fail
2. If all pass → return immediately
3. If any fail → classify errors, write `build-errors.md`, run autofix agent, re-run ONLY failed gates
4. Repeat up to `maxFeedbackLoops` times
5. If still failing → throw Error with context

Add imports at top:
```typescript
import { classifyError, formatErrorsAsMarkdown } from './error-classifier'
import { runAgentWithFileWatch, STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from '../agent-runner'
```

**4c.** Update build definition in `scripts/cody/pipeline/definitions.ts` (lines 190-193):

```typescript
// BEFORE:
postActions: [
  { type: 'validate-build-content' },
  { type: 'parallel', actions: [{ type: 'run-tsc' }, { type: 'run-unit-tests' }] },
],

// AFTER:
postActions: [
  { type: 'validate-build-content' },
  {
    type: 'run-quality-with-autofix',
    gates: [
      { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
      { name: 'Unit Tests', command: 'pnpm -s test:unit', source: 'test' as const },
    ],
    maxFeedbackLoops: 2,
  },
],
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts`  
**Expected**: ALL 5 tests pass

**Verify no regressions**: `pnpm vitest run tests/unit/scripts/cody/post-actions.test.ts`

**Acceptance Criteria**:
- [ ] All gates pass → no autofix invoked (zero overhead on happy path)
- [ ] Failed gate → autofix → re-run only failed gate → success
- [ ] All loops exhausted → descriptive error thrown
- [ ] dryRun skips everything
- [ ] Only failed gates re-run (not passing ones)
- [ ] Old `run-tsc`/`run-unit-tests` cases still in switch (backward compat)

---

## Step 5: Update Autofix Agent Context

**Time**: ~10 min | **Fixes**: P1 (autofix needs build-errors.md)  
**TDD**: RED → GREEN

**Files to Touch**:
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED — add 1 test)
- `scripts/cody/stage-prompts.ts` (MODIFIED — line 78)
- `.opencode/agents/autofix.md` (MODIFIED — workflow section)

### RED — Write Failing Test

Add to `describe('STAGE_CONTEXT_FILES')` in `stage-prompts.test.ts`:

```typescript
it('should include build-errors.md in autofix context for build stage feedback', () => {
  expect(STAGE_CONTEXT_FILES.autofix).toContain('build-errors.md')
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/stage-prompts.test.ts`  
**Expected**: FAILS — autofix context is `['verify.md']`, no `build-errors.md`

### GREEN — Implement

In `scripts/cody/stage-prompts.ts` line 78:

```typescript
// BEFORE:
autofix: ['verify.md'],

// AFTER:
autofix: ['verify.md', 'build-errors.md'],
```

Update exact-match test at line 92:

```typescript
// BEFORE:
expect(STAGE_CONTEXT_FILES.autofix).toEqual(['verify.md'])

// AFTER:
expect(STAGE_CONTEXT_FILES.autofix).toEqual(['verify.md', 'build-errors.md'])
```

Update `.opencode/agents/autofix.md` — replace "### 1. Read Errors" section:

```markdown
### 1. Read Errors

Check for error reports in this priority order:
1. `.tasks/<taskId>/build-errors.md` (from build stage feedback loop — higher priority)
2. `.tasks/<taskId>/verify.md` (from verify stage)

Read whichever exists and identify the errors to fix.

If `build-errors.md` exists, each error section includes:
- **Error Category**: type_error, lint_error, test_failure, format_error
- **Fix Instructions**: Follow these EXACTLY
- **Affected Files**: Focus on these files only
- **Error Output**: The raw error messages
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/stage-prompts.test.ts`  
**Expected**: ALL tests pass

**Acceptance Criteria**:
- [ ] `STAGE_CONTEXT_FILES.autofix` contains both `'verify.md'` and `'build-errors.md'`
- [ ] Autofix agent prompt explains priority order
- [ ] Existing verify-stage autofix path unchanged

---

## Step 6: Track Feedback Loops in Status.json

**Time**: ~15 min | **Fixes**: Observability  
**TDD**: RED → GREEN

**Files to Touch**:
- `tests/unit/scripts/cody/engine/feedback-tracking.test.ts` (NEW)
- `scripts/cody/engine/types.ts` (MODIFIED — StageStateV2 interface + Zod schema)

### RED — Write Failing Tests

Create `tests/unit/scripts/cody/engine/feedback-tracking.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isPipelineStateV2, PipelineStateV2Schema } from '../../../../../scripts/cody/engine/types'

describe('StageStateV2 feedback tracking fields', () => {
  const baseState = {
    version: 2 as const,
    taskId: 'test-123',
    mode: 'full',
    pipeline: 'full',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'completed' as const,
    cursor: null,
    stages: {},
  }

  it('validates state with feedbackLoops and feedbackErrors fields', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackLoops: 2,
          feedbackErrors: ['type_error', 'test_failure'],
        },
      },
    }
    expect(isPipelineStateV2(state)).toBe(true)
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('validates state WITHOUT feedback fields (backward compat)', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
        },
      },
    }
    expect(isPipelineStateV2(state)).toBe(true)
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('rejects invalid feedbackLoops value', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackLoops: 'not-a-number',
        },
      },
    }
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it('rejects invalid feedbackErrors value', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackErrors: 'not-an-array',
        },
      },
    }
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(false)
  })
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/engine/feedback-tracking.test.ts`  
**Expected**: Tests 1, 3, 4 FAIL — Zod schema doesn't know about new fields (unknown keys rejected or not validated)

### GREEN — Implement

In `scripts/cody/engine/types.ts`:

**Interface** (after line 107):
```typescript
export interface StageStateV2 {
  // ... existing fields
  feedbackLoops?: number
  feedbackErrors?: string[]
}
```

**Zod schema** (inside `PipelineStateV2Schema`, the stage z.object at lines 136-147):
```typescript
z.object({
  // ... existing fields
  feedbackLoops: z.number().optional(),
  feedbackErrors: z.array(z.string()).optional(),
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/engine/feedback-tracking.test.ts`  
**Expected**: ALL 4 tests pass

**Verify no regressions**: `pnpm vitest run tests/unit/scripts/cody/engine/integration.test.ts`

**Acceptance Criteria**:
- [ ] State WITH feedback fields passes Zod validation
- [ ] State WITHOUT feedback fields passes Zod validation (backward compat)
- [ ] Invalid values are rejected
- [ ] `isPipelineStateV2` type guard works with new fields

---

## Step 7: Integration Test — Full Pipeline Flow

**Time**: ~20 min  
**TDD**: RED → GREEN (integration-level)

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts` (NEW)

### RED — Write Integration Tests

Create `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { STAGE_CONTEXT_FILES } from '../../../../../scripts/cody/stage-prompts'
import { resolveRerunFromStage } from '../../../../../scripts/cody/rerun-utils'

/**
 * Integration tests verifying all 4 problems are fixed end-to-end
 */
describe('Feedback Loop Integration', () => {
  const IMPL_STAGES = ['architect', 'plan-gap', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']

  describe('P1: Build post-action has inner retry', () => {
    it('build stage definition uses run-quality-with-autofix (not raw run-tsc)', async () => {
      // Import the actual build stage definition
      // We can't easily test the full post-action in integration without mocking everything,
      // but we can verify the definition is wired correctly
      const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')
      const mockCtx = {
        taskId: 'test', taskDir: '/tmp/test',
        input: { taskId: 'test', mode: 'impl' as const, dryRun: false },
        taskDef: null, profile: 'standard' as const,
        backend: { name: 'test', spawn: () => ({} as any) },
      }
      const pipeline = buildPipeline('impl', 'standard', false, mockCtx)
      const buildDef = pipeline.stages.get('build')

      expect(buildDef).toBeDefined()
      expect(buildDef!.postActions).toBeDefined()

      // Should have run-quality-with-autofix, not parallel run-tsc/run-unit-tests
      const actionTypes = buildDef!.postActions!.map((a: any) => a.type)
      expect(actionTypes).toContain('run-quality-with-autofix')
      expect(actionTypes).not.toContain('parallel')
    })
  })

  describe('P2: Build agent reads rerun-feedback.md', () => {
    it('build context includes rerun-feedback.md', () => {
      expect(STAGE_CONTEXT_FILES.build).toContain('rerun-feedback.md')
    })

    it('autofix context includes build-errors.md', () => {
      expect(STAGE_CONTEXT_FILES.autofix).toContain('build-errors.md')
    })
  })

  describe('P3: Supervisor rerun backs up to architect', () => {
    it('rerun --from=build --feedback backs up to architect', () => {
      expect(resolveRerunFromStage('build', 'fix type error', IMPL_STAGES)).toBe('architect')
    })

    it('rerun --from=build without feedback stays at build', () => {
      expect(resolveRerunFromStage('build', undefined, IMPL_STAGES)).toBe('build')
    })

    it('rerun --from=verify --feedback backs up to architect', () => {
      expect(resolveRerunFromStage('verify', 'lint errors', IMPL_STAGES)).toBe('architect')
    })
  })

  describe('P4: Feedback flow continuity', () => {
    it('architect reads rerun-feedback.md (existing behavior preserved)', () => {
      expect(STAGE_CONTEXT_FILES.architect).toContain('rerun-feedback.md')
    })

    it('all impl stages after architect are in correct order', () => {
      // Verify the pipeline order makes architect run before build
      expect(IMPL_STAGES.indexOf('architect')).toBeLessThan(IMPL_STAGES.indexOf('build'))
      expect(IMPL_STAGES.indexOf('plan-gap')).toBeLessThan(IMPL_STAGES.indexOf('build'))
    })
  })
})
```

**Run**: `pnpm vitest run tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts`  
**Expected**: If Steps 1-6 done correctly, ALL tests pass. If any fail, they point to a wiring issue.

**Acceptance Criteria**:
- [ ] All 7 integration assertions pass
- [ ] Problems P1-P4 verified as fixed

---

## Step 8: Quality Gates — Full Regression Check

**Time**: ~10 min

**Run all quality gates in order:**

```bash
pnpm -s tsc --noEmit        # TypeScript compiles
pnpm -s lint                 # No lint errors
pnpm -s format:check         # Formatting OK
pnpm -s test:unit            # ALL unit tests pass
```

**Critical test files to verify pass:**

| Test File | Covers |
|-----------|--------|
| `tests/unit/scripts/cody/stage-prompts.test.ts` | Steps 1, 5 |
| `tests/unit/scripts/cody/rerun-feedback-routing.test.ts` | Step 2 |
| `tests/unit/scripts/cody/pipeline/error-classifier.test.ts` | Step 3 |
| `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` | Step 4 |
| `tests/unit/scripts/cody/engine/feedback-tracking.test.ts` | Step 6 |
| `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts` | Step 7 |
| `tests/unit/scripts/cody/post-actions.test.ts` | Existing (no regression) |
| `tests/unit/scripts/cody/engine/integration.test.ts` | Existing (no regression) |
| `tests/unit/scripts/cody/scripted-stages.test.ts` | Existing (verify loop untouched) |
| `tests/unit/scripts/supervisor.spec.ts` | Existing (supervisor untouched) |

**Acceptance Criteria**:
- [ ] `tsc --noEmit` passes
- [ ] `lint` passes
- [ ] `format:check` passes
- [ ] ALL unit tests pass (0 failures)
- [ ] Verify stage autofix loop in `scripted-handler.ts` unchanged
- [ ] Supervisor code unchanged and tests passing

---

## File Change Summary

| Step | File | Action | Lines Changed |
|------|------|--------|---------------|
| 1 | `scripts/cody/stage-prompts.ts` | MODIFIED | 1 (line 75) |
| 1 | `tests/unit/scripts/cody/stage-prompts.test.ts` | MODIFIED | ~8 lines |
| 2 | `scripts/cody/rerun-utils.ts` | NEW | ~30 lines |
| 2 | `scripts/cody/entry.ts` | MODIFIED | ~8 lines (~454) |
| 2 | `tests/unit/scripts/cody/rerun-feedback-routing.test.ts` | NEW | ~55 lines |
| 3 | `scripts/cody/pipeline/error-classifier.ts` | NEW | ~80 lines |
| 3 | `tests/unit/scripts/cody/pipeline/error-classifier.test.ts` | NEW | ~100 lines |
| 4 | `scripts/cody/engine/types.ts` | MODIFIED | ~10 lines |
| 4 | `scripts/cody/pipeline/post-actions.ts` | MODIFIED | ~60 lines |
| 4 | `scripts/cody/pipeline/definitions.ts` | MODIFIED | ~8 lines (190-193) |
| 4 | `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` | NEW | ~120 lines |
| 5 | `scripts/cody/stage-prompts.ts` | MODIFIED | 1 (line 78) |
| 5 | `.opencode/agents/autofix.md` | MODIFIED | ~10 lines |
| 6 | `scripts/cody/engine/types.ts` | MODIFIED | ~6 lines |
| 6 | `tests/unit/scripts/cody/engine/feedback-tracking.test.ts` | NEW | ~60 lines |
| 7 | `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts` | NEW | ~70 lines |

**Total**: 6 new files, 6 modified files, ~620 lines of code+tests
