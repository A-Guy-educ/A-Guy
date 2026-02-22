# Plan: Fix & Enhance Cody Supervisor Self-Correction

**Task ID**: 260222-supervisor-self-correction
**Issue**: #504 (trigger: gap.md validation failure killed pipeline with no recovery)
**Task Type**: implement_feature + fix_bug (hybrid)
**Risk Level**: medium

## Background

The Cody pipeline has a supervisor system (`scripts/supervisor/`, `.github/workflows/supervisor.yml`) that is supposed to monitor failures, analyze them with an LLM, and trigger retries with refined feedback. **It has never worked** due to three breaks in the trigger chain:

1. `parse-safety.sh` rejects `github-actions[bot]` comments (the failure comment author)
2. The failure comment doesn't match `^/cody` pattern required by safety filter
3. Even if the supervisor ran, its `/cody rerun` comment would also be from a bot and get blocked

In addition, the pipeline itself has no self-correction for content validation failures — validators throw fatally without retry.

## Rerun Context

N/A — first run.

---

## Step 1: Fix Gap Validator/Template Mismatch (Quick Fix)

**Files to Touch**:
- `scripts/cody/content-validators.ts` (MODIFIED — line 199)
- `.opencode/agents/gap.md` (MODIFIED — lines 83-84, 100)

**Behavior**:
- Broaden `validateGapReport()` regex from `/##\s*Gaps? Found/i` to `/##\s*Gaps?\s*(Found|Identified)/i`
- Align the gap agent prompt template heading: change `## Gaps Identified` to `## Gaps Found` for consistency

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/content-validators.test.ts` — test that `validateGapReport()` accepts content with `## Gaps Identified` heading (currently returns false, should return true)
2. `tests/unit/scripts/cody/content-validators.test.ts` — test that `validateGapReport()` still accepts `## Gaps Found`, `## Changes Made`, and "No gaps identified"

**Acceptance Criteria**:
- [ ] `validateGapReport("## Gaps Identified\n\nNone.")` returns `true`
- [ ] `validateGapReport("## Gaps Found\n\nNone.")` returns `true` (existing behavior preserved)
- [ ] `validateGapReport("No gaps identified")` returns `true` (existing behavior preserved)
- [ ] Gap agent template uses `## Gaps Found` heading

---

## Step 2: Add Validation-in-Retry-Loop to Agent Runner

**Files to Touch**:
- `scripts/cody/agent-runner.ts` (MODIFIED — lines 48-67, 90-272)
- `scripts/cody/stage-prompts.ts` (MODIFIED — line 158)

**Behavior**:

### agent-runner.ts changes:
- Add `ValidationResult` type: `{ valid: boolean; error?: string }`
- Add `validateOutput?: (outputFile: string) => ValidationResult` to `AgentRunnerOptions`
- Move `buildStagePrompt()` call from line 120 (once) to inside `attemptWithRetry()` (per attempt)
- Add `validationFeedback` state variable (starts `undefined`, set on validation failure)
- After file detection + stability check (current line 234 `finish({ succeeded: true })`):
  - If `validateOutput` is provided, call it
  - If `{ valid: false, error }`: delete output file, set `validationFeedback = error`, increment retries, retry (or fail if retries exhausted)
  - If `{ valid: true }` or no validator: proceed as normal (existing behavior)
- Pass `validationFeedback` to `buildStagePrompt()` on retry
- Add `validationErrors?: string[]` to `AgentRunResult` for observability

### stage-prompts.ts changes:
- Add optional `feedback?: string` param to `buildStagePrompt(input, stage, feedback?)`
- When `feedback` is provided, append to prompt:
  ```
  VALIDATION ERROR from previous attempt:
  <feedback text>
  Fix this issue in your output. Ensure your output follows the exact required format.
  ```

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/agent-runner.test.ts` — test that when `validateOutput` returns `{ valid: false, error: "missing section" }`, the output file is deleted and the agent is retried
2. `tests/unit/scripts/cody/stage-prompts.test.ts` — test that `buildStagePrompt(input, 'gap', 'missing ## Gaps Found')` includes "VALIDATION ERROR" section in returned prompt string

**Acceptance Criteria**:
- [ ] When `validateOutput` returns invalid, the output file is deleted before retry
- [ ] The validation error message appears in the prompt for the next attempt
- [ ] If validation fails on all retries, `AgentRunResult.succeeded` is `false`
- [ ] If no `validateOutput` is provided, behavior is unchanged (backward compatible)
- [ ] `AgentRunResult.validationErrors` contains the error strings from failed validations

---

## Step 3: Wire Content Validators as Callbacks in cody.ts

**Files to Touch**:
- `scripts/cody/cody.ts` (MODIFIED — lines 224-267 spec pipeline, lines 347-390 validation blocks)
- `scripts/cody/content-validators.ts` (MODIFIED — export `ValidatorFn` type)

**Behavior**:
- Create a `getStageValidator(stage: string)` function that returns the appropriate `validateOutput` callback for each stage:
  - `spec` → validates `## Requirements` or `## Acceptance Criteria`
  - `gap` → validates `## Gaps Found`, `## Changes Made`, or "No gaps identified"; also re-validates spec.md wasn't corrupted
  - `plan-gap` → validates gap report format + plan.md still exists
  - `build` → validates `## Changes` or `## Files` section
  - Other stages → no validator (returns `undefined`)
