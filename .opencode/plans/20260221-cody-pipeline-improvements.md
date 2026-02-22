# Cody Pipeline Improvements — Full TDD Implementation Plan

**Branch**: `fix/cody-pipeline-improvements`
**Created**: 2026-02-21
**Status**: Planned

---

## Pre-existing Issues

- `tests/unit/scripts/cody/bugfixes.test.ts` line 48: **already failing** — asserts `IMPL_PIPELINE` has no parallel groups, but it does (`{ parallel: ['verify', 'auditor'] }`). Phase 4 fixes this.

---

## Phase 1: High Priority Fixes (Model Mismatch + Git Staging)

### 1.1 Fix model mismatch — `architect`, `spec`, `gap`, `clarify` use wrong models

**Root cause**: `STAGE_MODELS` in `agent-runner.ts:56-61` only lists lightweight stages. Stages like `architect` (should use Opus), `spec`/`gap`/`clarify` (should use Gemini Pro) fall through to `DEFAULT_MODEL` (MiniMax), contradicting `opencode.json`.

**Files modified**:

- `scripts/cody/agent-runner.ts` (add entries to `STAGE_MODELS`)
- `tests/unit/scripts/cody/agent-runner.test.ts` (add failing tests first)

**TDD steps**:

1. **RED** — Add tests to `agent-runner.test.ts`:

   ```typescript
   it('should use Opus for architect stage', () => {
     expect(resolveModel('architect')).toBe('anthropic/claude-opus-4-6')
   })
   it('should use Gemini Pro for spec stage', () => {
     expect(resolveModel('spec')).toBe('google/gemini-3-pro-preview')
   })
   it('should use Gemini Pro for gap stage', () => {
     expect(resolveModel('gap')).toBe('google/gemini-3-pro-preview')
   })
   it('should use Gemini Pro for clarify stage', () => {
     expect(resolveModel('clarify')).toBe('google/gemini-3-pro-preview')
   })
   it('should use DEFAULT_MODEL for taskify stage', () => {
     expect(resolveModel('taskify')).toBe('minimax-coding-plan/MiniMax-M2.5')
   })
   ```

   Run tests -> all new tests FAIL.

2. **GREEN** — Update `STAGE_MODELS` in `agent-runner.ts`:

   ```typescript
   export const STAGE_MODELS: Record<string, string> = {
     architect: 'anthropic/claude-opus-4-6',
     spec: 'google/gemini-3-pro-preview',
     gap: 'google/gemini-3-pro-preview',
     clarify: 'google/gemini-3-pro-preview',
     'plan-review': FAST_MODEL,
     autofix: FAST_MODEL,
     auditor: FAST_MODEL,
     'apply-audit': FAST_MODEL,
   }
   ```

   Run tests -> all tests PASS.

3. **REFACTOR** — Add a consistency test that compares `STAGE_MODELS` + `DEFAULT_MODEL` against `opencode.json`:
   ```typescript
   describe('model configuration consistency', () => {
     it('STAGE_MODELS should match opencode.json agent models', () => {
       const openCodeConfig = JSON.parse(
         fs.readFileSync(path.join(process.cwd(), 'opencode.json'), 'utf-8'),
       )
       for (const [stage, model] of Object.entries(STAGE_MODELS)) {
         if (openCodeConfig.agent[stage]) {
           expect(model).toBe(openCodeConfig.agent[stage].model)
         }
       }
     })
   })
   ```

---

### 1.2 Fix `git add -u` not staging new files

**Root cause**: `commitAndPush()` in `git-utils.ts:393` uses `git add -u` which only stages modifications/deletions to already-tracked files. New files created by the build agent (new collections, new test files, new components) are silently dropped.

**Files modified**:

- `scripts/cody/git-utils.ts` (`commitAndPush` function)
- `tests/unit/scripts/cody/git-utils.test.ts` (add failing test)

**TDD steps**:

