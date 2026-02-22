# Plan: Cody Pipeline Deep Fixes (TDD)

## Overview

Six bugs in the Cody CI/CD pipeline — two critical (gate comments post empty bodies to GitHub issues), two medium (dead code waste, input mutation corrupts status reports), and two security (shell injection in GitHub API helpers). Each fix follows strict TDD: write a failing reproduction test first, apply the minimal fix, verify the test passes.

## Bugs Addressed

| Bug | Severity | File | Lines | Summary |
|-----|----------|------|-------|---------|
| 1 | CRITICAL | `scripts/cody/cody.ts` | 452–469 | Taskify gate extraction strips all `##` and `\|` lines → empty comment |
| 2 | CRITICAL | `scripts/cody/cody.ts` | 772–777 | Architect gate regex `[^]+` eats entire body → empty comment |
| 3 | MEDIUM | `scripts/cody/cody.ts` | 420, 435, 438 | `readTask` called 3× after taskify; `_taskDefForSkip` is dead code |
| 4 | MEDIUM | `scripts/cody/cody.ts` | 973 | `input.mode = 'full'` mutates shared object → completion comment lies |
| 5 | MINOR | `scripts/cody/cody.ts` | 450, 771 | Redundant `await import('./cody-utils')` when `postComment` is already statically imported |
| 6 | SECURITY | `scripts/cody/cody-utils.ts` | 284 | `editComment` uses `execSync` with string interpolation → shell injection |
| 7 | SECURITY | `scripts/cody/cody-utils.ts` | 307–308 | `getLatestIssueComment` interpolates `excludeAuthor` into jq filter → shell injection |

---

### Step 1: Fix gate comment extraction (Bug 1 + Bug 2)

Both bugs are in the same logical operation — extracting the gate comment body from a `gate-*.md` file to post on the GitHub issue. They share the same root cause and fix pattern, so they're addressed together.

#### Root Cause

**Bug 1** (`cody.ts:452–469`): The taskify hard-stop gate reads `gate-taskify.md` and iterates line-by-line. The filter `(!line.startsWith('## ') && !line.startsWith('|'))` skips every `##` heading and every `|` table row. But the entire `formatGateComment` output IS headings and table rows. Result: `commentLines` collects only blank lines and the `> summary` blockquote — the posted comment is nearly empty.

**Bug 2** (`cody.ts:772–777`): The architect gate uses a different extraction:
```
gateContent.split('---')[0].replace(/^## [^]+\n/, '').trim()
```
The regex `[^]` matches ANY character including newlines. The `+` quantifier is greedy, so `^## [^]+\n` matches from the first `##` all the way to the last `\n` before `---`, consuming virtually the entire body. Result: empty or near-empty comment.

Both bugs exist because the callers try to re-extract the comment from the file, when the file was built by prepending `# Gate Request\n\n` to the `formatGateComment` output and appending nothing after it. The correct fix is to strip the `# Gate Request\n\n` prefix and (for the architect case, where `---` is INSIDE the comment from `formatGateComment` line 262) take the full content.

Looking at `clarify-workflow.ts:367`:
```ts
fs.writeFileSync(requestPath, `# Gate Request\n\n${comment}\n`)
```
The file is: `# Gate Request\n\n` + full formatGateComment output (which contains `---` at line 262 as part of the comment) + `\n`.

So the correct extraction is: strip the first line (`# Gate Request`) and the following blank line, then take everything that remains. The `---` line and the "Reply with `/cody approve`..." text are PART of the comment and should be posted.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody.ts` | 452–469 | MODIFIED — replace line-by-line extraction with prefix-strip |
| `scripts/cody/cody.ts` | 772–777 | MODIFIED — replace regex extraction with prefix-strip |
| `tests/unit/scripts/cody/gate-comment-extraction.test.ts` | (new) | NEW — reproduction tests for both bugs |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/gate-comment-extraction.test.ts`

