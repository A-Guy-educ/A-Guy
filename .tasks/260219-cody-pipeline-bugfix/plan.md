# Plan: Cody Pipeline Bugfix — "No Code in PR"

## Root Cause Analysis

After reviewing the Cody pipeline code (`scripts/cody/`) and three failing task runs (`260218-55`, `260219-my-task`, `260219-auto-34`), I identified **two compounding bugs**:

### Bug 1 (PRIMARY): `taskify` agent writes inconsistent `pipeline` value in `task.json`
The LLM-powered `taskify` stage writes valid enum values for `task_type` (e.g., `"fix_bug"`) but picks the **wrong** `pipeline` value. In the latest run:

```json
{
  "task_type": "fix_bug",       // ✅ valid
  "pipeline": "spec_only",      // ❌ WRONG — fix_bug requires "spec_execute_verify"
  "confidence": 1.0,            // ✅ valid
  ...
}
```

The `PIPELINE_MAP` in `pipeline-utils.ts:62-70` enforces that `fix_bug → spec_execute_verify`, so this task.json fails the consistency check at line 136-143.

### Bug 2 (FATAL): `readTask()` calls `process.exit(1)` on validation failure
When `validateTask()` finds the pipeline inconsistency, `readTask()` (line 176) calls `process.exit(1)`. This:
- **Kills the process silently** — no error thrown, no try/catch, no status update
- **Bypasses all error handling** in `main()`, `runImplPipeline()`, and `runFullPipeline()`
- **Leaves status.json in "running" state** forever (never updated to "failed")
- **Leaves the PR with only spec files** because spec pipeline already committed them

### Flow (what happens today)
```
1. /cody full → runFullPipeline()
2. runSpecPipeline():
   a. taskify → writes task.json with fix_bug + spec_only (inconsistent!) ← BUG 1
   b. spec → creates spec.md ✅
   c. clarify → creates questions.md/clarified.md ✅
   d. commits all spec files to branch ✅
3. runImplPipeline():
   a. readTask() → validateTask() → "Pipeline inconsistency" error
   b. process.exit(1) ← BUG 2 — silent death, no error handling
4. Status stuck at "running". PR has only spec files. User sees "success" comment from spec phase.
```

### Why the user sees "success"
The spec pipeline completes successfully and commits. The `commitTaskFilesCI()` pushes to the branch. If a PR was already created (or auto-created by a previous stage), it shows only spec files. The impl pipeline dies silently before it can produce any code.

---

## Assumptions

- The `pipeline` field in task.json is **derivable** from `task_type` — there's a 1:1 mapping in `PIPELINE_MAP`. The agent doesn't need to guess it.
- The `readTask()` `process.exit(1)` pattern was a development-time convenience that should be replaced with proper error handling.
- Tests will be unit tests (pipeline-utils validation) and integration tests (pipeline flow).

---

## Step 1: Make `readTask()` throw instead of `process.exit(1)` (10 min)

### Files
- `scripts/cody/pipeline-utils.ts:148-182` (MODIFIED)

### Exact Change
Replace the two `process.exit(1)` calls in `readTask()` with `throw new Error(...)`:

**JSON parse failure (line 161-171):**
```
// Before: process.exit(1)
// After: throw new Error(`task.json is not valid JSON: ${preview}`)
```

**Validation failure (line 176-179):**
```
// Before: process.exit(1)  
// After: throw new Error(`task.json validation failed:\n${result.errors.map(e => `  • ${e}`).join('\n')}`)
```

### Tests
**File**: `tests/unit/cody/pipeline-utils.test.ts` (NEW)

1. **Test: `readTask` throws on invalid JSON** — Create a temp dir with task.json containing `"not json {{"`. Call `readTask(tempDir)`. Expect it to throw with message matching `/not valid JSON/`.
2. **Test: `readTask` throws on schema violation** — Create task.json with `{"task_type": "fix_bug", "pipeline": "spec_only", ...}` (inconsistent). Call `readTask(tempDir)`. Expect it to throw with message matching `/Pipeline inconsistency/`.