1. **RED** — Add test to `git-utils.test.ts`:

   ```typescript
   describe('commitAndPush staging behavior', () => {
     it('should stage both tracked changes and new src/test files', () => {
       mockExecSync.mockImplementation((cmd: string) => {
         if (cmd.includes('git status --porcelain')) {
           return ' M src/existing.ts\n?? src/collections/New.ts\n?? tests/unit/new.test.ts\n'
         }
         if (cmd.includes('git branch --show-current')) return 'feat/test\n'
         if (cmd.includes('git rev-parse HEAD')) return 'abc1234\n'
         return ''
       })

       commitAndPush('260218-test', '/tasks/260218-test')

       const addCalls = mockExecSync.mock.calls
         .filter((c) => typeof c[0] === 'string' && c[0].startsWith('git add'))
         .map((c) => c[0])

       // Should stage tracked AND new safe-pattern files
       expect(addCalls.some((c) => c.includes('-u'))).toBe(true)
       expect(addCalls.some((c) => c.includes('src/') || c.includes('tests/'))).toBe(true)
     })

     it('should NOT stage .env or secret files', () => {
       mockExecSync.mockImplementation((cmd: string) => {
         if (cmd.includes('git status --porcelain')) return '?? .env.local\n'
         if (cmd.includes('git branch --show-current')) return 'feat/test\n'
         return ''
       })

       commitAndPush('260218-test', '/tasks/260218-test')

       const addCalls = mockExecSync.mock.calls
         .filter((c) => typeof c[0] === 'string' && c[0].includes('git add'))
         .map((c) => c[0])

       expect(addCalls).not.toContainEqual(expect.stringContaining('-A'))
     })
   })
   ```

   Run -> FAIL (current code only does `git add -u`).

2. **GREEN** — Update `commitAndPush()` in `git-utils.ts`:

   ```typescript
   // Stage tracked changes
   execSync('git add -u', { cwd: workDir, stdio: 'inherit' })
   // Also stage new files in safe directories (but NOT .env, secrets, etc.)
   const SAFE_STAGE_DIRS = ['src/', 'tests/', '.tasks/']
   for (const dir of SAFE_STAGE_DIRS) {
     try {
       execFileSync('git', ['add', '--', dir], { cwd: workDir, stdio: 'pipe' })
     } catch {
       // Pattern may not match any files
     }
   }
   ```

3. **REFACTOR** — Extract `SAFE_STAGE_DIRS` as an exported constant for testability.

---

### 1.3 Add note to `opencode.json` documenting runtime override

**File modified**: `opencode.json`

Add a `_modelNote` field:

```json
"_modelNote": "Agent models here are defaults. Runtime models are set by STAGE_MODELS in scripts/cody/agent-runner.ts via MODEL env var."
```

---

## Phase 2: Security Fixes

### 2.1 Shell injection in `getCommitSummary`

**File**: `scripts/cody/scripted-stages.ts:119-128`

**Current code** (vulnerable):

```typescript
execSync(`git log --oneline ${defaultBranch}..HEAD`, { cwd, encoding: 'utf-8' })
```

**TDD steps**:

1. **RED** — Add test to `scripted-stages.test.ts`:

   ```typescript
   describe('getCommitSummary shell safety', () => {
     it('should use execFileSync to prevent shell injection via branch names', () => {
       setupPrMocks({ branch: 'main; rm -rf /' })
       runPrStage(taskDir, outputFile)

       const execFileCalls = mockExecFileSync.mock.calls.filter(
         (c) => c[0] === 'git' && c[1]?.[0] === 'log',
       )
       expect(execFileCalls.length).toBeGreaterThan(0)
     })
   })
   ```

2. **GREEN** — Convert to `execFileSync`:
   ```typescript
   function getCommitSummary(defaultBranch: string, cwd: string): string {
     try {
       return execFileSync('git', ['log', '--oneline', `${defaultBranch}..HEAD`], {
         cwd,
         encoding: 'utf-8',
       }).trim()
     } catch {
       return ''
     }
   }
   ```

---

### 2.2 Shell injection in `commitPipelineFiles`

**File**: `scripts/cody/git-utils.ts:524-536`

**Current code** (vulnerable):

```typescript
execSync(`git add ${taskDir}`, { cwd, stdio: 'inherit' })
```

**TDD steps**:

1. **RED** — Add test to `git-utils.test.ts`:

   ```typescript
   describe('commitPipelineFiles shell safety', () => {
     it('should use execFileSync for git add to prevent path injection', () => {
       const result = commitPipelineFiles({
         taskDir: '/path with spaces/.tasks/test',
         taskId: 'test',
         message: 'test commit',
         stagingStrategy: 'task-only',
       })

       const gitAddCalls = mockExecFileSync.mock.calls.filter(
         (c) => c[0] === 'git' && c[1]?.[0] === 'add',
       )
       expect(gitAddCalls.length).toBeGreaterThan(0)
     })
   })
   ```

2. **GREEN** — Replace all `execSync(\`git add ${taskDir}\`)`with`execFileSync('git', ['add', taskDir])`in`commitPipelineFiles`.

---

### 2.3 Audit remaining `execSync` with string interpolation

Scan all `execSync(\`...\`)`calls in`scripted-stages.ts`and`git-utils.ts`for remaining interpolation risks. Convert to`execFileSync` where user-controlled values are interpolated.

