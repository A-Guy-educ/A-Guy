# Plan: Cody Pipeline System Test (v3)

**Task ID**: 260317-cody-system-test
**Task Type**: implement_feature
**Complexity**: 55

---

## Rerun Context

v3 — Scoped down to ship scenario 02 only (high-complexity full mode), plus a prerequisite fix to `--complexity` override.

Key decisions:
- **Only scenario 02** — the most important test. Exercises ALL pipeline stages. Other scenarios added incrementally later.
- **`--complexity` override must actually override** — currently silently ignored when taskify already set a value. Fixed as prerequisite.
- **`COMPLEXITY` added to `cody.yml`** — no way to pass it via dispatch today. Added as env var passthrough.
- **Self-contained** — creates issue, runs pipeline, verifies, cleans up.
- **Dynamic model override** — `jq` rewrites `opencode.json` on a temp branch, passed via `--version`. No persistent branch.
- **Inspector plugin triggers daily** — Slack notification on failure.

---

## Motivation

Cody runs on real issues daily and most of them fail. When a real issue fails, you can't tell why:

- Is the pipeline code broken? (stage ordering, skip logic, post-action bug, git push race)
- Did the LLM produce garbage? (hallucinated review findings, no source changes)
- Was the task genuinely hard? (complex multi-file changes, merge conflicts)
- Did infrastructure flake? (timeout, API rate limit, OpenCode crash)

The system test provides a **controlled baseline**. It runs a known-good task (docs-only, high complexity to exercise all stages) through the real pipeline with real LLM calls. If the system test passes but real issues fail → the problem is task complexity or LLM quality, not pipeline code. If the system test fails → the pipeline itself is broken.

---

## Research Findings

### File paths verified
- ✅ `scripts/cody/pipeline/post-actions.ts` (line 75) — complexity override with `=== undefined` guard
- ✅ `scripts/cody/modes/impl.ts` (line 40) — same `=== undefined` guard
- ✅ `scripts/cody/cli-parser.ts` (line 41, 264-268, 378-381) — `--complexity` flag and `COMPLEXITY` env var parsing
- ✅ `scripts/cody/cody-utils.ts` (line 41) — `complexityOverride?: number` in `CodyInput`
- ✅ `scripts/cody/env.ts` (line 36, 93) — `COMPLEXITY` env var schema
- ✅ `.github/workflows/cody.yml` (lines 417-450) — `Run Cody` step env vars (no COMPLEXITY)
- ✅ `scripts/inspector/index.ts` — plugin registration (145 lines)
- ✅ `scripts/inspector/core/types.ts` — interfaces (197 lines)
- ✅ `scripts/inspector/clients/github.ts` — GitHubClient (239 lines)
- ✅ `scripts/inspector/plugins/cody/deferred-tests/index.ts` — reference plugin pattern (224 lines)
- ✅ `.github/workflows/inspector.yml` — inspector cron (48 lines)
- ✅ `opencode.json` — model config (116 lines, 20 agents)
- ✅ `tests/canary/pipeline-canary.test.ts` — existing canary tests
- ✅ `tests/unit/scripts/cody/cody-pure-utils.test.ts` — CLI parsing tests
- ✅ `tests/unit/scripts/cody/complexity-scoring.test.ts` — complexity tests
- 🆕 `.github/workflows/cody-system-test.yml`
- 🆕 `scripts/system-test/lib/` — shared utilities
- 🆕 `scripts/system-test/scenarios/02-full-high-complexity.ts`
- 🆕 `scripts/system-test/run-scenario.ts`
- 🆕 `scripts/system-test/report-results.ts`
- 🆕 `scripts/system-test/cleanup-all.ts`
- 🆕 `scripts/inspector/plugins/cody/system-test/index.ts`

