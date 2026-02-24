# Plan: Cody Pipeline State Machine Rewrite

**Task ID**: 260223-cody-state-machine-rewrite
**Task Type**: refactor
**Risk Level**: high
**Created**: 2026-02-23
**Updated**: 2026-02-24 (Round 2 gap analysis incorporated)

---

## Round 2 Gap Analysis — Summary of Changes

Comprehensive source-level audit of all 14 TS files + 5 shell scripts identified ~75 gaps. After triage, the following **material changes** are incorporated into this plan:

### Critical Fixes (behavior changes)

| # | Gap | Impact | Fix in Plan |
|---|-----|--------|-------------|
| G17 | `handleClarification` runs AFTER the spec stage loop in cody.ts, NOT as a post-action on the clarify stage | Wrong placement: if clarify isn't in pipeline order, auto-create of clarified.md never happens | Moved to entry.ts post-spec-loop logic. NOT a post-action on clarify stage. Skip-condition `skipIfClarifyDisabled` handles the auto-create path. |
| G20 | `ensureFeatureBranch` is called PRE-build (cody.ts L735), NOT POST-architect | Plan had it as architect post-action which runs too early (before gate approval) | Moved to build stage's pre-execute hook (inside `runSingleStage` before handler runs), not a post-action |
| G37 | Rerun must DELETE output files from rerun point onwards, not just reset status | Status reset alone leaves stale .md files that would cause skip-if-exists | Added file deletion to `resetFromStage` or entry.ts rerun setup |
| G42 | `controlMode` is resolved dynamically per gate check, not stored statically | Each gate re-reads task.json and re-calls `resolveControlMode` | Gate handler resolves controlMode at execution time, not cached in ctx |

### Medium Fixes (missing behavior)

| # | Gap | Fix in Plan |
|---|-----|-------------|
| G2 | Signal handler may find no status.json on early crash | Guard with try/catch + `loadState` null check |
| G3 | `ensureTaskMarkerComment` runs for ALL modes before pipeline | Moved to entry.ts before mode switch |
| G6 | `process.exit(1)` on failure is critical for CI exit code | Added to entry.ts catch block |
| G8 | `--file` flag has priority over issue body, empty check, `# Task\n\n` wrapping | Documented in entry.ts spec-mode setup |
| G9 | Issue title included in task.md via `## Issue Title` section | Documented in entry.ts spec-mode setup |
| G12 | Clarify skip-no-questions check ONLY applies when `--clarify` IS enabled | Documented in skip-conditions |
| G13 | Post-taskify validation DELETES invalid task.json so retry can recreate | Added to `validate-task-json` post-action |
| G15 | Gate comment posting reads gate file + extracts body + posts | Already in check-gate post-action, verified |
| G18 | `commitTaskFiles` is LOCAL mode only (`if (!input.local || input.dryRun) return`) | Fixed condition text in post-actions |
| G25 | Test failure error must include output text (3000 chars) for supervisor retry | Added to `run-unit-tests` post-action error message |
| G30 | PipelinePausedError in parallel stages must be caught before advisory check | Engine catches PipelinePausedError from allSettled results specially |
| G33 | Rerun fallback to full spreads input with `mode: 'full'` override | Documented in entry.ts rerun setup |
| G37 | Rerun must DELETE output files in addition to resetting status | Added to entry.ts rerun setup + resetFromStage |

### Compatibility Fixes (breaking existing consumers)