**Test 1 — Bug 1 exposure**: Build a realistic `gate-taskify.md` string (using the exact format from `formatGateComment`: `# Gate Request\n\n## 🚫 Hard Stop...\n\n| Field | Value |\n|---|---|\n| **Risk** | high |\n\n### Task Summary\n> Some summary\n\n---\n\nReply with...`). Run the current extraction logic (lines 452–466 extracted into a pure helper function). Assert the result contains the `## 🚫 Hard Stop` header AND the table rows. **Expected: FAILS** because the current logic strips them.

**Test 2 — Bug 2 exposure**: Build a realistic `gate-architect.md` string. Run the current regex extraction (`split('---')[0].replace(/^## [^]+\n/, '').trim()`). Assert the result contains the header and table. **Expected: FAILS** because the regex eats the content.

**Test 3 — Fixed extraction**: Call the new extraction helper (strip `# Gate Request\n\n` prefix). Assert the result contains all headers, all table rows, the task summary, and the `---` / approval instructions.

#### Fix

1. Extract a shared pure function `extractGateCommentBody(fileContent: string): string` that:
   - Strips the `# Gate Request\n\n` prefix (first occurrence only) via `fileContent.replace(/^# Gate Request\n\n/, '')`
   - Trims trailing whitespace
   - Returns the full remaining content (including `---` and approval instructions)

2. In `cody.ts:446–469` (taskify gate): replace the entire `const lines = ... commentLines.join(...)` block with a call to `extractGateCommentBody(gateContent)`.

3. In `cody.ts:772–777` (architect gate): replace the `gateContent.split('---')[0].replace(...)` with a call to `extractGateCommentBody(gateContent)`.

4. Remove the dynamic `import('./cody-utils')` at lines 450 and 771 (covered fully in Step 4, but the replacement here uses the already-imported `postComment`).

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/gate-comment-extraction.test.ts
```

- Tests 1 & 2 → FAIL before fix (demonstrating the bugs)
- After fix, re-tag tests 1 & 2 to use the new extraction → all 3 PASS

#### Acceptance Criteria

- [ ] `extractGateCommentBody` is a named export from `scripts/cody/cody-utils.ts` (or a local helper in `cody.ts`)
- [ ] Taskify gate posts a comment containing `## 🚫 Hard Stop` header, the risk table, task summary, and approval instructions
- [ ] Architect gate posts a comment containing `## 🚦 Risk Gate` header, the risk table, plan snippet, and approval instructions
- [ ] No empty or whitespace-only comments are ever posted (test assertion)
- [ ] `pnpm -s tsc --noEmit` passes

---

### Step 2: Remove dead code and redundant readTask calls (Bug 3)

#### Root Cause

After taskify completes (`cody.ts:418–438`), `readTask(taskDir)` is called three times in rapid succession:

1. **Line 420**: `readTask(taskDir)` — validates + normalizes task.json, writes back corrected values. Return value discarded.
2. **Line 435**: `const _taskDefForSkip = readTask(taskDir)` — the variable has a leading underscore (acknowledged unused) and is NEVER referenced anywhere. Pure dead code.
3. **Line 438**: `const taskDefAfterTaskify = readTask(taskDir)` — the actual value used for the gate check.

Each `readTask` call reads from disk, parses JSON, normalizes fields, and writes the file back. Three calls means three redundant disk read-parse-normalize-write cycles for identical data.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody.ts` | 420, 435, 438 | MODIFIED — collapse to single call |
| `tests/unit/scripts/cody/gate-comment-extraction.test.ts` | (append) | MODIFIED — add dead-code test |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/gate-comment-extraction.test.ts` (add a new `describe` block)