### Patterns observed
- Complexity override logic in two places: `post-actions.ts` (resolve-profile) and `modes/impl.ts`
- Both check `taskDef.complexity === undefined` before applying override — this is the bug
- `COMPLEXITY` env var already parsed in `cli-parser.ts` line 378 but never injected in `cody.yml`
- Inspector plugins: `{ name, description, domain, schedule, run(ctx) }` returning `ActionRequest[]`
- Workflow dispatch plugins use `ctx.github.triggerWorkflow()` with dedup via `dedupKey`

### Integration points
- `--complexity` fix: 2 files, 2 lines each (remove guard)
- `cody.yml`: add `COMPLEXITY` env var to `Run Cody` step
- Plugin registration: import + `registry.register()` in `scripts/inspector/index.ts`
- Workflow: must be on `dev`/`main` to be dispatchable

---

## Reuse Inventory

### Existing utilities to reuse
- `GitHubClient` from `scripts/inspector/clients/github.ts` — issue/PR/workflow operations
- `createGitHubClient()` from `scripts/inspector/clients/github.ts` — factory with PAT support
- `InspectorPlugin` interface from `scripts/inspector/core/types.ts` — plugin contract
- `StateStore` from `scripts/inspector/core/types.ts` — persist state across cycles
- `pino` logger

### New utilities (justification)
- `scripts/system-test/lib/poll.ts` — Synchronous wait for workflow completion. Inspector plugins are fire-and-forget. No existing poll utility.
- `scripts/system-test/lib/assertions.ts` — Assert GitHub artifacts (labels, PR, stage states). Domain-specific.
- `scripts/system-test/lib/cleanup.ts` — Multi-step cleanup with error tolerance.
- `scripts/system-test/lib/report.ts` — Markdown + Slack report generation.

---

## Step 0: Fix `--complexity` override to always override

**Files to touch**:
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — line 75)
- `scripts/cody/modes/impl.ts` (MODIFIED — line 40)
- `.github/workflows/cody.yml` (MODIFIED — add env var around line 440)

**Root cause**: `--complexity 65` is parsed correctly into `ctx.input.complexityOverride = 65`. But in both `post-actions.ts` (resolve-profile) and `modes/impl.ts`, the override is only applied when `taskDef.complexity === undefined`. In full mode, taskify always sets `complexity`, so the override is silently ignored.

**Fix (post-actions.ts line 75)**:
```typescript
// BEFORE:
if (ctx.input.complexityOverride !== undefined && taskDef.complexity === undefined) {
// AFTER:
if (ctx.input.complexityOverride !== undefined) {
```
Also update the log message to indicate it's overriding an existing value:
```typescript
logger.info(`  ℹ️ Complexity override: ${taskDef.complexity} → ${ctx.input.complexityOverride}`)
```
Also persist the override to `task.json` so the file on disk reflects the actual complexity used (write it back after setting).

**Fix (modes/impl.ts line 40)**: Same change — remove `&& taskDef.complexity === undefined`.

**Fix (cody.yml ~line 440)**: Add `COMPLEXITY` env var to the `Run Cody` step, sourced from a new workflow_dispatch input:
```yaml
# In workflow_dispatch inputs (after 'version'):
complexity:
  description: 'Override complexity score (1-100) for testing'
  required: false
  type: string
  default: ''

# In parse job outputs:
complexity: ${{ steps.parse.outputs.complexity }}

# In orchestrate job, Run Cody step env:
COMPLEXITY: ${{ needs.parse.outputs.complexity }}
```

Also update `parse-inputs.ts` to forward the dispatch input:
```typescript
// In parseDispatchInputs():
complexity: process.env.DISPATCH_COMPLEXITY || '',
```

Wait — actually checking the flow more carefully: the `COMPLEXITY` env var is already read by `cli-parser.ts` (line 378). We just need to pass it through in `cody.yml`. The simplest approach: add `DISPATCH_COMPLEXITY` to the dispatch inputs, pass it as `COMPLEXITY` env var to the orchestrate job. No changes to `parse-inputs.ts` needed since `cli-parser.ts` reads `COMPLEXITY` directly.

**Tests (FAIL before, PASS after)**:

- `tests/unit/scripts/cody/complexity-override.test.ts` (NEW):
  - `override replaces existing taskDef.complexity` — set `taskDef.complexity = 20`, `ctx.input.complexityOverride = 65`, verify `taskDef.complexity` becomes 65 after resolve-profile
  - `override works when taskDef.complexity is undefined` — same as before (regression check)
  - `override updates complexity_reasoning` — verify reasoning string mentions "Override"
  - `no override when complexityOverride not set` — verify original complexity preserved

**Acceptance criteria**:
- [ ] `--complexity 65` overrides taskify's score even when taskify set a value
- [ ] `cody.yml` passes `COMPLEXITY` env var from dispatch input to orchestrate job
- [ ] Existing tests still pass
- [ ] New unit tests pass

---

## Step 1: Create shared test library (`scripts/system-test/lib/`)

**Files to touch**:
- `scripts/system-test/lib/config.ts` (NEW)
- `scripts/system-test/lib/gh-client.ts` (NEW)
- `scripts/system-test/lib/poll.ts` (NEW)
- `scripts/system-test/lib/assertions.ts` (NEW)
- `scripts/system-test/lib/cleanup.ts` (NEW)
- `scripts/system-test/lib/report.ts` (NEW)
- `scripts/system-test/lib/index.ts` (NEW)

### `config.ts`
- `SYSTEM_TEST_LABEL = 'system-test'`
- `ISSUE_TITLE_PREFIX = '[SYSTEM-TEST]'`
- `POLL_INTERVAL_MS = 30_000` (30s)
- `MAX_POLL_MS = 90 * 60_000` (90 min)
- `CODY_WORKFLOW = 'cody.yml'`
- `SYSTEM_TEST_WORKFLOW = 'cody-system-test.yml'`

### `gh-client.ts`
- `createSystemTestClient(repo: string): GitHubClient` — uses `GH_TOKEN` + `GH_PAT` from env. Reuses `createGitHubClient` from inspector.

### `poll.ts`
- `pollWorkflowRun(gh, opts: { workflow, afterTimestamp, matchBranch?, maxWaitMs, intervalMs }): Promise<WorkflowRun>` — polls `listWorkflowRuns()` for completed run after timestamp. Throws `TimeoutError` on expiry.
- `pollForComment(gh, issueNumber, pattern: RegExp, maxWaitMs): Promise<IssueComment>` — polls until comment matches.
- `sleep(ms): Promise<void>`

### `assertions.ts`
- `assertLabelsPresent(gh, issueNumber, labels: string[]): void`
- `assertPRCreated(repo, branchPattern: RegExp): { number, branch, title }`
- `assertStageStates(statusJson, expected: Record<string, 'completed' | 'skipped'>): void`
- `assertCommentExists(gh, issueNumber, pattern: RegExp): void`
- `assertWorkflowSucceeded(run: WorkflowRun): void`

### `cleanup.ts`
- `cleanupScenario(gh, repo, opts: { issueNumber?, prNumbers?, branches? }): Promise<void>` — closes issue, PRs, deletes branches. Each try/catch'd.
- `cleanupAllSystemTests(gh, repo): Promise<{ closedIssues, closedPRs, deletedBranches }>` — idempotent safety net using `system-test` label search.

### `report.ts`
- `ScenarioResult = { name, passed, duration, assertions: { name, passed, detail? }[], error? }`
- `generateReport(results: ScenarioResult[]): string` — markdown table
- `generateSlackPayload(results: ScenarioResult[], workflowUrl: string): object` — Slack block-kit

**Tests (FAIL before, PASS after)**:
- `tests/unit/scripts/system-test/poll.test.ts`:
  - `pollWorkflowRun returns completed run after polling` — mock returns empty then match
  - `pollWorkflowRun throws TimeoutError` — mock always empty
  - `pollForComment returns matching comment` — mock with matching pattern