| # | Gap | Fix in Plan |
|---|-----|-------------|
| G(utils-4/5) | `formatStatusComment` takes v1 `CodyPipelineStatus` but engine produces v2 | Added `formatStatusCommentV2` adapter + keep v1 function for backward compat |
| G(utils-3) | Old status function names (`readStatus`, `writeStatus`, etc.) have no mapping | Full v2 break — old v1 functions removed, all consumers updated to use v2 directly. No re-export aliases (type signatures are incompatible). |
| G(utils-1/2) | `getTaskDir`, `ensureTaskDir`, `getLastFailedStage` not assigned to destination module | Kept in cody-utils.ts (they're utility functions, not status-specific) |

### Test File Fixes (preventing test crashes)

| # | Gap | Fix in Plan |
|---|-----|-------------|
| G(mod-13) | `bug-exposure.test.ts` reads deleted `run-cody.sh` | Delete test file in Step 12 |
| G(mod-14) | `bugfixes.test.ts` reads deleted `parse-inputs.sh` | Delete test file in Step 12 |
| G(mod-15) | `cody-utils-security.test.ts` inspects source of moved functions | Update imports in Step 12 |
| G(mod-16) | `cody-utils-extended.test.ts` uses v1 status schema shapes | Update to v2 schema in Step 12 |
| G(mod-9) | `clarify-workflow.test.ts` spy on `codyUtils.getLatestIssueComment` | Update spy to use github-api module in Step 12 |

### Dry-Run Fix

| # | Gap | Fix in Plan |
|---|-----|-------------|
| G(dry) | Current dry-run does NOT write mock files or run post-actions — plan proposed both | Aligned with current behavior: dry-run marks completed, does NOT write mock files, does NOT run post-actions |

### Autofix Commit Fix

| # | Gap | Fix in Plan |
|---|-----|-------------|
| G(mod-20) | Autofix commit (inside ScriptedVerifyHandler) is unspecified — code changes would be lost | Added explicit autofix commit to ScriptedVerifyHandler (tracked+task, push:true) |

---

## Review Findings — Round 1 (incorporated)

Code review and security audit identified these issues, now fixed in this plan:

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| R1 | `handleClarification` workflow not placed in any handler/post-action | 🔴 Critical | Moved to entry.ts post-spec-loop (NOT a stage post-action — it runs after the spec loop completes, not on a specific stage) |
| R2 | `ensureFeatureBranch` before build is missing | 🔴 Critical | Added as pre-execute hook on build stage (NOT post-action on architect — too early) |
| R3 | Handler registry can't dispatch git handlers by StageType alone | 🟡 Medium | Changed registry to `Map<string, StageHandler>` keyed by stage name |
| R4 | `stage-hooks.ts` deleted but function implementations not migrated | 🟡 Medium | Inline implementations into post-actions.ts (not import from deleted file) |
| R5 | `getStageValidator` implementations not assigned to any file | 🟡 Medium | Created `pipeline/validators.ts` module |
| R6 | `cleanDirtyState` parameter missing from PostAction commit definition | 🟡 Medium | Added to PostAction union |
| R7 | Audit history commit pattern not parameterized | 🟡 Medium | Added as distinct commit-task-files variant with different taskDir |
| R8 | Gate post-action needs plan.md content for architect gate | 🟢 Minor | Added `includeArtifact` parameter to check-gate PostAction |
| R9 | Zod validation for status.json v2 should be mandatory | 🟢 Minor (Security) | Made Zod schema mandatory in status.ts |
| R10 | COMMENT_BODY encoding must be preserved when parse-inputs.sh deleted | 🟢 Minor (Security) | YAML uses `jq -Rs` encoding inline or env var passthrough |

---

## Overview

Rewrite the Cody CI/CD pipeline orchestrator from an implicit state machine (1,156-line `cody.ts` with scattered control flow, file-existence-based skipping, 4 sources of state truth) into an explicit state machine architecture with `status.json` as the single authority, declared pipeline definitions, typed handlers, and testable transitions.

**Key constraint**: This is a full rewrite, not incremental. The pipeline is not yet production-ready, so a clean break is acceptable. In-flight tasks will restart.

## Gap Analysis Findings — Round 1 (incorporated)

These 14 gaps from the prior analysis are incorporated into the plan:

1. **Two-phase pipeline construction** — engine runs taskify first, then reads task.json to resolve the full pipeline (lightweight vs standard).
2. **Pre-pipeline setup phase** — 5 modes have different setup logic (create task.md from issue, validate clarified.md, write feedback file) that runs before the engine loop.
3. **Shell scripts kept as shell** — `parse-safety.sh`, `parse-safety-supervisor.sh`, and `checkout-task-branch.sh` run before Node.js is installed. Cannot port to TS.
4. **Parameterized commit post-actions** — 7 distinct commit patterns with different staging strategies, push/no-push, ensure-branch flags, and cleanDirtyState.
5. **Lifecycle hooks** — Engine needs `onStateChange` callbacks for posting GitHub comments on pause/complete/fail.
6. **Signal handlers** — SIGTERM/SIGINT in entry.ts to mark status.json as failed on CI kill.
7. **Separate github-api.ts** — Extract GitHub API helpers from cody-utils.ts.
8. **Validators get PipelineContext** — Some validators check sibling files (gap validator checks spec.md wasn't corrupted).
9. **Engine-level dry-run** — Dry-run marks stages completed without calling handlers. Does NOT write mock files or run post-actions (matches current behavior).
10. **Only run-cody.sh and parse-inputs.sh are deleted** — 3 shell scripts stay.

## Assumptions

- MongoDB not required for these tests (pure TS pipeline logic, no Payload).
- Tests use vitest with `vi.mock` for fs/child_process/path.
- The `pnpm cody` script entry in package.json will be updated to point to the new entry.ts.
- All existing ~853 tests in 28 files will be superseded by new tests alongside the engine.
- Old test files are deleted only in the cleanup step (Step 12).
- `stage-hooks.ts` function implementations are **inlined** into post-actions.ts (not imported), since stage-hooks.ts is deleted. The implementations are simple (< 30 lines each).
- `getStageValidator` implementations move to `pipeline/validators.ts`.
- `clarify-workflow.ts` will be updated to import from `github-api.ts` instead of `cody-utils.ts` for GitHub API functions.
- `getTaskDir`, `ensureTaskDir` stay in `cody-utils.ts` (they are general utilities, not status-module-specific).
- `getLastFailedStage` stays in `cody-utils.ts` but is **updated to use v2 schema**: reads `PipelineStateV2` via `loadState`, iterates v2 stage states. No backward-compat wrapper needed since the only caller is `entry.ts` (rerun mode).
- `formatStatusComment` stays in `cody-utils.ts` with a v2 adapter (`formatStatusCommentV2`) that converts PipelineStateV2 → CodyPipelineStatus for the existing rendering logic.
- `handleClarification` logic runs in entry.ts AFTER the spec stage loop, not as a post-action on clarify stage. This matches cody.ts behavior where it runs at line 534 (after the spec stage for-loop ends at line 529).
- `ensureFeatureBranch` runs as a pre-execute hook on the build stage (inside `executeSingleStep`), not as a post-action on architect. This matches cody.ts line 735 where it runs inside `runSingleStage` when `stage === 'build'`.
- Dry-run mode: marks stages completed with `retries: 0`, does NOT write mock files, does NOT run post-actions. This matches current cody.ts behavior (lines 423-426, 742-745).

---

## Step 1: Core Types (`engine/types.ts`)

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/engine/types.ts` (NEW, ~220 lines)

**Exact behavior**:
Define all types for the new architecture:
- `StageType`: `'agent' | 'scripted' | 'git' | 'gate'`
- `StageOutcome`: `'completed' | 'failed' | 'paused' | 'timed_out' | 'skipped'`
- `StageResult`: `{ outcome, reason?, retries, outputFile? }`
- `StageDefinition`: `{ name, type, timeout, maxRetries, shouldSkip?, validator?, postActions?, advisory?, preExecute? }`
  - `preExecute` (NEW — G20): optional `(ctx) => Promise<void>` hook that runs before the handler. Used by build stage for `ensureFeatureBranch`.
- `PipelineStep`: `string | { parallel: string[] }`
- `PipelineDefinition`: `{ stages: Map<string, StageDefinition>, order: PipelineStep[] }`
- `PipelineContext`: `{ taskId, taskDir, input, taskDef, profile, backend }`
  - Note: NO `controlMode` field — each gate resolves it dynamically via `resolveControlMode(ctx.taskDef, ctx.input.controlMode)` (G42)
- `PipelineStateV2`: status.json v2 schema with version:2, cursor, per-stage states
- `PostAction` discriminated union with all action types and their parameters:
  - `{ type: 'validate-task-json' }` — validates task.json, DELETES invalid file on failure (G13)
  - `{ type: 'resolve-profile' }`
  - `{ type: 'check-gate', gate: string, includeArtifact?: string }` ← R8: optional artifact path for gate comment (e.g., 'plan.md')
  - `{ type: 'commit-task-files', stagingStrategy, push, ensureBranch, cleanDirtyState?, commitMessage?, localOnly? }` ← R6: includes cleanDirtyState, G18: localOnly flag
  - `{ type: 'archive-rerun-feedback' }`
  - `{ type: 'validate-plan-exists' }`
  - `{ type: 'validate-build-content' }`
  - `{ type: 'run-tsc' }`
  - `{ type: 'run-unit-tests' }` — on failure, error message includes output text truncated to 3000 chars (G25)
  - `{ type: 'commit-audit-history' }` ← R7: audit-history.json commit
- `SkipResult`: `{ shouldSkip: boolean, reason?: string }`
- `ValidationResult` (re-export from agent-runner for convenience)
- `LifecycleHooks`: `{ onStateChange?: (prev, next, ctx) => void }`
- `PipelinePausedError` class (moved from cody.ts)
- Re-export `CodyInput` from cody-utils, `ControlMode`, `TaskDefinition` from pipeline-utils

**NOTE**: Removed `handle-clarification` and `ensure-feature-branch` from PostAction union:
- `handleClarification` runs in entry.ts after spec loop, not as a stage post-action (G17)
- `ensureFeatureBranch` runs as `preExecute` on build stage, not as a post-action (G20)

**Tests** (file: `tests/unit/scripts/cody/engine/types.test.ts`):
1. `PipelineStateV2 type guard validates version:2 schema` — write a `isPipelineStateV2(obj)` type guard function, test with valid v2 object → true, v1 object → false, garbage → false.
2. `PostAction type covers all 10 action types` — create a factory function for each variant, assert TypeScript compiles and runtime check succeeds.

**Acceptance criteria**:
- [ ] All types are exported and importable
- [ ] `isPipelineStateV2` correctly validates v2 schema
- [ ] PostAction union covers all 10 action types (not 12 — handle-clarification and ensure-feature-branch are not post-actions)
- [ ] `StageDefinition` has optional `preExecute` hook (G20)
- [ ] No runtime dependencies (pure type file + 1 type guard + 1 error class)

---

## Step 2: Status Module (`engine/status.ts`)

**Time estimate**: 20 minutes
**Files to touch**:
- `scripts/cody/engine/status.ts` (NEW, ~160 lines)

**Exact behavior**:
Encapsulate all status.json v2 operations with **mandatory Zod validation** (R9):
- `PipelineStateV2Schema` — Zod schema for v2, validates `version: z.literal(2)`, all required fields
- `loadState(taskId): PipelineStateV2 | null` — read + validate with Zod schema. Returns null on missing file, invalid JSON, or failed validation.
- `writeState(taskId, state): void` — atomic write (tmp + rename), same pattern as current `writeStatus`
- `initState(ctx: PipelineContext, mode: string): PipelineStateV2` — create fresh v2 state
- `updateStage(state, stageName, update): PipelineStateV2` — immutable update returning new state
- `completeState(state, finalState): PipelineStateV2` — mark pipeline completed/failed/paused
- `resetFromStage(state, fromStage, pipeline, taskDir): PipelineStateV2` — reset stages from a point onwards to pending. **Also deletes output files** for reset stages (G37): `fs.unlinkSync(stageOutputFile(taskDir, stage))` for each reset stage.
- `stateToV1(state: PipelineStateV2): CodyPipelineStatus` — adapter that converts v2 state to v1 format for `formatStatusComment` compatibility (G(utils-4/5))

**Tests** (file: `tests/unit/scripts/cody/engine/status.test.ts`):
1. `writeState + loadState round-trips correctly` — write a PipelineStateV2 object, read it back, assert deep equality. Also test atomic write (tmp file is cleaned up).
2. `updateStage returns new state with stage updated` — create state with 3 stages all pending, update one to 'running', assert original unchanged (immutability), assert new state has the stage as 'running' with startedAt set.
3. `resetFromStage resets stages from the given point onwards and deletes output files` — create state with stages [a:completed, b:completed, c:failed, d:pending], reset from 'b' → assert b,c,d are pending, a stays completed. Assert fs.unlinkSync called for b.md, c.md (G37).
4. `loadState returns null for missing file` — test with non-existent path.
5. `loadState returns null for v1 schema (Zod rejects)` — write old status format, assert null returned.
6. `loadState returns null for corrupted JSON` — write invalid JSON, assert null returned.
7. `stateToV1 converts v2 to v1 format correctly` — verify CodyPipelineStatus fields populated from PipelineStateV2 (G(utils-4/5)).
8. `stateToV1 maps v2 'skipped' state to v1 'completed' with skipped reason` — edge case.
9. `stateToV1 handles missing v1-only fields gracefully (totalElapsed, gatePoint)` — returns default/undefined for unmapped fields.

**Acceptance criteria**:
- [ ] Zod schema validates v2 structure (mandatory, not optional) — R9
- [ ] Round-trip read/write works with atomic file operations
- [ ] `updateStage` is immutable (returns new object)
- [ ] `resetFromStage` correctly resets from given stage onwards AND deletes output files (G37)
- [ ] `stateToV1` adapter converts v2→v1 for formatStatusComment (G(utils-4/5))
- [ ] Invalid/missing/v1 files return null (not throw)

---

## Step 3: GitHub API Module (`github-api.ts`)

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/github-api.ts` (NEW, ~150 lines)
- `scripts/cody/cody-utils.ts` (MODIFIED — re-export from github-api.ts)
- `scripts/cody/clarify-workflow.ts` (MODIFIED — update import from github-api.ts)

**Exact behavior**:
Extract from `cody-utils.ts`:
- `postComment(issueNumber, body)` — unchanged logic
- `editComment(commentId, body)` — unchanged
- `getIssue(issueNumber)` — unchanged
- `getIssueBody(issueNumber)` — unchanged
- `getIssueTitle(issueNumber)` — unchanged
- `getLatestIssueComment(issueNumber, excludeAuthor?)` — unchanged
- `discoverTaskIdFromIssue(issueNumber)` — unchanged
- `ensureTaskMarkerComment(issueNumber, taskId, mode?, runUrl?)` — unchanged
- `extractGateCommentBody(fileContent)` — unchanged
- `TASK_ID_MARKER_REGEX` — unchanged
- `extractTaskIdFromMarker(text)` — unchanged

In `cody-utils.ts`, replace implementations with `export { postComment, ... } from './github-api'`.
In `clarify-workflow.ts`, update import to `import { getLatestIssueComment } from './github-api'`.

**Tests** (file: `tests/unit/scripts/cody/github-api.test.ts`):
1. `postComment calls gh issue comment with body via stdin` — mock execSync, call postComment(42, 'hello'), assert execSync called with expected args.
2. `discoverTaskIdFromIssue parses "Task created:" marker` — mock execSync to return comment with marker, assert returns task ID.
3. `extractGateCommentBody strips # Gate Request prefix` — pure function test.

**Acceptance criteria**:
- [ ] All functions extracted and importable from github-api.ts
- [ ] cody-utils.ts re-exports from github-api.ts (backward compatible)
- [ ] clarify-workflow.ts imports updated (no circular deps)
- [ ] No behavior change — just file reorganization

---

## Step 4: Pipeline Validators (`pipeline/validators.ts`)

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/pipeline/validators.ts` (NEW, ~100 lines)

**Exact behavior**:
Move `getStageValidator` implementations from `cody.ts` (lines 102-181) into standalone module (R5):

- `createSpecValidator(ctx): ValidatorFn` — validates spec.md has ## Requirements or ## Acceptance Criteria
- `createGapValidator(ctx): ValidatorFn` — validates gap.md format AND checks spec.md wasn't corrupted (uses ctx.taskDir)
- `createPlanGapValidator(ctx): ValidatorFn` — validates plan-gap format AND checks plan.md still exists
- `createBuildValidator(): ValidatorFn` — validates build.md has ## Changes section

All use `(outputFile: string) => ValidationResult` signature (agent-runner's type). The `ctx` parameter is captured via closure at definition time (in definitions.ts), satisfying GAP 11 without changing the ValidationResult interface.

**Tests** (file: `tests/unit/scripts/cody/pipeline/validators.test.ts`):
1. `createGapValidator rejects corrupted spec.md` — provide ctx with taskDir, write valid gap.md but corrupted spec.md (no ## Requirements), assert { valid: false }.
2. `createSpecValidator accepts valid spec content` — write spec with ## Requirements, assert { valid: true }.
3. `createPlanGapValidator rejects if plan.md deleted` — mock plan.md missing, assert { valid: false }.

**Acceptance criteria**:
- [ ] Validator implementations moved from cody.ts (not duplicated)
- [ ] Gap/plan-gap validators check sibling files via ctx closure (GAP 11)
- [ ] All validators return `ValidationResult` type from agent-runner.ts

---

## Step 5: Pipeline Definitions (`pipeline/definitions.ts`)

**Time estimate**: 25 minutes
**Files to touch**:
- `scripts/cody/pipeline/definitions.ts` (NEW, ~300 lines)

**Exact behavior**:
Declarative stage configurations as a `Map<string, StageDefinition>`. Each stage definition includes:
- `name`, `type`, `timeout`, `maxRetries`
- `shouldSkip` — pure function reference (defined in skip-conditions.ts, Step 6)
- `validator` — created via validator factory from validators.ts (Step 4) with PipelineContext closure
- `postActions` — array of PostAction discriminated union values with full parameters
- `advisory` — boolean for non-blocking stages (auditor)
- `preExecute` — optional async function (G20: build stage uses this for ensureFeatureBranch)

Stage definitions to include (matching current pipeline):
`taskify`, `spec`, `gap`, `clarify`, `architect`, `plan-gap`, `build`, `commit`, `verify`, `auditor`, `apply-audit`, `pr`

Key pre-execute hooks:
- **build**: `preExecute: async (ctx) => { if (!ctx.input.dryRun) { const td = readTask(ctx.taskDir); if (td) ensureFeatureBranch(ctx.taskId, td.task_type) } }` (G20)

Key post-actions per stage:
- **taskify**: `validate-task-json`, `resolve-profile`, `check-gate` (gate:'taskify'), `commit-task-files` (task-only, push:true, ensureBranch:true)
- **architect**: `archive-rerun-feedback`, `check-gate` (gate:'architect', includeArtifact:'plan.md')
- **plan-gap**: `validate-plan-exists`
- **build**: `validate-build-content`, `run-tsc`, `run-unit-tests`
- **verify**: `commit-task-files` (task-only, push:false, localOnly:true) — LOCAL-ONLY commit of task files after verify completes (NOT the autofix commit — that's inside ScriptedVerifyHandler)
- **apply-audit**: `commit-task-files` (task-only, push:false, localOnly:true), `commit-audit-history` ← R7

**NOTE**: No post-actions on clarify stage. `handleClarification` runs in entry.ts after spec loop (G17).

Commit post-actions with `localOnly: true` (G18):
- `commitTaskFiles` after verify: `localOnly: true` (only commits in local mode)
- `commitTaskFiles` after apply-audit: `localOnly: true`
- `commitAuditHistory`: `localOnly: true`

Pipeline order arrays:
- `SPEC_ORDER_STANDARD` = `['taskify', 'spec', 'gap', 'clarify']`
- `SPEC_ORDER_LIGHTWEIGHT` = `['taskify', 'clarify']`
- `IMPL_ORDER_STANDARD` = `['architect', 'plan-gap', 'build', 'commit', { parallel: ['verify', 'auditor'] }, 'apply-audit', 'pr']`
- `IMPL_ORDER_LIGHTWEIGHT` = `['architect', 'build', 'commit', 'verify', 'pr']`

`buildPipeline(mode, profile, clarify, ctx)` function returns a `PipelineDefinition`. The `ctx` is needed for validator closures.

**Tests** (file: `tests/unit/scripts/cody/pipeline/definitions.test.ts`):
1. `buildPipeline('full', 'standard', false, ctx) returns spec+impl stages in correct order` — assert stages map has all 12 stages, order starts with taskify and ends with pr.
2. `buildPipeline('impl', 'lightweight', false, ctx) returns only lightweight impl stages` — assert plan-gap, auditor, apply-audit are NOT in the order.
3. `every stage definition has valid type and timeout > 0` — iterate all stages, assert constraints.
4. `commit-task-files postActions include cleanDirtyState parameter` — find stages with commit-task-files, assert cleanDirtyState field present where needed (R6).
5. `build stage has preExecute hook` — G20 verification.
6. `clarify stage has NO post-actions` — G17 verification (clarify logic moved to entry.ts).
7. `verify post-actions include commit-task-files with localOnly` — G18 verification.

**Acceptance criteria**:
- [ ] All 12 stages have definitions with correct types/timeouts
- [ ] PostActions include cleanDirtyState (R6), commit-audit-history (R7), includeArtifact on check-gate (R8)
- [ ] Build stage has `preExecute` for ensureFeatureBranch (G20)
- [ ] Clarify stage has NO post-actions (G17 — logic moved to entry.ts)
- [ ] Commit post-actions use `localOnly: true` where appropriate (G18)
- [ ] Validator closures capture PipelineContext (GAP 11)
- [ ] `buildPipeline` produces correct definitions for all mode/profile combinations

---

## Step 6: Skip Conditions (`pipeline/skip-conditions.ts`)

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/pipeline/skip-conditions.ts` (NEW, ~100 lines)

**Exact behavior**:
Pure functions that determine if a stage should be skipped:
- `skipIfInputQuality(ctx, stageName)` — checks `ctx.taskDef?.input_quality?.skip_stages` contains stage AND promoted output file exists
- `skipIfClarifyDisabled(ctx)` — returns skip if `!ctx.input.clarify`. Also handles the auto-create clarified.md path: when clarify is disabled, ensure clarified.md exists with default content, and clean up residual questions.md (matching cody.ts lines 537-548).
- `skipIfNoAuditorOutput(ctx)` — returns skip if auditor.md doesn't exist
- `skipIfSpecHasNoOpenQuestions(ctx)` — returns skip if spec.md exists but has no `## Open Questions`. **Only applies when clarify IS enabled** (G12) — if clarify is disabled, `skipIfClarifyDisabled` handles the skip instead.
- `skipIfSpecOnly(ctx)` — returns skip if `ctx.taskDef?.pipeline === 'spec_only'`

**Tests** (file: `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts`):
1. `skipIfInputQuality returns skip when stage is in skip_stages and file exists` — mock fs → true, assert skip.
2. `skipIfInputQuality returns no-skip when promoted file is missing` — mock fs → false, assert no-skip.
3. `skipIfClarifyDisabled creates default clarified.md and cleans up questions.md` — mock fs, assert writeFileSync called for clarified.md, unlinkSync for questions.md.
4. `skipIfNoAuditorOutput returns skip when auditor.md missing` — assert skip.
5. `skipIfSpecHasNoOpenQuestions only checks when clarify is enabled` — G12 test.
6. `skipIfSpecOnly returns skip when taskDef.pipeline is 'spec_only'` — basic test.

**Acceptance criteria**:
- [ ] All skip functions are pure (minimal side effects — only skipIfClarifyDisabled writes files)
- [ ] Each returns `SkipResult` with reason
- [ ] skipIfClarifyDisabled handles auto-create clarified.md + questions.md cleanup
- [ ] skipIfSpecHasNoOpenQuestions only applies when clarify enabled (G12)

---

## Step 7: Handler Interface + All Handlers

**Time estimate**: 30 minutes
**Files to touch**:
- `scripts/cody/handlers/handler.ts` (NEW, ~60 lines)
- `scripts/cody/handlers/agent-handler.ts` (NEW, ~90 lines)
- `scripts/cody/handlers/scripted-handler.ts` (NEW, ~160 lines)
- `scripts/cody/handlers/git-handler.ts` (NEW, ~80 lines)
- `scripts/cody/handlers/gate-handler.ts` (NEW, ~90 lines)

**Exact behavior**:

`handler.ts`:
- `StageHandler` interface: `{ execute(ctx, def): Promise<StageResult> }`
- Handler registry: `Map<string, StageHandler>` keyed by **stage name** (R3 — not StageType, because commit and pr both have type 'git' but different handlers)
- `getHandler(stageName, stageType): StageHandler` — lookup by name first, fall back to type-based default
- Default handlers per type: agent → AgentHandler, scripted → ScriptedVerifyHandler, gate → GateHandler
- Named handlers: commit → GitCommitHandler, pr → GitPrHandler

`agent-handler.ts`:
- `AgentHandler.execute(ctx, def)` → wraps `runAgentWithFileWatch`, maps result to StageResult

`scripted-handler.ts`:
- `ScriptedVerifyHandler.execute(ctx, def)`:
  1. Run `runVerifyStage(outputFile, cwd, def.timeout)`
  2. If passed → completed
  3. If failed → internal autofix loop (MAX_AUTOFIX=2):
     a. Run autofix agent via `runAgentWithFileWatch`
     b. Re-run `runVerifyStage`
     c. If passes → commit autofix changes (`commitPipelineFiles({ stagingStrategy: 'tracked+task', push: true })`) (G(mod-20))
     d. If exhausted → failed
  4. Return StageResult

**IMPORTANT (G(mod-20))**: After autofix succeeds, the handler must commit autofix changes explicitly. The commit agent ran before verify, so any autofix changes would be lost without this commit. This is `commitPipelineFiles({ taskDir, taskId, message: 'fix: Autofix corrections...', stagingStrategy: 'tracked+task', push: true, dryRun: ctx.input.dryRun })`.

`git-handler.ts`:
- `GitCommitHandler.execute` → wraps `runCommitStage`
- `GitPrHandler.execute` → wraps `runPrStage`

`gate-handler.ts`:
- `GateHandler.execute(ctx, def)`:
  - **Resolves controlMode dynamically** (G42): `const controlMode = resolveControlMode(ctx.taskDef!, ctx.input.controlMode)`
  - Calls `handleGateApproval(ctx.input, ctx.taskDir, gate, ctx.taskDef)`
  - Returns paused/completed/failed based on result

**Tests**:

(file: `tests/unit/scripts/cody/handlers/agent-handler.test.ts`):
1. `AgentHandler maps success to completed`
2. `AgentHandler maps timeout to timed_out`
3. `AgentHandler passes validator with PipelineContext closure`

(file: `tests/unit/scripts/cody/handlers/scripted-handler.test.ts`):
4. `ScriptedVerifyHandler returns completed when verify passes`
5. `ScriptedVerifyHandler runs autofix and returns completed on fix`
6. `ScriptedVerifyHandler commits autofix changes after successful fix` (G(mod-20))
7. `ScriptedVerifyHandler returns failed when autofix exhausted`

(file: `tests/unit/scripts/cody/handlers/git-handler.test.ts`):
8. `GitCommitHandler returns completed on success`
9. `GitPrHandler returns completed with PR URL`

(file: `tests/unit/scripts/cody/handlers/gate-handler.test.ts`):
10. `GateHandler resolves controlMode dynamically` (G42)
11. `GateHandler returns paused when waiting`
12. `GateHandler returns completed when approved`

(file: `tests/unit/scripts/cody/handlers/handler.test.ts`):
13. `getHandler('commit', 'git') returns GitCommitHandler` — R3 verification
14. `getHandler('pr', 'git') returns GitPrHandler`
15. `getHandler('build', 'agent') returns AgentHandler`

**Acceptance criteria**:
- [ ] Handler registry keyed by stage name, not StageType (R3)
- [ ] All 5 handler types implement StageHandler interface
- [ ] ScriptedVerifyHandler has internal autofix loop with explicit autofix commit (G(mod-20))
- [ ] GateHandler resolves controlMode dynamically per gate (G42)
- [ ] Git handlers dispatch correctly per stage name

---

## Step 8: Post-Actions (`pipeline/post-actions.ts`)

**Time estimate**: 25 minutes
**Files to touch**:
- `scripts/cody/pipeline/post-actions.ts` (NEW, ~220 lines)

**Exact behavior**:
`executePostAction(ctx, action, state): Promise<void>` — switch on action.type:

- `validate-task-json` → calls `readTask(ctx.taskDir)`. On failure: **DELETES the task.json file** so retry can recreate it (G13), then throws.
- `resolve-profile` → reads task.json, calls `resolvePipelineProfile`, mutates `ctx.profile`. Returns the resolved profile so caller can rebuild pipeline.
- `check-gate` → calls `handleGateApproval`. If `action.includeArtifact`, reads the file content and passes as `planContent` parameter (R8). On 'waiting' → reads gate file, extracts comment body via `extractGateCommentBody`, posts comment to issue if issueNumber (G15), commits + throws `PipelinePausedError`.
- `commit-task-files` → **Guards with `localOnly` flag** (G18): if `action.localOnly && !ctx.input.local`, return early. If `ctx.input.dryRun`, return early. Calls `commitPipelineFiles` with parameterized options including `cleanDirtyState` (R6). The commit patterns are:
  1. Gate pause (taskify): task-only, push:true, ensureBranch:true
  2. Clarify waiting: task-only, push:true, ensureBranch:true, cleanDirtyState:true
  3. Spec complete: task-only, push:true, ensureBranch:true, cleanDirtyState:true
  4. Local commit after verify: task-only, push:false, localOnly:true
  5. Gate pause (architect): task-only, push:true, ensureBranch:true
  6. _(autofix commit is in ScriptedVerifyHandler, not post-actions)_
- `commit-audit-history` → R7 fix: **Guards with localOnly** (G18). Commits `.tasks/audit-history.json` separately. Calls `commitPipelineFiles({ taskDir: '.tasks', taskId: 'audit-history', ... })`.
- `archive-rerun-feedback` → **inlined** (R4): renames rerun-feedback.md → rerun-feedback.consumed.md (~5 lines)
- `validate-plan-exists` → **inlined** (R4): checks plan.md + gap report validity (~15 lines)
- `validate-build-content` → **inlined** (R4): validates build report + test section (~20 lines)
- `run-tsc` → **inlined** (R4): `execSync('pnpm -s tsc --noEmit')` (~10 lines)
- `run-unit-tests` → **inlined** (R4): `execSync('pnpm -s test:unit')`, throws on failure. Error message includes test output truncated to 3000 chars (G25): `throw new Error(\`Unit tests failed after build. Fix and re-run.\n\n${output.slice(0, 3000)}\`)`.

**Tests** (file: `tests/unit/scripts/cody/pipeline/post-actions.test.ts`):
1. `commit-task-files calls commitPipelineFiles with cleanDirtyState` — R6 test.
2. `commit-task-files skips when localOnly and not local mode` — G18 test.
3. `check-gate reads plan.md when includeArtifact set` — R8 test.
4. `check-gate throws PipelinePausedError when waiting` — mock handleGateApproval → 'waiting'.
5. `check-gate posts comment from gate file content` — G15 test.
6. `validate-task-json deletes invalid task.json on failure` — G13 test.
7. `commit-audit-history uses .tasks as taskDir` — R7 test.
8. `run-unit-tests throws with output text on failure` — G25 test, mock execSync throwing with stderr.
9. `resolve-profile mutates ctx.profile and returns profile` — assert ctx.profile changed.

**Acceptance criteria**:
- [ ] All 10 post-action types handled
- [ ] cleanDirtyState supported (R6)
- [ ] commit-audit-history uses different taskDir (R7)
- [ ] check-gate reads includeArtifact (R8), posts comment from gate file (G15)
- [ ] validate-task-json deletes file on failure (G13)
- [ ] localOnly guard prevents CI commits for local-only actions (G18)
- [ ] run-unit-tests includes output in error (G25)
- [ ] All implementations inlined, no imports from deleted stage-hooks.ts (R4)

---

## Step 9: State Machine Engine (`engine/state-machine.ts`)

**Time estimate**: 30 minutes
**Files to touch**:
- `scripts/cody/engine/state-machine.ts` (NEW, ~260 lines)

**Exact behavior**:
Core deterministic loop. The engine never knows about specific stage names.

`runPipeline(ctx, pipeline, hooks?): Promise<PipelineStateV2>`:
1. `state = loadState(ctx.taskId) || initState(ctx, ctx.input.mode)`
2. Loop:
   a. `next = resolveNextStep(state, pipeline)` — find first step where any stage is pending/failed/running
   b. If `!next` → break (all done)
   c. If dry-run: for each stage in step, mark completed with `retries: 0`, continue. **Does NOT write mock files or run post-actions** (G(dry)).
   d. If parallel: `executeParallelStep(ctx, pipeline, state, next.stages)`
   e. If single: `executeSingleStep(ctx, pipeline, state, next.stage)`
   f. `writeState(ctx.taskId, state)` — persist atomically
   g. Call `hooks?.onStateChange?.(prevState, state, ctx)` if state changed
   h. If `state.state === 'failed' || state.state === 'paused'` → break
3. Return final state

`executeSingleStep`:
1. Check skip conditions → mark skipped
2. Check already completed (resume) → skip
3. Mark running + persist
4. **Run preExecute hook if defined** (G20): `await def.preExecute?.(ctx)`. If preExecute throws, mark stage as failed and propagate (stage was already marked 'running', which is correct — it attempted to run and failed before the handler).
5. `handler = getHandler(def.name, def.type)` ← R3: lookup by name then type
6. `result = await handler.execute(ctx, def)`
7. Update stage state
8. If completed → run post-actions (catch PipelinePausedError)
9. If paused → set pipeline paused
10. If failed && !advisory → set pipeline failed

`executeParallelStep`:
- Promise.allSettled, distinguish critical vs advisory failures
- **Catch PipelinePausedError specially** (G30): if any result is a PipelinePausedError, pause the pipeline (don't treat as a regular failure)

**Two-phase pipeline construction**: The engine accepts an optional `rebuildPipeline: (ctx) => PipelineDefinition` callback. When `resolve-profile` post-action mutates `ctx.profile`, it signals the engine to call this callback to get the updated pipeline for remaining stages.

**Tests** (file: `tests/unit/scripts/cody/engine/state-machine.test.ts`):
1. `runPipeline executes stages in order and returns completed state`
2. `runPipeline resumes from where it left off`
3. `runPipeline stops on failed non-advisory stage`
4. `runPipeline continues on failed advisory stage`
5. `runPipeline handles parallel stages`
6. `runPipeline calls onStateChange hook`
7. `runPipeline marks completed in dry-run without writing mock files or running post-actions` (G(dry))
8. `runPipeline runs post-actions on completed stages`
9. `runPipeline skips stages when shouldSkip returns true`
10. `runPipeline catches PipelinePausedError from post-actions and pauses`
11. `runPipeline runs preExecute hook before handler` (G20)
12. `executeParallelStep catches PipelinePausedError in parallel results` (G30)
13. `runPipeline invokes rebuildPipeline callback when resolve-profile post-action signals rebuild`

**Acceptance criteria**:
- [ ] Engine is deterministic: same state + pipeline → same transitions
- [ ] Resume works: completed stages are skipped
- [ ] Failed stages stop the pipeline (unless advisory)
- [ ] Parallel stages use Promise.allSettled, handle PipelinePausedError specially (G30)
- [ ] Dry-run marks completed without mock files or post-actions (G(dry))
- [ ] Lifecycle hooks fire on state changes
- [ ] PipelinePausedError caught and converted to paused state
- [ ] rebuildPipeline callback supports two-phase construction
- [ ] preExecute hook runs before handler (G20)

---

## Step 10: Pipeline Resolver (`engine/pipeline-resolver.ts`)

**Time estimate**: 20 minutes
**Files to touch**:
- `scripts/cody/engine/pipeline-resolver.ts` (NEW, ~100 lines)

**Exact behavior**:
Pure functions that construct pipeline definitions from mode + task.json:

`resolvePipelineForMode(mode, profile, clarify, ctx): PipelineDefinition`:
- `spec` → spec stages only (taskify + remaining spec stages based on profile)
- `impl` → impl stages only
- `full` → initially just `['taskify']` + post-actions that trigger rebuild
- `rerun` → same as impl (rerun resets stages via status.ts, entry.ts handles file deletion)
- `status` → no pipeline (handled separately)

`rebuildPipelineAfterTaskify(currentPipeline, ctx): PipelineDefinition`:
After taskify runs and `ctx.profile` is set:
1. Determine remaining spec stages for profile
2. Append impl stages for profile
3. Return new PipelineDefinition with extended order

`createRebuildCallback(mode, clarify): (ctx) => PipelineDefinition`:
Factory that returns the rebuild callback for the engine.

**Tests** (file: `tests/unit/scripts/cody/engine/pipeline-resolver.test.ts`):
1. `resolvePipelineForMode('full', 'standard', false, ctx) starts with just taskify` — for full mode, initial pipeline is minimal.
2. `rebuildPipelineAfterTaskify extends pipeline with profile-appropriate stages`
3. `resolvePipelineForMode('impl', 'lightweight', false, ctx) skips heavyweight stages`
4. `resolvePipelineForMode('spec', 'standard', true, ctx) includes clarify`

**Acceptance criteria**:
- [ ] All 5 modes produce correct pipeline definitions
- [ ] Two-phase rebuild extends pipeline after taskify
- [ ] Profile affects both spec and impl stages
- [ ] Rebuild callback is compatible with engine's interface

---

## Step 11: Entry Point + Setup Phase (`entry.ts`)

**Time estimate**: 35 minutes
**Files to touch**:
- `scripts/cody/entry.ts` (NEW, ~280 lines)
- `package.json` (MODIFIED — update `cody` script)

**Exact behavior**:
New CLI entry point that replaces `cody.ts main()`:

1. Parse CLI args via `parseCliArgs` (from cody-utils.ts — unchanged)
2. Set global logging context
3. Install signal handlers (G2): SIGTERM/SIGINT → try `loadState`, if not null mark failed + write, exit. Guard with try/catch since status.json may not exist yet (G2).
4. Run preflight checks (local mode)
5. Validate auth (CI mode)
6. Create runner backend
7. Ensure task directory
8. **Ensure task marker comment** (G3): `if (input.issueNumber) ensureTaskMarkerComment(...)` — runs for ALL modes before the mode switch.
9. **Pre-pipeline setup phase** per mode:
   - `spec`:
     - Create task.md: `--file` flag has priority (G8): resolve path, check exists, check non-empty, write `# Task\n\n${content}\n`. If no `--file`, create from issue body including `## Issue Title` section (G9).
     - If neither `--file` nor `issueNumber`, error.
   - `impl`: Validate clarified.md exists. Read and validate task.json. Check spec_only pipeline.
   - `full`: Do spec setup first.
   - `rerun`:
     - Validate spec.md exists (fallback to full with `mode: 'full'` override — G33).
     - Determine fromStage: `input.fromStage || getLastFailedStage(input.taskId) || 'build'`.
     - Normalize fromStage (autofix → verify).
     - Write rerun-feedback.md.
     - **Delete output files** from rerun point onwards (G37): iterate stages, `fs.unlinkSync(stageOutputFile(taskDir, stage))`.
     - Reset stages via `resetFromStage`.
   - `status`: Read and display status. Post comment if issue number. Return (no pipeline).
10. Resolve initial pipeline via `resolvePipelineForMode`
11. Create PipelineContext
12. Configure lifecycle hooks: `onStateChange` posts GitHub comments using `formatStatusComment(input, stateToV1(state))`
13. Call `runPipeline(ctx, pipeline, hooks)` with `rebuildPipeline` callback
14. **Post-spec clarification logic** (G17): After engine returns from spec-only or full mode, if spec stages completed:
    - If `input.clarify`: call `handleClarification(input, taskDir)`. If 'waiting': post questions comment, commit, throw PipelinePausedError. If 'answered': continue.
    - If `!input.clarify`: handled by `skipIfClarifyDisabled` skip condition (creates default clarified.md).
    - Then commit spec task files.
15. After engine returns: mark completed/failed via `completeState`, post final status comment
16. Handle `PipelinePausedError` (mark paused — gate comment was already posted by post-action, avoid duplicates)
17. **process.exit(1) on failure** (G6): in catch block, after posting failure comment.

**Tests** (file: `tests/unit/scripts/cody/entry.test.ts`):
1. `entry creates task.md from --file with # Task wrapper` — G8 test.
2. `entry creates task.md from issue body with ## Issue Title section` — G9 test.
3. `entry validates clarified.md exists in impl mode`
4. `entry writes rerun-feedback.md in rerun mode`
5. `entry deletes output files from rerun point onwards` — G37 test.
6. `entry falls back to full mode when spec.md missing in rerun` — G33 test.
7. `entry installs SIGTERM handler that marks status failed (guards null)` — G2 test.
8. `entry ensures task marker comment for ALL modes` — G3 test.
9. `entry calls process.exit(1) on pipeline failure` — G6 test.
10. `entry runs handleClarification after spec loop when clarify enabled` — G17 test.
11. `entry handles spec_only pipeline (skips impl)`
12. `entry handles status mode without running pipeline` — reads status.json, posts comment, returns.

**Acceptance criteria**:
- [ ] All 5 modes have correct pre-pipeline setup
- [ ] Signal handlers installed with null guard (G2)
- [ ] Task marker comment runs for ALL modes (G3)
- [ ] process.exit(1) on failure (G6)
- [ ] --file has priority, empty check, # Task wrapping (G8)
- [ ] Issue title in task.md (G9)
- [ ] handleClarification runs after spec loop, not as post-action (G17)
- [ ] Rerun deletes output files (G37) and falls back to full (G33)
- [ ] Lifecycle hooks use stateToV1 for formatStatusComment
- [ ] Rebuild callback wired for two-phase construction
- [ ] `package.json` `cody` script updated to `pnpm tsx scripts/cody/entry.ts`

---

## Step 12: YAML Workflow Update + Cleanup + Test Fixes

**Time estimate**: 25 minutes
**Files to touch**:
- `.github/workflows/cody.yml` (MODIFIED)
- `scripts/cody/cody-utils.ts` (MODIFIED — re-export from new modules + backward compat)

**YAML changes**:
- `orchestrate` job: Replace `./scripts/cody/run-cody.sh` with direct `pnpm cody` call:
  ```yaml
  - name: Run Cody
    run: |
      pnpm cody \
        --task-id="${TASK_ID:-}" \
        --mode="${MODE}" \
        --issue-number="${ISSUE_NUMBER:-}" \
        --trigger-type="${TRIGGER_TYPE}" \
        ${RUN_ID:+--run-id="$RUN_ID"} \
        ${RUN_URL:+--run-url="$RUN_URL"} \
        ${CLARIFY:+--clarify} \
        ${DRY_RUN:+--dry-run} \
        ${COMMENT_BODY:+--comment-body-env=COMMENT_BODY} \
        ${FEEDBACK:+--feedback="$FEEDBACK"} \
        ${FROM_STAGE:+--from="$FROM_STAGE"}
  ```
- `parse` job: Replace `./scripts/cody/parse-inputs.sh` with inline YAML that:
  - For dispatch: reads `github.event.inputs.*` directly into outputs
  - For comment: passes raw comment body via env var (preserving `jq -Rs .` encoding — R10)
  - Keep `./scripts/cody/parse-safety.sh` unchanged

**Deleted source files**:
- `scripts/cody/cody.ts` (1,156 lines)
- `scripts/cody/stage-hooks.ts` (223 lines) — implementations inlined in post-actions.ts (R4)
- `scripts/cody/run-cody.sh` (46 lines)
- `scripts/cody/parse-inputs.sh` (106 lines)

**Kept shell scripts**:
- `scripts/cody/parse-safety.sh`
- `scripts/cody/parse-safety-supervisor.sh`
- `scripts/cody/checkout-task-branch.sh`

**cody-utils.ts changes**:
- Re-export GitHub API from `github-api.ts`
- **Full v2 break for status functions** (G(utils-3), fixes review issue 2a/9a): The v1 status function signatures are type-incompatible with v2. Since ALL callers of `readStatus`/`writeStatus`/`initStatus`/`updateStageStatus`/`completeStatus` are in `cody.ts` (being deleted), there are NO external consumers. Therefore:
  - **REMOVE** the v1 implementations: `readStatus`, `writeStatus`, `initStatus`, `updateStageStatus`, `completeStatus` from cody-utils.ts
  - **DO NOT** re-export v2 functions under v1 names (signatures are incompatible)
  - **KEEP** the v1 types (`CodyPipelineStatus`, `StageStatus`) for `formatStatusComment` and `stateToV1` adapter
  - **REMOVE** the `ALL_STAGES` import from `stage-prompts` (no longer needed for `VALID_STAGES`)
  - **UPDATE** `getLastFailedStage` to use v2: `import { loadState } from './engine/status'`, iterate v2 stage states
- Keep in cody-utils.ts: `parseCliArgs`, `parseCommentBody`, `validateAuth`, `formatStatusComment`, `formatDuration`, `isValidMode`, `isValidStage`, `validateTaskId`, `getTaskDir`, `ensureTaskDir`, `getLastFailedStage` (G(utils-1/2))
- Add `formatStatusCommentV2(input, stateV2)` that calls `stateToV1(stateV2)` then delegates to `formatStatusComment` (G(utils-4/5))

**Deleted test files** (superseded by new tests):
- `tests/unit/scripts/cody.spec.ts` → replaced by entry.test.ts + state-machine.test.ts
- `tests/unit/scripts/cody/stage-hooks.test.ts` → replaced by post-actions.test.ts
- `tests/unit/scripts/cody/bug-exposure.test.ts` → reads deleted run-cody.sh (G(mod-13))
- `tests/unit/scripts/cody/bugfixes.test.ts` → reads deleted parse-inputs.sh (G(mod-14))

**Updated test files** (fix imports/schemas):
- `tests/unit/scripts/cody/cody-utils-security.test.ts` — update source path inspections (G(mod-15)): functions moved to github-api.ts, update `fs.readFileSync` path assertions.
- `tests/unit/scripts/cody/cody-utils-extended.test.ts` — remove tests for deleted v1 status functions (`readStatus`, `writeStatus`, etc.). Update remaining tests to import from correct modules. Keep tests for `formatStatusComment`, `getTaskDir`, `ensureTaskDir`, etc. (G(mod-16)).
- `tests/unit/scripts/cody/clarify-workflow.test.ts` — update spy from `codyUtils.getLatestIssueComment` to spy on `github-api` module import instead (G(mod-9)).

**Tests** (file: `tests/unit/scripts/cody/cleanup.test.ts`):
1. `deleted files no longer exist` — assert cody.ts, stage-hooks.ts, run-cody.sh, parse-inputs.sh, bug-exposure.test.ts, bugfixes.test.ts don't exist.
2. `cody-utils.ts still exports non-status public functions` — import postComment, formatStatusComment, getTaskDir, ensureTaskDir, getLastFailedStage and assert they are functions. v1 status functions (readStatus, writeStatus, initStatus) should NOT be exported.

**Acceptance criteria**:
- [ ] YAML uses `pnpm cody` directly (no run-cody.sh)
- [ ] COMMENT_BODY encoding preserved (R10)
- [ ] 3 shell scripts remain
- [ ] 4 source files deleted
- [ ] 4 test files deleted (cody.spec.ts, stage-hooks.test.ts, bug-exposure.test.ts, bugfixes.test.ts)
- [ ] 3 test files updated (cody-utils-security.test.ts, cody-utils-extended.test.ts, clarify-workflow.test.ts)
- [ ] cody-utils.ts v1 status functions removed (G(utils-3) — full v2 break, no re-export aliases)
- [ ] formatStatusCommentV2 adapter works (G(utils-4/5))
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s lint` passes

---

## Step 13: Integration Test — Full Pipeline E2E

**Time estimate**: 25 minutes
**Files to touch**:
- `tests/unit/scripts/cody/engine/integration.test.ts` (NEW, ~280 lines)

**Exact behavior**:
End-to-end integration tests wiring real engine with mock handlers:

**Tests**:
1. `full standard pipeline completes all stages in order` — mock all deps, run through engine, assert all stages completed, status.json written correctly.
2. `pipeline resumes from failed stage after status.json reload` — fail at build, reload, resume, complete.
3. `rerun resets and re-executes from specified stage with file deletion` — completed state, resetFromStage (which deletes files — G37), run, assert re-execution.
4. `gate handler pauses pipeline, resume continues` — pause at architect gate, load state, approve, continue.
5. `lightweight pipeline skips heavyweight stages` — assert plan-gap/auditor/apply-audit not executed.
6. `dry-run marks completed without calling handlers or post-actions` — dryRun=true, assert no handler calls, no post-action calls (G(dry)).
7. `two-phase pipeline construction extends pipeline after taskify` — start minimal, taskify completes, rebuild callback fires, remaining stages execute.
8. `parallel stages handle PipelinePausedError correctly` — G30 test: one parallel stage pauses, pipeline pauses.
9. `preExecute hook runs before handler` — G20 test: build stage's preExecute fires before AgentHandler.

**Acceptance criteria**:
- [ ] All 9 integration scenarios pass
- [ ] Tests use real engine code (not mocked)
- [ ] Only external dependencies (fs, child_process) are mocked
- [ ] Demonstrates state machine is deterministic and resumable

---

## File Summary

### New Files (15)
| File | Lines | Purpose |
|------|-------|---------|
| `scripts/cody/engine/types.ts` | ~220 | All types + type guard + PipelinePausedError |
| `scripts/cody/engine/status.ts` | ~160 | Status v2 read/write/update with Zod + v1 adapter |
| `scripts/cody/engine/state-machine.ts` | ~260 | Core engine loop |
| `scripts/cody/engine/pipeline-resolver.ts` | ~100 | Pipeline construction |
| `scripts/cody/handlers/handler.ts` | ~60 | Interface + registry (name-based, R3) |
| `scripts/cody/handlers/agent-handler.ts` | ~90 | Agent stage handler |
| `scripts/cody/handlers/scripted-handler.ts` | ~160 | Verify + autofix handler + autofix commit (G(mod-20)) |
| `scripts/cody/handlers/git-handler.ts` | ~80 | Commit + PR handlers |
| `scripts/cody/handlers/gate-handler.ts` | ~90 | Gate approval handler + dynamic controlMode (G42) |
| `scripts/cody/pipeline/definitions.ts` | ~300 | Declarative stage configs with preExecute (G20) |
| `scripts/cody/pipeline/skip-conditions.ts` | ~100 | Pure skip functions |
| `scripts/cody/pipeline/post-actions.ts` | ~220 | Post-stage action runner (inlined, R4) |
| `scripts/cody/pipeline/validators.ts` | ~100 | Stage output validators (R5) |
| `scripts/cody/entry.ts` | ~280 | New CLI entry point with clarification logic (G17) |
| `scripts/cody/github-api.ts` | ~150 | GitHub API helpers |
| **Total** | **~2,370** | |

### Deleted Source Files (4)
| File | Replaced By |
|------|-------------|
| `scripts/cody/cody.ts` (1,156 lines) | engine/ + entry.ts |
| `scripts/cody/stage-hooks.ts` (223 lines) | pipeline/post-actions.ts (inlined, R4) |
| `scripts/cody/run-cody.sh` (46 lines) | Direct YAML `pnpm cody` call |
| `scripts/cody/parse-inputs.sh` (106 lines) | Inline YAML + TS parseCliArgs |

### Deleted Test Files (4)
| File | Reason |
|------|--------|
| `tests/unit/scripts/cody.spec.ts` | Replaced by entry.test.ts + state-machine.test.ts |
| `tests/unit/scripts/cody/stage-hooks.test.ts` | Replaced by post-actions.test.ts |
| `tests/unit/scripts/cody/bug-exposure.test.ts` | Reads deleted run-cody.sh (G(mod-13)) |
| `tests/unit/scripts/cody/bugfixes.test.ts` | Reads deleted parse-inputs.sh (G(mod-14)) |

### Updated Test Files (3)
| File | Change |
|------|--------|
| `tests/unit/scripts/cody/cody-utils-security.test.ts` | Update source path inspections (G(mod-15)) |
| `tests/unit/scripts/cody/cody-utils-extended.test.ts` | Update v1 status schema shapes (G(mod-16)) |
| `tests/unit/scripts/cody/clarify-workflow.test.ts` | Update spy targets (G(mod-9)) |

### Modified Files (4)
| File | Change |
|------|--------|
| `scripts/cody/cody-utils.ts` | Re-export from github-api.ts, remove v1 status functions, add formatStatusCommentV2, update getLastFailedStage to v2 |
| `scripts/cody/clarify-workflow.ts` | Import from github-api.ts |
| `.github/workflows/cody.yml` | Direct pnpm cody call, inline parse logic |
| `package.json` | Update cody script path |

### Kept As-Is (12)
`agent-runner.ts`, `runner-backend.ts`, `stage-prompts.ts`, `content-validators.ts`, `git-utils.ts`, `clarify-workflow.ts` (minor import change), `audit-history.ts`, `logger.ts`, `preflight.ts`, `pipeline-utils.ts`, `scripted-stages.ts`, 3 shell scripts

### New Test Files (16)
| File | Tests |
|------|-------|
| `tests/unit/scripts/cody/engine/types.test.ts` | ~2 |
| `tests/unit/scripts/cody/engine/status.test.ts` | ~9 |
| `tests/unit/scripts/cody/engine/state-machine.test.ts` | ~13 |
| `tests/unit/scripts/cody/engine/pipeline-resolver.test.ts` | ~4 |
| `tests/unit/scripts/cody/engine/integration.test.ts` | ~9 |
| `tests/unit/scripts/cody/handlers/handler.test.ts` | ~3 |
| `tests/unit/scripts/cody/handlers/agent-handler.test.ts` | ~3 |
| `tests/unit/scripts/cody/handlers/scripted-handler.test.ts` | ~4 |
| `tests/unit/scripts/cody/handlers/git-handler.test.ts` | ~2 |
| `tests/unit/scripts/cody/handlers/gate-handler.test.ts` | ~3 |
| `tests/unit/scripts/cody/pipeline/definitions.test.ts` | ~7 |
| `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts` | ~6 |
| `tests/unit/scripts/cody/pipeline/post-actions.test.ts` | ~9 |
| `tests/unit/scripts/cody/pipeline/validators.test.ts` | ~3 |
| `tests/unit/scripts/cody/entry.test.ts` | ~12 |
| `tests/unit/scripts/cody/github-api.test.ts` | ~3 |
| `tests/unit/scripts/cody/cleanup.test.ts` | ~2 |
| **Total** | **~94** |

---

## Dependency Order

```
Step 1 (types) ─┬─→ Step 2 (status)
                ├─→ Step 3 (github-api)
                ├─→ Step 4 (validators)
                ├─→ Step 5 (definitions) ──→ Step 6 (skip-conditions)
                └─→ Step 7 (all handlers)
                          │
Steps 2-7 ───────────────→ Step 8 (post-actions)
                          │
Steps 2-8 ───────────────→ Step 9 (state machine engine)
                          │
Step 9 ──────────────────→ Step 10 (pipeline resolver)
                          │
Steps 9-10 ──────────────→ Step 11 (entry.ts)
                          │
Step 11 ─────────────────→ Step 12 (YAML + cleanup + test fixes)
                          │
Steps 1-12 ──────────────→ Step 13 (integration test)
```

## Quality Gates

After each step:
- `pnpm -s tsc --noEmit` — TypeScript compiles
- `pnpm test:unit -- --run tests/unit/scripts/cody/` — relevant tests pass

After Step 12:
- `pnpm -s tsc --noEmit` — full project compiles
- `pnpm -s lint` — no lint errors
- `pnpm test:unit -- --run` — all unit tests pass (including updated existing tests)

After Step 13:
- All 94+ new tests pass
- Integration tests demonstrate resume, rerun, pause, dry-run, two-phase rebuild, preExecute, parallel PipelinePausedError

## Known Tech Debt (not addressed in this rewrite)

- `git-utils.ts` `ensureFeatureBranch()` has 10 instances of `execSync` with template literals. Should migrate to `execFileSync` for defense-in-depth. (Security review finding — not a regression.)
- `github-api.ts` functions (`getIssue`, `getIssueBody`, etc.) use `execSync` with interpolated `issueNumber`. Safe because `issueNumber` is typed as `number`, but `execFileSync` would be more consistent.
- `formatStatusComment` renders v1 schema format. Long-term, the comment renderer should be updated to work with v2 natively instead of going through the `stateToV1` adapter.
- `ALL_STAGES` in `stage-prompts.ts` includes `autofix` but it's not a pipeline stage in the new architecture. It's only used for prompt generation — no functional issue but could be confusing.