---

## Phase 3: Reliability Improvements

### 3.1 Stabilize file detection (size stabilization)

**File**: `scripts/cody/agent-runner.ts:201-238`

**Root cause**: The 2-second fixed settle delay after file detection doesn't guarantee the file is fully written.

**TDD steps**:

1. **RED** — Add test to `agent-runner.test.ts`:

   ```typescript
   describe('file detection stabilization', () => {
     it('should export FILE_STABLE_CHECKS constant', () => {
       expect(FILE_STABLE_CHECKS).toBe(2)
     })
   })
   ```

2. **GREEN** — Add `FILE_STABLE_CHECKS = 2` constant. Modify polling logic to track `lastSeenSize` and require `stableCount >= FILE_STABLE_CHECKS` before settling:

   ```typescript
   let lastSeenSize = -1
   let stableCount = 0

   // Inside poll:
   if (stat.size > 10) {
     if (stat.size === lastSeenSize) {
       stableCount++
       if (stableCount >= FILE_STABLE_CHECKS) {
         settling = true
         // ... finish
       }
     } else {
       lastSeenSize = stat.size
       stableCount = 1
     }
   }
   ```

---

### 3.2 Add aggregate timeout to verify stage

**File**: `scripts/cody/scripted-stages.ts:50-87`

**Root cause**: Each gate gets its own timeout, but no aggregate timeout exists.

**TDD steps**:

1. **RED** — Add test to `scripted-stages.test.ts`:

   ```typescript
   describe('runVerifyStage aggregate timeout', () => {
     it('should skip remaining gates when cumulative time exceeds timeout', () => {
       const result = runVerifyStage(outputFile, cwd, 6000)
       expect(result.report).toContain('SKIPPED')
       expect(result.passed).toBe(false)
     })
   })
   ```

2. **GREEN** — Add time tracking to `runVerifyStage`:

   ```typescript
   export function runVerifyStage(
     outputFile: string,
     cwd?: string,
     timeout?: number,
   ): VerifyResult {
     const startTime = Date.now()
     const effectiveTimeout = timeout ?? Infinity

     const gateDefinitions = [
       { name: 'TypeScript', command: 'pnpm -s tsc --noEmit' },
       { name: 'Lint', command: 'pnpm -s lint' },
       { name: 'Format', command: 'pnpm -s format:check' },
       { name: 'Unit Tests', command: 'pnpm -s test:unit' },
     ]

     const gates: GateResult[] = []
     for (const gate of gateDefinitions) {
       const elapsed = Date.now() - startTime
       const remaining = effectiveTimeout - elapsed
       if (remaining <= 0) {
         gates.push({
           name: gate.name,
           passed: false,
           output: 'SKIPPED: aggregate timeout exceeded',
         })
         continue
       }
       gates.push(
         runGate(
           gate.name,
           gate.command,
           cwd || process.cwd(),
           Math.min(remaining, DEFAULT_GATE_TIMEOUT),
         ),
       )
     }
     // ... rest of report generation
   }
   ```

---

### 3.3 Add `force` flag to `runSingleStage` for retries (OPTIONAL)

**Status**: Low priority. The current code already handles this by **deleting** output files before calling `runSingleStage` in the retry loop. Functionally correct as-is.

---

## Phase 4: Code Quality

### 4.1 Deduplicate stage lists — single source of truth

**Root cause**: Valid stage names defined in 3 places: `cody-utils.ts:72-86`, `stage-prompts.ts:29-43`, `pipeline-utils.ts:398-406`.

**Files modified**:

- `scripts/cody/stage-prompts.ts` — keep `ALL_STAGES` as canonical source
- `scripts/cody/cody-utils.ts` — import from `stage-prompts.ts`

**TDD steps**:

1. **RED** — Add consistency test:

   ```typescript
   describe('stage list consistency', () => {
     it('VALID_STAGES in cody-utils should match ALL_STAGES from stage-prompts', async () => {
       const { ALL_STAGES } = await import('../../../../scripts/cody/stage-prompts')
       const { isValidStage } = await import('../../../../scripts/cody/cody-utils')

       for (const stage of ALL_STAGES) {
         expect(isValidStage(stage)).toBe(true)
       }
     })
   })
   ```

2. **GREEN** — In `cody-utils.ts`, replace local `VALID_STAGES` with:
   ```typescript
   import { ALL_STAGES } from './stage-prompts'
   const VALID_STAGES = [...ALL_STAGES]
   ```

---

### 4.2 Fix failing bugfixes test (pre-existing)

**File**: `tests/unit/scripts/cody/bugfixes.test.ts:43-53`