- `tests/unit/scripts/system-test/assertions.test.ts`:
  - `assertLabelsPresent passes when all labels exist`
  - `assertLabelsPresent throws when label missing`
  - `assertStageStates passes with matching states`
  - `assertStageStates throws on mismatch`
- `tests/unit/scripts/system-test/cleanup.test.ts`:
  - `cleanupScenario closes issue and PR`
  - `cleanupScenario tolerates individual failures`
- `tests/unit/scripts/system-test/report.test.ts`:
  - `generateReport produces markdown table`
  - `generateSlackPayload includes workflow URL`

**Acceptance criteria**:
- [ ] All utilities exported and typed (no `any`)
- [ ] `pnpm vitest run tests/unit/scripts/system-test/` — all pass

---

## Step 2: Create scenario 02 — high-complexity full mode

**Files to touch**:
- `scripts/system-test/scenarios/types.ts` (NEW)
- `scripts/system-test/scenarios/02-full-high-complexity.ts` (NEW)
- `scripts/system-test/run-scenario.ts` (NEW)

### `types.ts`
```typescript
export interface ScenarioContext {
  gh: GitHubClient
  repo: string
  runId: string
  versionBranch: string
  log: Logger
}

export interface Scenario {
  name: string
  description: string
  timeoutMs: number
  run(ctx: ScenarioContext): Promise<ScenarioResult>
}
```

### Scenario 02: High-complexity full mode

**Goal**: Exercise ALL pipeline stages end-to-end with real LLM calls on a controlled task.

**Issue body**:
> Create a new documentation file `docs/system-test/pipeline-health.md` that documents the Cody pipeline health monitoring architecture. Include:
> 1. An overview section describing the inspector plugin framework
> 2. A section on each health-check plugin and what it monitors
> 3. A section on the pipeline-fixer retry strategy
> 4. A section on deferred test and docs stages
> 5. A troubleshooting guide for common failure modes
> 6. Architecture diagrams in mermaid syntax
>
> This documentation should be comprehensive (2000+ words) and reference actual file paths in the codebase.
>
> **This is a SYSTEM TEST. The PR should NOT be merged.**

The issue body is designed to be a genuine `implement_feature` task with docs scope. The `--complexity 65` flag guarantees all stages fire regardless of what taskify scores.

**Steps**:
1. Create issue: `gh.createIssue('[SYSTEM-TEST] Document pipeline health monitoring architecture', body, ['system-test'])`
2. Dispatch pipeline: `gh.triggerWorkflow('cody.yml', { task_id: <auto>, mode: 'full', issue_number: <issueNumber>, version: <versionBranch>, complexity: '65' })`
   - `--complexity 65` forces standard profile with ALL stages
   - `--version <versionBranch>` overlays cheap models
   - Uses dispatch (not comment) so we can pass complexity
3. Poll for workflow completion (timeout: 90 min)
4. Verify outcomes

**Assertions**:
- `assertWorkflowSucceeded(run)` — workflow conclusion is `success`
- `assertLabelsPresent(issueNumber, ['cody:done'])` — pipeline completed
- `assertLabelsPresent(issueNumber, ['profile:standard'])` — standard profile (complexity 65 ≥ 35)
- Issue has at least one `type:*` label
- Issue has at least one `risk:*` label
- Issue has `complexity:complex` label (65 is in the complex tier)
- `assertPRCreated(repo, /systest|system/)` — PR exists
- `assertCommentExists(issueNumber, /Task created/)` — task marker comment
- Via workflow artifacts: `status.json` has `state: completed`
- Via workflow artifacts: stages `taskify`, `gap`, `architect`, `plan-gap`, `build`, `commit`, `review`, `verify`, `pr` are all `completed`

**Cleanup**: Close issue (reason: 'not planned'), close PR, delete branch.