- Pass the validator to `runAgentWithFileWatch()` via `options.validateOutput`
- **Remove** the post-run validation blocks in `cody.ts` (lines 347-390 for spec/gap) since the retry loop now handles them
- **Remove** the throw in `handleBuildValidation` and `handlePlanGapValidation` stage hooks — they're now handled by the validator callback

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/cody.test.ts` — test that `getStageValidator('gap')` returns a function that rejects content missing required headings
2. `tests/unit/scripts/cody/cody.test.ts` — test that `getStageValidator('spec')` returns a function that rejects content missing `## Requirements`

**Acceptance Criteria**:
- [ ] Spec, gap, plan-gap, and build validators are passed as callbacks to `runAgentWithFileWatch`
- [ ] Post-run validation blocks (lines 347-390) are removed from `cody.ts`
- [ ] If a validator rejects, the agent retries with feedback (up to 2 retries via agent-runner)
- [ ] If validation passes on retry, the pipeline continues normally
- [ ] Existing behavior preserved for stages without validators

---

## Step 4: Create Supervisor Safety Script

**Files to Touch**:
- `scripts/cody/parse-safety-supervisor.sh` (NEW)

**Behavior**:
- Accept comments from `github-actions[bot]` only (inverse of the main safety filter)
- Match pattern: `^❌ Pipeline failed` (Cody failure comments)
- Reject all other comments (human comments, other bots, non-failure comments)
- Output `valid=true/false` via `$GITHUB_OUTPUT`

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/parse-safety-supervisor.test.sh` — test that `AUTHOR=github-actions[bot] COMMENT_BODY="❌ Pipeline failed for ..."` outputs `valid=true`
2. `tests/unit/scripts/cody/parse-safety-supervisor.test.sh` — test that `AUTHOR=aguyaharonyair COMMENT_BODY="/cody"` outputs `valid=false`

**Acceptance Criteria**:
- [ ] Bot failure comments pass validation
- [ ] Human comments are rejected
- [ ] Non-failure bot comments are rejected
- [ ] Output format matches existing `parse-safety.sh` contract (`valid` output)

---

## Step 5: Fix Supervisor Workflow Trigger Chain

**Files to Touch**:
- `.github/workflows/supervisor.yml` (MODIFIED — lines 29-35, 15-17)

**Behavior**:
- Replace `parse-safety.sh` reference with `parse-safety-supervisor.sh` in the validate job
- Add `actions: write` to permissions (needed for `gh workflow run` in Step 6)
- Ensure task ID extraction regex handles the failure comment format: `` ❌ Pipeline failed for `260222-auto-75`: ... ``

**Tests** (FAIL before, PASS after):
1. Manual verification: create a test issue, post a fake failure comment, confirm supervisor workflow triggers and the validate job outputs `valid=true`
2. `tests/unit/scripts/supervisor/retry-tracker.test.ts` — test that `extractTaskIdFromComment('❌ Pipeline failed for \`260222-auto-75\`: Gap report...')` returns `'260222-auto-75'`

**Acceptance Criteria**:
- [ ] Supervisor workflow triggers on `❌ Pipeline failed` comments from `github-actions[bot]`
- [ ] Supervisor workflow does NOT trigger on `/cody` commands from humans
- [ ] Task ID is correctly extracted from failure comments
- [ ] Workflow has `actions: write` permission

---

## Step 6: Supervisor Triggers Rerun via workflow_dispatch (Not Comments)

**Files to Touch**:
- `scripts/supervisor/supervisor.ts` (MODIFIED — lines 193-206)
- `scripts/supervisor/retry-tracker.ts` (MODIFIED — lines 84-111)
- `.github/workflows/supervisor.yml` (MODIFIED — env section)

**Behavior**:
- After analysis, instead of only posting a comment with `/cody rerun ...`, the supervisor calls:
  ```
  gh workflow run cody.yml \
    -f task_id=<taskId> \
    -f mode=rerun \
    -f feedback="<refinedFeedback>" \
    -f from_stage=<failedStage>
  ```
- Still post the analysis comment for visibility, but change the `/cody rerun` line to informational:
  ```
  > ℹ️ Auto-triggering rerun via workflow_dispatch
  ```
- Pass `GH_TOKEN` as a secret (not `github.token`) since `github.token` cannot trigger workflows. Add `REPO` env var for `gh workflow run --repo`.
- Add `ANTHROPIC_API_KEY` secret to supervisor env (in case the cody rerun needs it)

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/supervisor/supervisor.test.ts` — test that `runSupervisor()` calls `execSync` with `gh workflow run cody.yml` when retries are available
2. `tests/unit/scripts/supervisor/retry-tracker.test.ts` — test that `formatAnalysisComment()` includes "Auto-triggering rerun" text instead of bare `/cody rerun`