Test incorrectly asserts no parallel groups in `IMPL_PIPELINE`. Fix to reflect actual structure:

```typescript
it('should export IMPL_PIPELINE with expected structure including parallel groups', async () => {
  const { IMPL_PIPELINE, isParallelStage } = await import('../../../../scripts/cody/pipeline-utils')

  const parallelStages = IMPL_PIPELINE.filter(isParallelStage)
  expect(parallelStages).toHaveLength(1)
  expect(parallelStages[0]).toEqual({ parallel: ['verify', 'auditor'] })

  const lastStage = IMPL_PIPELINE[IMPL_PIPELINE.length - 1]
  expect(lastStage).toBe('pr')
})
```

---

### 4.3 Extract autofix loop

**Root cause**: 90-line autofix loop embedded inline in `cody.ts:668-760`.

**Files modified**:

- New file: `scripts/cody/autofix-loop.ts`
- `scripts/cody/cody.ts` — replace inline code with function call
- New file: `tests/unit/scripts/cody/autofix-loop.test.ts`

**TDD steps**:

1. **RED** — Write `autofix-loop.test.ts`:

   ```typescript
   describe('runAutofixLoop', () => {
     it('should return { fixed: true } when autofix + re-verify succeeds on first attempt', ...)
     it('should retry up to MAX_AUTOFIX_ATTEMPTS times', ...)
     it('should return { fixed: false } when all attempts exhausted', ...)
     it('should delete previous autofix output before each attempt', ...)
     it('should delete verify output before re-running verify', ...)
   })
   ```

2. **GREEN** — Extract lines 668-760 from `cody.ts` into `autofix-loop.ts`:

   ```typescript
   export interface AutofixLoopResult {
     fixed: boolean
     attempts: number
   }

   export const MAX_AUTOFIX_ATTEMPTS = 2

   export async function runAutofixLoop(
     input: CodyInput,
     taskDir: string,
     verifyOutputFile: string,
     backend: RunnerBackend,
   ): Promise<AutofixLoopResult> { ... }
   ```

3. **REFACTOR** — Update `cody.ts` to call `runAutofixLoop()`.

---

### 4.4 Cleanup legacy agent definitions

**Files**: `.opencode/agents/commit.md`, `verify.md`, `pr.md`, `auditor.md`

No tests needed — documentation-only:

- Add `# DEPRECATED — this stage is now scripted` header to `commit.md`, `verify.md`, `pr.md`
- Fix `auditor.md:26-29` pipeline diagram (remove `test` stage, show correct flow)

---

## Phase 5: UX Improvements

### 5.1 Smart rerun default stage

**Root cause**: `cody.ts:870-871` hardcodes `'build'` as default rerun stage.

**Files modified**:

- `scripts/cody/cody-utils.ts` — add `getLastFailedStage()` helper
- `scripts/cody/cody.ts:870-871` — use helper

**TDD steps**:

1. **RED** — Add tests:

   ```typescript
   describe('getLastFailedStage', () => {
     it('should return the last failed stage from status.json', ...)
     it('should return null when no stages have failed', ...)
     it('should return null when status.json does not exist', ...)
   })
   ```

2. **GREEN** — Implement:

   ```typescript
   export function getLastFailedStage(taskId: string): string | null {
     const status = readStatus(taskId)
     if (!status?.stages) return null

     const failedStages = Object.entries(status.stages)
       .filter(([_, s]) => s.state === 'failed' || s.state === 'timeout')
       .map(([name]) => name)

     return failedStages.length > 0 ? failedStages[failedStages.length - 1] : null
   }
   ```

3. Update `cody.ts:870-871`:
   ```typescript
   if (!input.fromStage) {
     input.fromStage = getLastFailedStage(input.taskId) || 'build'
   }
   ```

---

### 5.2 Implement `editComment`

**File**: `scripts/cody/cody-utils.ts:260-263` (currently a stub)

**TDD steps**:

1. **RED** — Add tests:

   ```typescript
   describe('editComment', () => {
     it('should call gh api to patch the comment', ...)
     it('should not throw when gh api call fails', ...)
   })
   ```

2. **GREEN** — Implement using `execFileSync` with `gh api`.

3. Add `botCommentId?: number` to `CodyPipelineStatus` interface.

---

### 5.3 Per-stage timing in completion comments

**File**: `scripts/cody/cody-utils.ts:754-793`

**TDD steps**:

1. **RED** — Add test asserting elapsed times appear in completed status comments.

2. **GREEN** — Update `formatStatusComment` completed branch to iterate stages with timing.

---

### 5.4 In-progress stage comments (lightweight)

**File**: `scripts/cody/cody.ts`