### `run-scenario.ts`
- Usage: `pnpm tsx scripts/system-test/run-scenario.ts --scenario <name> --repo <repo> --run-id <id> --version-branch <branch>`
- Creates `ScenarioContext` from args + env
- Dynamically imports scenario module
- Runs scenario, catches errors
- Always runs cleanup
- Writes result JSON to `./system-test-result-<name>.json`
- Exit 0 on pass, 1 on fail

**Acceptance criteria**:
- [ ] Scenario creates issue, dispatches pipeline with `complexity: '65'`, polls for completion
- [ ] All assertions verify structural outcomes (stages ran, PR exists, labels set)
- [ ] Cleanup runs even on failure
- [ ] `run-scenario.ts` works as CLI entry point

---

## Step 3: Create the GitHub Actions workflow

**Files to touch**:
- `.github/workflows/cody-system-test.yml` (NEW)
- `scripts/system-test/report-results.ts` (NEW)
- `scripts/system-test/cleanup-all.ts` (NEW)

### Workflow: `cody-system-test.yml`

**Trigger**:
```yaml
on:
  workflow_dispatch:
    inputs:
      scenarios:
        description: 'Scenario names (comma-separated) or "all"'
        type: string
        default: 'all'
      cleanup:
        description: 'Cleanup test artifacts'
        type: boolean
        default: true
```

**Concurrency**: `group: cody-system-test`, `cancel-in-progress: true`

**Permissions**: `issues: write`, `pull-requests: write`, `contents: write`, `actions: write`

**Jobs**:

**`setup`** (5 min):
- Checkout, install deps
- Generate `run_id` from timestamp: `date +%s`
- Create branch `systest/<run_id>` from HEAD
- `jq '.agent |= with_entries(.value.model = "minimax-coding-plan/MiniMax-M2.5")' opencode.json > tmp.json && mv tmp.json opencode.json`
- Keep architect and review on opus for quality: `jq '.agent.architect.model = "anthropic/claude-opus-4-6" | .agent.review.model = "anthropic/claude-opus-4-6" | .agent["plan-gap"].model = "anthropic/claude-opus-4-6"' opencode.json > tmp.json && mv tmp.json opencode.json`
- Commit + push branch
- Output: `run_id`, `version_branch`

**`scenario-02`** (120 min, needs: setup):
- `pnpm tsx scripts/system-test/run-scenario.ts --scenario 02-full-high-complexity --repo $REPO --run-id $RUN_ID --version-branch $VERSION_BRANCH`
- `continue-on-error: true`
- Upload result artifact

**`report`** (10 min, needs: scenario-02, if: always()):
- Download result artifacts
- `pnpm tsx scripts/system-test/report-results.ts --results-dir ./results`
- Post to `$GITHUB_STEP_SUMMARY`
- Slack notification if failed + `SLACK_WEBHOOK_URL` set
- Exit 1 if any scenario failed

**`cleanup`** (15 min, needs: scenario-02, if: always() && inputs.cleanup):
- `pnpm tsx scripts/system-test/cleanup-all.ts --repo $REPO --run-id $RUN_ID`
- Delete `systest/<run_id>` branch

### `report-results.ts`
- Reads `system-test-result-*.json` files from `--results-dir`
- Calls `generateReport()` for markdown
- Writes to `$GITHUB_STEP_SUMMARY` if env var set
- If any failed + `SLACK_WEBHOOK_URL`: sends Slack webhook (simple `fetch` POST)
- Exit code: 0 all pass, 1 any fail

### `cleanup-all.ts`
- `--repo <repo> --run-id <id>`
- Calls `cleanupAllSystemTests()` to close all `system-test` labeled issues
- Deletes branch `systest/<run_id>` via `gh api -X DELETE`
- Tolerates all errors (cleanup is best-effort)

**Acceptance criteria**:
- [ ] Workflow YAML is syntactically valid
- [ ] Setup creates temp branch with cheap models (opus for architect/review)
- [ ] Scenario job runs with correct env vars
- [ ] Report job generates summary + Slack on failure
- [ ] Cleanup deletes all test artifacts

---

## Step 4: Create the inspector plugin