**Test 1 — Dead variable exposure**: Read `scripts/cody/cody.ts` source. Search for `_taskDefForSkip`. Assert it appears zero times in any expression other than its own assignment (i.e., it's never read). **Expected: FAILS** because the variable exists on line 435.

**Test 2 — Redundant calls**: Count occurrences of `readTask(taskDir)` between the "Validate task.json immediately after taskify" comment and the "GATE: Hard-stop check" comment. Assert count is 1. **Expected: FAILS** because there are 3.

#### Fix

1. Delete line 435 (`const _taskDefForSkip = readTask(taskDir)`) entirely.
2. Change line 420 from `readTask(taskDir)` (discarded) to `const taskDefAfterTaskify = readTask(taskDir)`.
3. Delete line 438 (`const taskDefAfterTaskify = readTask(taskDir)`) since the variable is now assigned at line 420.
4. Delete the empty comment on line 433 (`// Input quality skip: read skip_stages for later use in this loop`).

Net result: one `readTask` call, one variable, zero dead code.

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/gate-comment-extraction.test.ts
```

- Both tests FAIL before fix, PASS after.

#### Acceptance Criteria

- [ ] `_taskDefForSkip` does not exist anywhere in `cody.ts`
- [ ] Exactly one `readTask(taskDir)` call between taskify validation and the gate check
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] Existing tests in `tests/unit/scripts/cody/pipeline-utils.test.ts` still pass (no behavioral change)

---

### Step 3: Fix rerun mode mutation (Bug 4)

#### Root Cause

In `runRerunPipeline` (`cody.ts:972–974`), when no `spec.md` exists, the code falls back to the full pipeline:
```ts
input.mode = 'full'
await runFullPipeline(input, status, backend)
```

This mutates the shared `input` object. After `runFullPipeline` completes, control returns to the caller (`main` at line 238), which calls `formatStatusComment(input, latestStatus)` at line 254. Since `input.mode` is now `'full'` instead of `'rerun'`, the completion comment posted to the GitHub issue says "mode: full" — misleading for the user who triggered a rerun.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody.ts` | 973–974 | MODIFIED — spread instead of mutate |
| `tests/unit/scripts/cody/gate-comment-extraction.test.ts` | (append) | MODIFIED — add mutation test |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/gate-comment-extraction.test.ts` (add a new `describe` block)

**Test 1 — Mutation exposure**: Read the source of `runRerunPipeline` (lines 960–976 of `cody.ts`). Check whether `input.mode` is assigned with `=` (mutation) vs passed as a spread property. Assert the string `input.mode = ` does NOT appear in the function body. **Expected: FAILS** because `input.mode = 'full'` exists on line 973.

**Test 2 — Behavioral**: Create a mock `CodyInput` with `mode: 'rerun'`. Simulate the rerun-to-full fallback. Assert that after the function returns, the original input object still has `mode: 'rerun'`. **Expected: FAILS** because the current code mutates it to `'full'`.

#### Fix

Replace lines 973–974:
```ts
// Before (mutates shared input)
input.mode = 'full'
await runFullPipeline(input, status, backend)

// After (no mutation)
await runFullPipeline({ ...input, mode: 'full' }, status, backend)
```

One line change, delete the `input.mode = 'full'` line.

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/gate-comment-extraction.test.ts
```

- Test FAILS before fix (mutation detected), PASSES after.

#### Acceptance Criteria

- [ ] `input.mode = ` never appears as a direct assignment in `runRerunPipeline`
- [ ] The spread pattern `{ ...input, mode: 'full' }` is used instead
- [ ] `formatStatusComment` receives the original `input.mode` value after a rerun fallback
- [ ] `pnpm -s tsc --noEmit` passes

---

### Step 4: Remove redundant dynamic imports (Bug 5)

#### Root Cause

`postComment` is statically imported at `cody.ts:63`:
```ts
import { postComment, ... } from './cody-utils'
```

But at lines 450 and 771, the code uses dynamic imports:
```ts
const { postComment } = await import('./cody-utils')
```

These are redundant — `postComment` is already in scope. The dynamic imports add unnecessary `await` points, confuse readers about whether the function is conditionally loaded, and create a shadowed binding that hides the static import.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody.ts` | 450 | MODIFIED — delete line |
| `scripts/cody/cody.ts` | 771 | MODIFIED — delete line |
| `tests/unit/scripts/cody/gate-comment-extraction.test.ts` | (append) | MODIFIED — add import hygiene test |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/gate-comment-extraction.test.ts` (add a new `describe` block)

**Test 1 — Redundant import detection**: Read the source of `cody.ts`. Find all occurrences of `await import('./cody-utils')`. Assert the count is 0. **Expected: FAILS** because there are 2 occurrences (lines 450 and 771).

**Test 2 — Static import verification**: Assert that `postComment` appears in the static import block at the top of the file (lines 55–69). **Expected: PASSES** (already true, serves as a guard).

#### Fix

1. Delete line 450: `const { postComment } = await import('./cody-utils')`
2. Delete line 771: `const { postComment } = await import('./cody-utils')`

The existing static import at line 63 already provides `postComment` in scope.

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/gate-comment-extraction.test.ts
```

- Test 1 FAILS before fix (2 dynamic imports found), PASSES after (0 found).

#### Acceptance Criteria

- [ ] Zero occurrences of `await import('./cody-utils')` in `cody.ts`
- [ ] `postComment` is used directly from the static import at line 63
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] No runtime behavior change (postComment calls work identically)

---

### Step 5: Fix editComment shell injection (Bug 6)

#### Root Cause

`editComment` in `cody-utils.ts:284` constructs a shell command via string interpolation:
```ts
execSync(
  `gh api repos/${repo}/issues/comments/${commentId} -X PATCH --field body="@${tempFile}"`,
  { stdio: 'inherit' }
)
```

Both `repo` (from `process.env.GITHUB_REPOSITORY`) and `commentId` (from caller) are interpolated directly into the shell string. A malicious `GITHUB_REPOSITORY` value like `foo/bar; rm -rf /` or a crafted `commentId` would execute arbitrary commands.

The `tempFile` uses `Date.now()` so it's safe in practice, but the pattern is still wrong.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody-utils.ts` | 284–289 | MODIFIED — switch to `execFileSync` with arg array |
| `tests/unit/scripts/cody/cody-utils-security.test.ts` | (new) | NEW — shell injection reproduction tests |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/cody-utils-security.test.ts`

**Test 1 — editComment uses execSync with string interpolation**: Read the source of `editComment` function in `cody-utils.ts`. Assert that the function body does NOT contain a call to `execSync` with a template literal or string concatenation that includes `commentId` or `repo`. **Expected: FAILS** because line 284 uses `execSync` with interpolated `repo` and `commentId`.

**Test 2 — editComment uses execFileSync or spawn**: Assert that the function body contains `execFileSync` (or `spawnSync`) with an array argument. **Expected: FAILS** because it currently uses `execSync`.

#### Fix

Replace the `execSync` call at lines 284–289 with `execFileSync`:
```ts
import { execSync, execFileSync } from 'child_process'

// In editComment:
execFileSync('gh', [
  'api',
  `repos/${repo}/issues/comments/${commentId}`,
  '-X', 'PATCH',
  '--field', `body=@${tempFile}`,
], { stdio: 'inherit' })
```

This passes each argument as a separate array element, bypassing the shell entirely. No interpolation reaches a shell parser.

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/cody-utils-security.test.ts
```

- Tests FAIL before fix (execSync with interpolation detected), PASS after (execFileSync with array detected).

#### Acceptance Criteria

- [ ] `editComment` uses `execFileSync` (not `execSync`) for the `gh api` call
- [ ] `commentId` and `repo` are never interpolated into a shell command string
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] Existing `cody-utils.test.ts` tests still pass