Post progress update at key milestones (build, verify) instead of every stage.

---

## Phase 6: Observability

### 6.1 Structured log prefix

**Files**:

- New: `scripts/cody/logger.ts`
- Updated: key files where stage context is available

**TDD steps**:

1. **RED** — Test `logWithContext` prefixes with `[stage:timestamp]`.
2. **GREEN** — Implement `logWithContext()` and `errorWithContext()`.
3. Replace key `console.log` calls in stage-scoped contexts.

---

### 6.2 Cost tracking stub (schema only)

Add `tokenUsage?: { input: number; output: number }` to `StageStatus` interface. No population logic — schema only.

---

## Phase 7: Testing

### 7.1 Full pipeline dry-run integration test

Extend `tests/int/scripts/cody.int.spec.ts` with a test that runs `--mode=full --dry-run` and validates all stages complete in order with correct status.json.

### 7.2 Parallel stage failure isolation test

Verify `Promise.allSettled` correctly isolates failures between parallel stages.

---

## Execution Order & Dependencies

```
BATCH 1 (independent):
  Phase 1.1  Model mismatch fix
  Phase 1.2  Git add -u fix
  Phase 2.1  Shell injection scripted-stages
  Phase 2.2  Shell injection git-utils
  Phase 4.2  Fix failing bugfixes test

BATCH 2 (after Batch 1):
  Phase 1.3  opencode.json note
  Phase 4.1  Dedup stage lists
  Phase 5.1  Smart rerun default
  Phase 5.3  Timing in completion comments

BATCH 3 (independent):
  Phase 3.1  File detection stabilization
  Phase 3.2  Verify aggregate timeout
  Phase 5.2  Implement editComment

BATCH 4 (after Batch 3):
  Phase 4.3  Extract autofix loop
  Phase 5.4  Progress comments
  Phase 6.1  Structured logging

ANYTIME:
  Phase 4.4  Legacy agent cleanup
  Phase 6.2  Cost tracking stub

LAST (after all):
  Phase 7.1  Full pipeline integration test
  Phase 7.2  Parallel failure isolation test
```

---

## Files Changed Summary

| File                                              | Changes                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `scripts/cody/agent-runner.ts`                    | Add models to STAGE_MODELS, FILE_STABLE_CHECKS, stabilize detection |
| `scripts/cody/git-utils.ts`                       | Safe staging in commitAndPush, execFileSync in commitPipelineFiles  |
| `scripts/cody/scripted-stages.ts`                 | execFileSync for getCommitSummary, aggregate timeout in verify      |
| `scripts/cody/cody-utils.ts`                      | Import stages, getLastFailedStage, editComment, timing, cost stub   |
| `scripts/cody/cody.ts`                            | Smart rerun default, progress comments, call autofix-loop           |
| `scripts/cody/autofix-loop.ts`                    | **NEW** — extracted from cody.ts                                    |
| `scripts/cody/logger.ts`                          | **NEW** — structured logging helpers                                |
| `opencode.json`                                   | Add \_modelNote field                                               |
| `.opencode/agents/commit.md`                      | Add DEPRECATED header                                               |
| `.opencode/agents/verify.md`                      | Add DEPRECATED header                                               |
| `.opencode/agents/pr.md`                          | Add DEPRECATED header                                               |
| `.opencode/agents/auditor.md`                     | Fix pipeline diagram                                                |
| `tests/unit/scripts/cody/agent-runner.test.ts`    | Model tests, file detection, consistency                            |
| `tests/unit/scripts/cody/git-utils.test.ts`       | Safe staging, shell injection tests                                 |
| `tests/unit/scripts/cody/scripted-stages.test.ts` | Shell injection, aggregate timeout                                  |
| `tests/unit/scripts/cody/cody-utils.test.ts`      | getLastFailedStage, editComment, timing                             |
| `tests/unit/scripts/cody/bugfixes.test.ts`        | Fix parallel group assertion                                        |
| `tests/unit/scripts/cody/autofix-loop.test.ts`    | **NEW** — autofix loop tests                                        |
| `tests/unit/scripts/cody/logger.test.ts`          | **NEW** — logger tests                                              |
| `tests/int/scripts/cody.int.spec.ts`              | Full dry-run pipeline test                                          |

---

## Quality Gates (run after each phase)

```bash
pnpm vitest run --config vitest.config.unit.mts tests/unit/scripts/cody/
pnpm -s tsc --noEmit
pnpm -s lint
```

## Estimated Scope

- ~20 test cases added (RED phase)
- ~12 source files modified
- 3 new files created
- 1 pre-existing failing test fixed
- 0 new dependencies