**Acceptance Criteria**:
- [ ] Supervisor triggers cody.yml via `gh workflow run` (not comment)
- [ ] Analysis comment is posted for human visibility
- [ ] The rerun receives the correct `task_id`, `mode=rerun`, `feedback`, and `from_stage`
- [ ] Bot-triggers-bot cycle is broken (no comment-based trigger needed)

---

## Step 7: Add Deterministic Error Classification

**Files to Touch**:
- `scripts/supervisor/failure-analyzer.ts` (MODIFIED — add classifyError, getDeterministicFeedback)

**Behavior**:

Add `classifyError()` function that pattern-matches known error strings:

| Error Pattern | Category | Deterministic Feedback |
|---|---|---|
| `Gap report is invalid` | `FORMAT_ERROR` | "Ensure gap.md contains ## Gaps Found, ## Changes Made, or 'No gaps identified'" |
| `Spec is missing ## Requirements` | `FORMAT_ERROR` | "Ensure spec.md contains ## Requirements or ## Acceptance Criteria" |
| `does not compile` / `tsc` | `COMPILATION_ERROR` | "Fix TypeScript compilation errors. Run `tsc --noEmit` to see errors." |
| `Build produced code that does not compile` | `COMPILATION_ERROR` | (same) |
| `timed out` | `TIMEOUT` | `null` (no retry — would timeout again) |
| `without producing output file` | `CONTENT_MISSING` | "The agent did not produce the required output file. Ensure you write to the specified path." |
| `ENOENT` / `Command not found` | `INFRASTRUCTURE` | `null` (no retry — infra issue) |
| Everything else | `UNKNOWN` | Falls through to MiniMax LLM analysis |

Update `analyzeFailure()`:
1. Call `classifyError()` first
2. If `TIMEOUT` or `INFRASTRUCTURE`: return analysis with `refinedFeedback = null` (supervisor should not retry)
3. If deterministic feedback available: return it without calling MiniMax
4. If `UNKNOWN`: call MiniMax LLM as current behavior

Update `supervisor.ts`:
- If `refinedFeedback` is `null`, skip the `gh workflow run` and post "No retry possible — manual intervention required"

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/supervisor/failure-analyzer.test.ts` — test `classifyError('gap', 'Gap report is invalid')` returns `'FORMAT_ERROR'`
2. `tests/unit/scripts/supervisor/failure-analyzer.test.ts` — test `analyzeFailure({ errorMessage: 'Gap report is invalid', ... })` returns deterministic feedback without calling MiniMax API

**Acceptance Criteria**:
- [ ] Known error patterns are classified deterministically (no LLM call)
- [ ] `TIMEOUT` and `INFRASTRUCTURE` errors do not trigger retries
- [ ] `FORMAT_ERROR` and `COMPILATION_ERROR` return actionable feedback
- [ ] `UNKNOWN` errors still use MiniMax LLM analysis
- [ ] No MiniMax API call for deterministic categories (cost/latency savings)

---

## Step 8: Extend Autofix to Post-Build TSC Failures

**Files to Touch**:
- `scripts/cody/stage-hooks.ts` (MODIFIED — lines 95-109)
- `scripts/cody/cody.ts` (MODIFIED — lines 663-666)

**Behavior**:
- Change `handlePostBuildTsc()` to return `{ failed: boolean; output?: string }` instead of throwing
- In `cody.ts`, when `handlePostBuildTsc()` returns `{ failed: true }`:
  1. Write a `verify.md`-like file with the tsc errors (so autofix agent can read them)
  2. Run autofix agent (same pattern as the existing verify autofix loop)
  3. Re-run tsc
  4. If fixed: continue pipeline
  5. If still failing after 2 attempts: throw (pipeline fails → supervisor takes over)

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/stage-hooks.test.ts` — test that `handlePostBuildTsc()` returns `{ failed: true, output: '...' }` when tsc fails (instead of throwing)
2. `tests/integration/cody/post-build-autofix.test.ts` — test that a tsc failure after build triggers autofix agent before the pipeline fails