### Acceptance Criteria
- [ ] `readTask()` throws `Error` (not `process.exit`) on invalid JSON
- [ ] `readTask()` throws `Error` (not `process.exit`) on validation failure
- [ ] Error messages include the specific validation errors
- [ ] `grep -r "process.exit" scripts/cody/pipeline-utils.ts` returns 0 matches

---

## Step 2: Auto-derive `pipeline` from `task_type` in `normalizeTask()` (15 min)

### Files
- `scripts/cody/pipeline-utils.ts` (MODIFIED — add `normalizeTask()`, export `PIPELINE_MAP`)

### Exact Behavior
Add a new function `normalizeTask(raw: Record<string, unknown>): Record<string, unknown>` that:

1. **Always overrides `pipeline`** from `task_type` using `PIPELINE_MAP` — the agent should never choose this value; it's deterministic.
2. **Wraps `scope` in array** if it's a string: `"foo"` → `["foo"]`
3. **Converts string confidence** to number: `"high"` → `0.9`, `"medium"` → `0.7`, `"low"` → `0.5`
4. **Maps common task_type aliases**: `"feature"` → `"implement_feature"`, `"bug"/"bugfix"` → `"fix_bug"`
5. **Defaults missing arrays**: `missing_inputs` → `[]`, `assumptions` → `[]`

Call `normalizeTask()` inside `readTask()` **before** `validateTask()`.

The key insight: **`pipeline` should never be agent-determined**. It's a function of `task_type`. The normalization ensures this is always correct regardless of what the LLM writes.

### Tests
**File**: `tests/unit/cody/pipeline-utils.test.ts` (MODIFIED — add tests)

1. **Test: `normalizeTask` fixes pipeline inconsistency** — Input: `{task_type: "fix_bug", pipeline: "spec_only"}`. Output: `pipeline` corrected to `"spec_execute_verify"`.
2. **Test: `normalizeTask` maps common aliases** — Input: `{task_type: "feature", pipeline: "spec", confidence: "high", scope: "src/foo"}`. Output: `{task_type: "implement_feature", pipeline: "spec_execute_verify", confidence: 0.9, scope: ["src/foo"]}`.
3. **Test: `normalizeTask` preserves valid values** — Input: fully valid task.json. Output: identical.
4. **Test: `readTask` succeeds after normalization** — Create task.json with `{task_type: "fix_bug", pipeline: "spec_only", ...}` (the exact failing case). Call `readTask()`. Expect it to **succeed** and return `pipeline: "spec_execute_verify"`.

### Acceptance Criteria
- [ ] `normalizeTask()` always derives `pipeline` from `task_type` via `PIPELINE_MAP`
- [ ] The exact `260219-auto-34` task.json (fix_bug + spec_only) would now pass validation
- [ ] The exact `260218-55` task.json (feature + spec + "high") would now pass validation
- [ ] Valid task.json passes through unchanged (except pipeline is re-derived — same value)

---

## Step 3: Handle `readTask()` errors gracefully in `runImplPipeline()` (10 min)

### Files
- `scripts/cody/cody.ts:435-439` (MODIFIED)

### Exact Change
Wrap the `readTask()` call in `runImplPipeline()` (line 436) in try/catch:

```typescript
let taskDef: TaskDefinition | null
try {
  taskDef = readTask(taskDir)
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`\n❌ Failed to read task definition: ${msg}`)
  throw new Error(`Invalid task.json: ${msg}`)
}
```