---

### Step 6: Fix getLatestIssueComment shell injection (Bug 7)

#### Root Cause

`getLatestIssueComment` in `cody-utils.ts:307–308` interpolates `excludeAuthor` into a jq filter inside an `execSync` shell string:
```ts
execSync(
  `gh issue view ${issueNumber} --json comments --jq '[.comments[] | select(.author.login != "${exclude}" and (.body | startswith("/cody") | not))] | last | .body'`,
  { encoding: 'utf-8' }
)
```

Both `issueNumber` (a number, relatively safe) and `exclude` (a string from the caller, defaulting to `'github-actions[bot]'`) are interpolated. A crafted `excludeAuthor` value could escape the jq string and inject shell commands, e.g. `'"); system("rm -rf /") #'`.

#### Files to Touch

| File | Lines | Action |
|------|-------|--------|
| `scripts/cody/cody-utils.ts` | 307–310 | MODIFIED — switch to `execFileSync` with arg array |
| `tests/unit/scripts/cody/cody-utils-security.test.ts` | (append) | MODIFIED — add injection test for getLatestIssueComment |

#### Reproduction Test

**File**: `tests/unit/scripts/cody/cody-utils-security.test.ts` (append to existing)

**Test 1 — getLatestIssueComment uses execSync with string interpolation**: Read the source of `getLatestIssueComment` in `cody-utils.ts`. Assert that the function body does NOT contain `execSync` with a template literal that includes `${exclude}` or `${issueNumber}`. **Expected: FAILS** because line 308 interpolates both.