**Files to touch**:
- `scripts/inspector/plugins/cody/system-test/index.ts` (NEW)
- `scripts/inspector/index.ts` (MODIFIED — add import + registration)

### Plugin: `cody-system-test`
- **name**: `'cody-system-test'`
- **description**: `'Daily system test of the full Cody pipeline'`
- **domain**: `'cody'`
- **schedule**: `{ every: 288 }` — every 288th cycle ≈ 24 hours

### `run(ctx)` logic:
1. `lastRunDate = ctx.state.get<string>('systemTest:lastRunDate')` — skip if today
2. Check `listWorkflowRuns('cody-system-test.yml', { status: 'in_progress' })` — skip if one is running
3. Return action to dispatch `cody-system-test.yml`

### Action:
- `dedupKey: 'system-test:daily'`, `dedupWindowMinutes: 1380` (23h)
- `execute()`: `ctx.github.triggerWorkflow('cody-system-test.yml', { scenarios: 'all', cleanup: 'true' })`

### Registration:
- Import after `apiSurfaceAuditorPlugin`
- Register: `registry.register(systemTestPlugin)`

**Tests (FAIL before, PASS after)**:
- `tests/unit/scripts/inspector/system-test-plugin.test.ts`:
  - `returns action when not run today`
  - `returns empty when already ran today`
  - `skips when workflow already in progress`
  - `schedule is every 288 cycles`
  - `dedup window is 23 hours`

**Acceptance criteria**:
- [ ] Plugin registered in `scripts/inspector/index.ts`
- [ ] Daily frequency via state + dedup
- [ ] Skips if workflow already running
- [ ] Unit tests pass

---

## Step 5: Documentation

**Files to touch**:
- `scripts/system-test/README.md` (NEW)

### Contents:
1. What it tests — scenario 02 (high-complexity full pipeline, all stages)
2. How to run: `gh workflow run cody-system-test.yml`
3. How to run locally: `pnpm tsx scripts/system-test/run-scenario.ts --scenario 02-full-high-complexity --repo <repo> --run-id local-001 --version-branch dev`
4. Model override strategy — dynamic jq, opus for architect/review
5. Complexity override — `--complexity 65` guarantees all stages
6. Inspector integration — daily trigger
7. Cost estimates — ~$3-5 per run (minimax bulk + opus for 3 stages)
8. Adding new scenarios — follow `Scenario` interface
9. Troubleshooting

**Acceptance criteria**:
- [ ] README is accurate and complete
- [ ] Includes run instructions and cost estimates

---

## Dependency Graph

```
Step 0 (complexity fix) ──> Step 2 (scenario 02) ──> Step 3 (workflow)
                                     │
Step 1 (lib) ────────────────────────┘                Step 4 (inspector plugin)
                                                      Step 5 (docs)
```

Steps 0 and 1 are independent and can be done in parallel.
Steps 4 and 5 are independent of each other and of step 3.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Test creates real issues/PRs | Labeled `system-test`; cleanup on `always()` |
| LLM cost per run (~$3-5) | Minimax for most stages; daily frequency |
| `--complexity 65` but taskify scores it as docs | Override now forces 65 regardless (Step 0 fix) |
| MiniMax produces bad plans/code | Architect/review/plan-gap kept on opus; task is docs-only (low code quality bar) |
| Orphaned artifacts | `cleanupAllSystemTests()` idempotent safety net |
| System test takes >120 min | 120 min job timeout; task is docs-only so should be fast |
| Concurrent with real pipeline | Different concurrency groups |

---

## Assumptions

1. `GH_PAT` secret available (required for `triggerWorkflow`)
2. All LLM API keys available as repository secrets
3. `SLACK_WEBHOOK_URL` available for failure notifications
4. MiniMax model capable enough for docs-only task
5. `cody-system-test.yml` must be on `dev`/`main` before first dispatch
6. Complexity override fix (Step 0) is safe — only changes behavior when `--complexity` flag is explicitly passed