**Acceptance Criteria**:
- [ ] `handlePostBuildTsc()` returns result object, does not throw
- [ ] TSC failure after build routes through autofix agent
- [ ] Up to 2 autofix attempts for post-build tsc failures
- [ ] If autofix succeeds, pipeline continues to commit stage
- [ ] If autofix exhausted, pipeline fails with clear error message

---

## Step 9: Move Auditor After Verify

**Files to Touch**:
- `scripts/cody/pipeline-utils.ts` (MODIFIED — lines 392-399)

**Behavior**:
- Change `IMPL_PIPELINE` from:
  ```typescript
  { parallel: ['verify', 'auditor'] }
  ```
  to sequential:
  ```typescript
  'verify',
  'auditor',
  ```
- This ensures auditor has `verify.md` available when it runs

**Tests** (FAIL before, PASS after):
1. `tests/unit/scripts/cody/pipeline-utils.test.ts` — test that `IMPL_PIPELINE` contains `'verify'` followed by `'auditor'` as sequential stages (not in a parallel group)

**Acceptance Criteria**:
- [ ] `IMPL_PIPELINE` has verify and auditor as sequential stages
- [ ] Auditor agent has access to `verify.md` when it runs
- [ ] No parallel group containing `['verify', 'auditor']` exists

---

## End-to-End Flow After All Steps

```
User: /cody
  → cody.yml → Cody pipeline runs

  Stage produces bad output (e.g., gap.md wrong format):
  ├── validateOutput callback catches it (Step 2-3)
  │   → Retry with feedback in prompt (up to 2 retries)
  │   → Fixed on retry → pipeline continues ✅
  │   → Exhausted retries → pipeline fails ↓

  Stage produces code that doesn't compile (post-build tsc):
  ├── handlePostBuildTsc returns failure (Step 8)
  │   → Route to autofix agent (up to 2 attempts)
  │   → Fixed → pipeline continues ✅
  │   → Exhausted → pipeline fails ↓

  Pipeline fails → posts "❌ Pipeline failed for `task-id`: ..."
    → supervisor.yml triggers (Step 4-5)
    → parse-safety-supervisor.sh validates (bot + failure pattern)
    → supervisor.ts runs:
        → classifyError() — deterministic first (Step 7)
        → getDeterministicFeedback() or MiniMax LLM fallback
        → countRetries() — max 3 supervisor retries
        → If retries left:
        │   → Post analysis comment (informational)
        │   → gh workflow run cody.yml -f mode=rerun (Step 6)
        │   → Cody reruns with refined feedback
        └── If exhausted:
            → Post "Max retries exhausted, manual intervention needed"
```

### For Issue #504 Specifically

With these changes, the flow would be:
1. Gap agent (MiniMax) writes `gap.md` with wrong headings
2. **validateOutput callback** catches it → deletes file → prompt now includes "VALIDATION ERROR: Must contain ## Gaps Found..."
3. Gap agent retries → includes correct heading → validation passes
4. Pipeline continues → PR opened ✅

The supervisor would never even need to fire.

---

## Implementation Order

1. **Step 1** (quick fix) — immediate value, can ship independently
2. **Step 2** (validation-in-retry-loop) — core mechanism
3. **Step 3** (wire validators) — connects Step 2 to the pipeline
4. **Step 4-6** (supervisor trigger chain) — fixes the external supervisor
5. **Step 7** (deterministic classification) — makes supervisor smarter
6. **Step 8** (autofix for post-build tsc) — extends autofix coverage
7. **Step 9** (auditor sequencing) — minor improvement, low risk

Steps 1-3 can be one PR. Steps 4-7 can be another PR. Steps 8-9 can be a third PR.