Also add a guard after line 439: if `taskDef.pipeline === 'spec_only'`, log a message and return early (don't attempt impl stages for spec-only tasks):

```typescript
if (taskDef.pipeline === 'spec_only') {
  console.log('Task pipeline is spec_only — skipping implementation stages.')
  return
}
```

### Tests
**File**: `tests/unit/cody/cody-impl-pipeline.test.ts` (NEW)

1. **Test: `runImplPipeline` throws descriptive error on invalid task.json** — Create a task dir with invalid task.json (e.g., missing required fields that normalization can't fix). Mock backend. Call `runImplPipeline()`. Expect thrown error with descriptive message (not process.exit).
2. **Test: `runImplPipeline` skips impl for spec_only pipeline** — Create a task dir with valid task.json where `task_type: "spec_only"`. Call `runImplPipeline()`. Expect it to return without running any stages.

### Acceptance Criteria
- [ ] Invalid task.json produces a thrown Error with clear message
- [ ] Error propagates to `main()` which updates status to "failed" and posts GitHub comment
- [ ] `spec_only` tasks return early from impl pipeline
- [ ] No `process.exit` calls remain in the error path

---

## Step 4: Improve `taskify` prompt — remove `pipeline` field from agent output (10 min)

### Files
- `scripts/cody/stage-prompts.ts:45-58` (MODIFIED — `taskify` instruction)

### Exact Change
Since `pipeline` is now **always auto-derived** from `task_type` in `normalizeTask()`, the agent doesn't need to output it at all. Update the taskify prompt to:

1. **Remove `pipeline` from the required fields list** — don't ask the agent to write it
2. **Add an explicit JSON template** with example values
3. **Add "WRONG → CORRECT" examples** for `task_type` to reduce hallucination
4. Keep listing the valid `task_type` values explicitly

New prompt excerpt:
```
Create a task.json. Write valid JSON only — no explanations, no code fences.

Required fields:
- task_type: One of: spec_only, implement_feature, fix_bug, refactor, docs, ops, research
  Examples: "Add dark mode" → implement_feature, "Fix login crash" → fix_bug
  WRONG: "feature", "bug", "bugfix" — use the exact values above
- risk_level: One of: low, medium, high
- confidence: Number 0.0-1.0 (e.g., 0.85)
- primary_domain: One of: backend, frontend, infra, data, llm, devops, product
- scope: Array of file paths affected (e.g., ["src/app/page.tsx"])
- missing_inputs: Array of {field, question} or empty []
- assumptions: Array of strings

NOTE: Do NOT include a "pipeline" field — it is auto-derived from task_type.

Example:
{
  "task_type": "fix_bug",
  "risk_level": "low",
  "confidence": 0.9,
  "primary_domain": "frontend",
  "scope": ["src/components/Login.tsx"],
  "missing_inputs": [],
  "assumptions": ["The bug is in the login form validation"]
}
```

### Tests
**File**: `tests/unit/cody/stage-prompts.test.ts` (NEW)

1. **Test: taskify prompt lists all valid task_type values** — Call `buildStagePrompt({taskId: '260219-test'} as CodyInput, 'taskify')`. Verify returned string contains `implement_feature`, `fix_bug`, `refactor`, `spec_only`, `docs`, `ops`, `research`.
2. **Test: taskify prompt does NOT ask for pipeline field** — Verify the prompt does NOT contain `"pipeline":` in the required fields section (it may mention "auto-derived").
3. **Test: taskify prompt includes JSON example** — Verify the prompt contains a valid JSON example.

### Acceptance Criteria
- [ ] Prompt no longer asks agent to write `pipeline` field
- [ ] Prompt includes explicit JSON example
- [ ] Prompt lists all 7 valid `task_type` values
- [ ] `normalizeTask()` handles missing `pipeline` field (derives from `task_type`)

---

## Step 5: Add post-taskify validation in spec pipeline (15 min)

### Files
- `scripts/cody/cody.ts:303-347` (MODIFIED — inside `runSpecPipeline`, after taskify stage completes)

### Exact Change
After the `taskify` stage loop iteration succeeds (the file watcher detected task.json), add an immediate validation step:

```typescript
// After taskify completes, validate task.json immediately
if (stage === 'taskify' && fs.existsSync(outputFile)) {
  try {
    readTask(taskDir)  // This now normalizes + validates
    console.log('✓ task.json validated successfully')
  } catch (error) {
    // Delete invalid file so retry can recreate it
    fs.unlinkSync(outputFile)
    updateStageStatus(input.taskId, stage, 'failed', { 
      error: error instanceof Error ? error.message : 'Invalid task.json'
    })
    throw new Error(`Taskify produced invalid task.json: ${error instanceof Error ? error.message : error}`)
  }
}
```

This catches problems **early** — at spec time, not impl time. If normalization can't fix the task.json (e.g., completely garbled), the pipeline fails fast with a clear message.

### Tests
**File**: `tests/unit/cody/spec-pipeline.test.ts` (NEW)

1. **Test: spec pipeline validates task.json after taskify** — Mock agent runner to produce task.json with `{task_type: "fix_bug", pipeline: "spec_only"}`. Run spec pipeline. Verify it succeeds (normalization fixes it).
2. **Test: spec pipeline fails fast on unfixable task.json** — Mock agent runner to produce task.json with `{task_type: "banana"}`. Run spec pipeline. Verify it throws with "invalid task.json" message.

### Acceptance Criteria
- [ ] Valid-but-inconsistent task.json is auto-fixed and pipeline continues
- [ ] Completely invalid task.json fails fast at taskify stage (not at impl time)
- [ ] Error message is posted to GitHub issue

---

## Step 6: End-to-end dry-run regression test (15 min)

### Files
- `tests/unit/cody/full-pipeline-dryrun.test.ts` (NEW)

### Behavior
Test the complete `full` pipeline in dry-run mode, which exercises the real code paths but skips agent execution:

1. **Happy path**: Create temp task dir with valid task.md. Run `full` pipeline in dry-run. Verify all output files exist and status is `completed`.
2. **The exact bug scenario**: Create temp task dir, write task.json with `{task_type: "fix_bug", pipeline: "spec_only", ...}` (the exact failing values from `260219-auto-34`). Call `readTask()`. Verify it **succeeds** with `pipeline: "spec_execute_verify"`.
3. **Silent death prevention**: Verify `pipeline-utils.ts` contains zero `process.exit` calls.

### Tests

1. **Test: readTask normalizes the exact 260219-auto-34 task.json** — Use the literal JSON from the user's report. Expect `readTask()` returns `{pipeline: "spec_execute_verify"}`.
2. **Test: readTask normalizes the exact 260218-55 task.json** — Use the literal JSON from the earlier bug. Expect `readTask()` returns successfully with corrected values.
3. **Test: no process.exit in pipeline-utils.ts** — Read the file contents and assert no `process.exit` calls exist.

### Acceptance Criteria
- [ ] Both real-world failing task.json inputs now parse successfully
- [ ] Zero `process.exit` calls in `pipeline-utils.ts`
- [ ] Full pipeline dry-run completes with all stages

---

## Files Summary

| File | Action | Description |
|---|---|---|
| `scripts/cody/pipeline-utils.ts` | MODIFY | Replace `process.exit(1)` with `throw`, add `normalizeTask()`, export `PIPELINE_MAP` |
| `scripts/cody/cody.ts` | MODIFY | Handle readTask errors in runImplPipeline, add post-taskify validation in spec pipeline |
| `scripts/cody/stage-prompts.ts` | MODIFY | Remove `pipeline` from taskify prompt, add JSON template |
| `tests/unit/cody/pipeline-utils.test.ts` | NEW | Tests for readTask, normalizeTask, validateTask |
| `tests/unit/cody/stage-prompts.test.ts` | NEW | Tests for prompt content |
| `tests/unit/cody/cody-impl-pipeline.test.ts` | NEW | Tests for impl pipeline error handling |
| `tests/unit/cody/spec-pipeline.test.ts` | NEW | Tests for post-taskify validation |
| `tests/unit/cody/full-pipeline-dryrun.test.ts` | NEW | Regression tests with real-world failing inputs |

## Verification Commands

```bash
# Run all new tests
pnpm vitest run tests/unit/cody/

# TypeScript check
pnpm -s tsc --noEmit

# Lint check  
pnpm -s lint

# Verify no process.exit in pipeline-utils
grep -c "process.exit" scripts/cody/pipeline-utils.ts  # should be 0

# Manual smoke test (dry-run, no agent needed)
pnpm cody:run --task-id=260219-test --mode=full --dry-run --local
```

## Risk Assessment
- **Risk**: Low — changes are in pipeline tooling only, not production application code
- **Blast radius**: Only affects Cody pipeline execution
- **Rollback**: Revert the commit; no data migrations or schema changes