**Test 2 — getLatestIssueComment uses execFileSync**: Assert that the function body contains `execFileSync` with an array argument. **Expected: FAILS** because it currently uses `execSync`.

#### Fix

Replace the `execSync` call at lines 307–310 with `execFileSync`:
```ts
const output = execFileSync('gh', [
  'issue', 'view', String(issueNumber),
  '--json', 'comments',
  '--jq', `[.comments[] | select(.author.login != "${exclude}" and (.body | startswith("/cody") | not))] | last | .body`,
], { encoding: 'utf-8' })
```

By passing the jq expression as a single array element to `execFileSync`, the shell never parses it. The `exclude` value is still inside the jq string, but jq treats it as a literal string — no shell expansion occurs.

Additionally, validate `exclude` to only contain expected characters as a defense-in-depth measure:
```ts
const safeExclude = exclude.replace(/[^a-zA-Z0-9\[\]_\-]/g, '')
```

#### Verification

```bash
pnpm vitest run tests/unit/scripts/cody/cody-utils-security.test.ts
```

- Tests FAIL before fix, PASS after.

#### Acceptance Criteria

- [ ] `getLatestIssueComment` uses `execFileSync` (not `execSync`) for the `gh issue view` call
- [ ] `excludeAuthor` is sanitized before use in the jq filter
- [ ] `issueNumber` is not interpolated into a shell command string
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] Existing `cody-utils.test.ts` tests still pass

---

## Execution Order & Dependencies

```
Step 1 (Bug 1+2) ─── no deps, CRITICAL, do first
Step 2 (Bug 3)   ─── no deps, touches same file region as Step 1
Step 3 (Bug 4)   ─── no deps
Step 4 (Bug 5)   ─── depends on Step 1 (Step 1 already replaces the dynamic imports at those lines)
Step 5 (Bug 6)   ─── no deps, different file
Step 6 (Bug 7)   ─── no deps, different file, same test file as Step 5
```

Steps 1–4 touch `scripts/cody/cody.ts`. Steps 5–6 touch `scripts/cody/cody-utils.ts`. Apply Step 1 first since it overlaps with Step 4 (both modify the gate comment blocks that contain the dynamic imports).

## Test Files Summary

| Test File | Covers |
|-----------|--------|
| `tests/unit/scripts/cody/gate-comment-extraction.test.ts` (NEW) | Steps 1, 2, 3, 4 |
| `tests/unit/scripts/cody/cody-utils-security.test.ts` (NEW) | Steps 5, 6 |

## Validation Checklist (run after all steps)

```bash
pnpm -s tsc --noEmit                                           # TypeScript compiles
pnpm vitest run tests/unit/scripts/cody/gate-comment-extraction.test.ts  # Steps 1-4
pnpm vitest run tests/unit/scripts/cody/cody-utils-security.test.ts      # Steps 5-6
pnpm vitest run tests/unit/scripts/cody/                        # All cody tests pass
pnpm -s lint                                                    # No lint errors
```
