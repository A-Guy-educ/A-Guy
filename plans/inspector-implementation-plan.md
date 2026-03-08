# Inspector Implementation Plan

## Overview

Build a **generic, plugin-driven periodic evaluation engine** (`scripts/inspector/`) that replaces both `scripts/watchdog/` and `scripts/supervisor/`. Phase 1 ships with two Cody-domain plugins (`health-check` and `audit`). The pipeline is updated to remove the `auditor` and `apply-audit` stages.

---

## Vision

The Inspector is a **plugin-driven periodic evaluation engine** — a heartbeat that runs every 5 minutes, discovers data relevant to each plugin, evaluates it, and takes action. It knows nothing about Cody, GitHub issues, or pipelines — it's a framework where plugins provide domain-specific logic.

```
┌─────────────────────────────────────────────┐
│              Inspector Core                  │
│                                             │
│  Schedule → Load Plugins → Run → Deliver    │
│                                             │
│  - Plugin registry                          │
│  - State persistence (generic key-value)    │
│  - Action execution                         │
│  - Notification delivery (channels)         │
│  - Dedup / rate limiting                   │
│  - Logging                                  │
└──────────┬──────────┬──────────┬───────────┘
            │          │          │
      ┌─────┴──┐  ┌────┴───┐  �──┴──────────┐
      │ cody/  │  │ infra/ │  │ app-health/ │
      │health  │  │monitor │  │  (future)   │
      │check   │  │(future)│  │             │
      ├────────┤  └────────┘  └─────────────┘
      │ cody/  │
      │ audit  │
      └────────┘
```

---

## Part 1: Core Framework

### Step 1.1 — Core Types (`scripts/inspector/core/types.ts`)

Domain-agnostic types — no Cody knowledge.

```typescript
interface InspectorPlugin {
  name: string
  description: string
  domain: string
  schedule?: PluginSchedule
  run(ctx: InspectorContext): Promise<ActionRequest[]>
}

interface ActionRequest {
  plugin: string
  type: string
  target?: string
  urgency: Urgency
  title: string
  detail: string
  dedupKey?: string
  dedupWindowMinutes?: number // default: 60
  execute: (ctx: InspectorContext) => Promise<ActionResult>
}

interface ActionResult {
  success: boolean
  message?: string
}

interface InspectorContext {
  repo: string
  dryRun: boolean
  state: StateStore
  github: GitHubClient
  log: Logger
  runTimestamp: string
}

interface StateStore {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  save(): void
}

interface PluginSchedule {
  every?: number // Run every N cycles (default: 1)
}

type Urgency = 'critical' | 'warning' | 'info' | 'silent'
type Logger = Pick<pino.Logger, 'info' | 'warn' | 'error' | 'debug'>

interface GitHubClient {
  postComment(issueNumber: number, body: string): void
  getIssue(issueNumber: number): { body: string | null; title: string | null }
  getOpenIssues(labels?: string[]): IssueInfo[]
  triggerWorkflow(workflow: string, inputs: Record<string, string>): void
  addLabel(issueNumber: number, label: string): void
  removeLabel(issueNumber: number, label: string): void
  setLifecycleLabel(issueNumber: number, label: string): void
  closeIssue(issueNumber: number, reason?: string): void
  getIssueComments(issueNumber: number): IssueComment[]
}

interface IssueInfo {
  number: number
  title: string
  labels: string[]
  updatedAt: string
}

interface IssueComment {
  id: number
  body: string
  author: string
  createdAt: string
}
```

**Tests** (`tests/unit/scripts/inspector/core/types.test.ts`):

- Type guards for `ActionRequest` validation
- `Urgency` enum coverage

### Step 1.2 — State Store (`scripts/inspector/core/state.ts`)

JSON-backed key-value store persisted to `.inspector/state.json`. Namespaced by plugin domain.

```typescript
class JsonStateStore implements StateStore {
  constructor(filePath: string)
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  save(): void
  static load(filePath: string): JsonStateStore
}
```

**Tests** (`tests/unit/scripts/inspector/core/state.test.ts`):

- Read/write primitives (string, number, boolean)
- Read/write objects and arrays
- Get missing key returns undefined
- Persistence: save then load recovers data
- Atomic write safety (temp file pattern)
- Handle corrupt JSON file (returns empty store)
- Handle missing file (returns empty store)
- Namespaced keys don't collide (`cody:x` vs `infra:x`)

### Step 1.3 — Dedup (`scripts/inspector/core/dedup.ts`)

Prevents duplicate actions within a time window, using in-memory state + comment marker scanning.

```typescript
function shouldDedup(action: ActionRequest, ctx: InspectorContext): boolean
function markExecuted(action: ActionRequest, ctx: InspectorContext): void
```

State key pattern: `dedup:<dedupKey>:<timestamp>`

**Tests** (`tests/unit/scripts/inspector/core/dedup.test.ts`):

- Action without dedupKey is never deduped
- Action with dedupKey is deduped within window
- Action with dedupKey is NOT deduped after window expires
- Different dedupKeys don't interfere
- Default window is 60 minutes
- Custom window is respected

### Step 1.4 — GitHub Client (`scripts/inspector/clients/github.ts`)

Thin wrapper around `scripts/cody/github-api.ts` functions, conforming to `GitHubClient` interface.

New methods not in existing `github-api.ts`:

- `getOpenIssues(labels?)` — query via `gh api repos/{repo}/issues`
- `triggerWorkflow(workflow, inputs)` — `gh workflow run`
- `getIssueComments(issueNumber)` — `gh api repos/{repo}/issues/{N}/comments --paginate`

Delegates to existing `github-api.ts` for: `postComment`, `getIssue`, `addIssueLabel`, `removeIssueLabel`, `setLifecycleLabel`, `closeIssue`.

**Tests** (`tests/unit/scripts/inspector/clients/github.test.ts`):

- `getOpenIssues` parses paginated JSON correctly
- `getOpenIssues` with label filter
- `getOpenIssues` handles empty response
- `triggerWorkflow` calls `execFileSync` with correct args
- `triggerWorkflow` in dry-run mode skips execution
- `getIssueComments` paginates correctly

### Step 1.5 — Plugin Registry (`scripts/inspector/plugins/registry.ts`)

```typescript
class PluginRegistry {
  register(plugin: InspectorPlugin): void
  getAll(): InspectorPlugin[]
  getByDomain(domain: string): InspectorPlugin[]
  getScheduled(cycleNumber: number): InspectorPlugin[]
}
```

**Tests** (`tests/unit/scripts/inspector/plugins/registry.test.ts`):

- Register and retrieve plugin
- Multiple plugins from same domain
- `getScheduled` respects `every` field
- `getScheduled` returns all plugins with no schedule override
- Duplicate registration throws

### Step 1.6 — Main Loop (`scripts/inspector/core/inspector.ts`)

```typescript
async function runInspector(config: InspectorConfig): Promise<InspectorResult>

interface InspectorResult {
  cycleNumber: number
  pluginsRun: number
  actionsProduced: number
  actionsExecuted: number
  actionsDeduplicated: number
  errors: string[]
}
```

Flow:

1. Load state from `.inspector/state.json`
2. Increment cycle number
3. Get scheduled plugins for this cycle
4. For each plugin: `try { plugin.run(ctx) } catch { log error, continue }`
5. Collect all `ActionRequest[]`
6. Dedup
7. Execute (skip if `dryRun`)
8. Save state
9. Return summary

**Tests** (`tests/unit/scripts/inspector/core/inspector.test.ts`):

- Runs all registered plugins
- Plugin error doesn't kill other plugins (error isolation)
- Dedup prevents duplicate actions
- Dry run skips execution
- State is persisted after run
- Cycle number increments
- `InspectorResult` counts are accurate
- Empty plugin registry completes without error
- Plugin with `schedule.every: 3` runs only on matching cycles

### Step 1.7 — Entry Point (`scripts/inspector/index.ts`)

CLI entry point that:

1. Reads env vars (`REPO`, `GH_TOKEN`, `DRY_RUN`, etc.)
2. Creates `InspectorConfig`
3. Registers all plugins
4. Calls `runInspector(config)`
5. Logs result summary
6. Exits with code 0 (even on plugin errors — only infrastructure failures exit 1)

**Tests** (`tests/unit/scripts/inspector/index.test.ts`):

- Missing REPO env var exits with error
- Missing GH_TOKEN env var exits with error
- DRY_RUN=true sets config.dryRun
- Registers all expected plugins

---

## Part 2: Cody Health-Check Plugin

### Step 2.1 — Task Discovery (`scripts/inspector/plugins/cody/health-check/discovery.ts`)

```typescript
interface TaskSnapshot {
  taskId: string
  issueNumber: number
  issueTitle: string
  labels: string[]
  status: PipelineStateV2 | null
  issueUpdatedAt: string
  statusUpdatedAt: string | null
}

async function discoverTasks(ctx: InspectorContext): Promise<TaskSnapshot[]>
```

Discovery flow:

1. `ctx.github.getOpenIssues()` — all open issues
2. Filter to issues with any `cody:*` lifecycle label
3. For each, extract taskId from title (regex) or `discoverTaskIdFromIssue()`
4. Read `.tasks/<taskId>/status.json` via `getTaskDir()` + `fs.readFileSync`
5. Validate with `isPipelineStateV2()`
6. Return `TaskSnapshot[]`

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/discovery.test.ts`):

- Discovers tasks from open issues with cody labels
- Filters out issues without cody labels
- Handles missing status.json (status = null)
- Handles corrupt status.json
- Extracts taskId from issue title regex
- Falls back to `discoverTaskIdFromIssue` for marker comments
- Handles zero open issues

### Step 2.2 — Health Evaluator (`scripts/inspector/plugins/cody/health-check/evaluator.ts`)

```typescript
type TaskHealth = 'healthy' | 'completed' | 'stalled' | 'failed' | 'gated' | 'orphaned' | 'unknown'

interface EvaluatedTask extends TaskSnapshot {
  health: TaskHealth
  healthDetail: string
  stalledMinutes?: number
  gatedMinutes?: number
  failedStage?: string
  failedError?: string
}

function evaluateHealth(task: TaskSnapshot, ctx: InspectorContext): EvaluatedTask
```

Classification rules:
| Status | Additional Condition | Health |
|---|---|---|
| `status === null` | — | `unknown` |
| `state === 'completed'` | — | `completed` |
| `state === 'paused'` | — | `gated` |
| `state === 'failed'` or `'timeout'` | — | `failed` |
| `state === 'running'` | updatedAt > 20 min ago + workflow done | `orphaned` |
| `state === 'running'` | updatedAt > 20 min ago | `stalled` |
| `state === 'running'` | updatedAt < 20 min ago | `healthy` |

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/evaluator.test.ts`):

- `completed` state → `completed` health
- `paused` state → `gated` health with `gatedMinutes`
- `failed` state → `failed` health with `failedStage` and `failedError`
- `timeout` state → `failed` health
- `running` + recent update → `healthy`
- `running` + stale update (> 20 min) → `stalled` with `stalledMinutes`
- `running` + stale + orphaned workflow → `orphaned`
- `null` status → `unknown`
- Computes `stalledMinutes` correctly
- Computes `gatedMinutes` correctly
- Extracts failed stage name from `stages` record

### Step 2.3 — Retry Action (`scripts/inspector/plugins/cody/health-check/actions/retry.ts`)

Absorbs `scripts/supervisor/supervisor.ts` logic.

```typescript
function createRetryAction(task: EvaluatedTask, ctx: InspectorContext): ActionRequest | null
```

Flow:

1. Check retry count from state (`cody:retries:<taskId>`)
2. If >= 3, return null (exhausted)
3. Call `classifyRetryability(failedStage, error)` — if non-retryable, return null
4. Read task files: `verify.md`, `{failedStage}.md`, `rerun-feedback.md`
5. Call `analyzeFailure()` for LLM analysis
6. Build `ActionRequest` with `execute()` that:
   - Posts analysis comment
   - Triggers `gh workflow run cody.yml` with rerun params
   - Increments retry count in state

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/actions/retry.test.ts`):

- Creates retry action for failed task
- Returns null when max retries (3) exhausted
- Returns null for non-retryable failures (infrastructure)
- Calls `analyzeFailure` with correct input
- Uses `resolveFromStage` mapping
- Execute triggers workflow with correct parameters
- Execute posts analysis comment to issue
- Execute increments retry count in state
- Dedup key prevents duplicate retries within window
- Reads task files correctly
- Handles missing task files gracefully

### Step 2.4 — Nudge Action (`scripts/inspector/plugins/cody/health-check/actions/nudge.ts`)

Absorbs `scripts/watchdog/checks/gate-reminders.ts`.

```typescript
function createNudgeAction(task: EvaluatedTask, ctx: InspectorContext): ActionRequest | null
```

Flow:

1. If `health !== 'gated'` or `gatedMinutes < 30`, return null
2. Determine urgency: > 120 min = critical, else warning
3. Return `ActionRequest` with `execute()` that posts reminder comment

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/actions/nudge.test.ts`):

- Returns null for non-gated tasks
- Returns null for gated < 30 minutes
- Creates nudge at 30+ minutes with warning urgency
- Creates nudge at 120+ minutes with critical urgency
- Comment includes `/cody approve` instruction
- Dedup key prevents reminder spam (1 per hour)

### Step 2.5 — Digest Action (`scripts/inspector/plugins/cody/health-check/actions/digest.ts`)

New functionality — periodic status summary.

```typescript
function createDigestAction(tasks: EvaluatedTask[], ctx: InspectorContext): ActionRequest | null
```

Flow:

1. Aggregate health counts: healthy, stalled, failed, gated, completed, unknown
2. If all tasks are healthy/completed, return `silent` urgency (no post)
3. Build markdown summary table
4. Return `ActionRequest` that posts digest to watchdog issue

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/actions/digest.test.ts`):

- Returns silent when all tasks healthy
- Creates digest with correct counts
- Includes task links in digest table
- Posts to watchdog issue number
- Dedup prevents multiple digests within window (30 min)
- Empty task list returns null

### Step 2.6 — Health-Check Plugin (`scripts/inspector/plugins/cody/health-check/index.ts`)

```typescript
const healthCheckPlugin: InspectorPlugin = {
  name: 'cody-health-check',
  description: 'Monitor Cody pipeline health and take corrective action',
  domain: 'cody',

  async run(ctx) {
    const tasks = await discoverTasks(ctx)
    const evaluated = tasks.map((t) => evaluateHealth(t, ctx))

    const actions: ActionRequest[] = []

    for (const task of evaluated) {
      if (task.health === 'failed' || task.health === 'orphaned') {
        const retry = createRetryAction(task, ctx)
        if (retry) actions.push(retry)
      }
      if (task.health === 'gated') {
        const nudge = createNudgeAction(task, ctx)
        if (nudge) actions.push(nudge)
      }
    }

    const digest = createDigestAction(evaluated, ctx)
    if (digest) actions.push(digest)

    return actions
  },
}
```

**Tests** (`tests/unit/scripts/inspector/plugins/cody/health-check/index.test.ts`):

- Plugin produces retry action for failed task
- Plugin produces nudge action for gated task
- Plugin produces digest action
- Plugin handles mixed health states correctly
- Plugin handles zero tasks
- Plugin handles discovery failure gracefully

---

## Part 3: Cody Audit Plugin

### Step 3.1 — Audit Analyzer (`scripts/inspector/plugins/cody/audit/analyzer.ts`)

Reuses the auditor agent's analysis approach but calls MiniMax directly instead of going through OpenCode.

```typescript
interface AuditInput {
  taskId: string
  taskMd: string
  specMd: string
  buildMd: string
  verifyMd: string
}

interface AuditResult {
  improvements: Improvement[]
  stageQuality: Record<string, string>
}

interface Improvement {
  type: string
  title: string
  where: string
  rationale: string
}

async function analyzeRun(input: AuditInput): Promise<AuditResult>
```

**Tests** (`tests/unit/scripts/inspector/plugins/cody/audit/analyzer.test.ts`):

- Calls MiniMax with correct prompt structure
- Parses JSON response into `AuditResult`
- Handles empty/malformed LLM response
- Handles missing task files
- Returns empty improvements for clean runs
- Respects mock/fallback when no API key

### Step 3.2 — Create Issue Action (`scripts/inspector/plugins/cody/audit/actions/create-issue.ts`)

```typescript
function createImprovementIssueAction(
  taskId: string,
  improvement: Improvement,
  ctx: InspectorContext,
): ActionRequest
```

Creates a GitHub issue with:

- Title: `[audit] <improvement.title>`
- Labels: `type:chore`, `cody:audit`
- Body: Rationale, file path, originating task

**Tests** (`tests/unit/scripts/inspector/plugins/cody/audit/actions/create-issue.test.ts`):

- Creates issue with correct title and labels
- Issue body includes rationale and file path
- Issue body links to originating task
- Dedup prevents duplicate issues for same improvement

### Step 3.3 — Audit Plugin (`scripts/inspector/plugins/cody/audit/index.ts`)

```typescript
const auditPlugin: InspectorPlugin = {
  name: 'cody-audit',
  description: 'Analyze completed pipeline runs and create improvement issues',
  domain: 'cody',
  schedule: { every: 3 }, // Every 3rd cycle (15 min)

  async run(ctx) {
    const tasks = await discoverTasks(ctx)
    const audited = ctx.state.get<string[]>('cody:auditedTasks') || []

    const actions: ActionRequest[] = []

    for (const task of tasks) {
      if (task.status?.state !== 'completed') continue
      if (audited.includes(task.taskId)) continue

      const input = readTaskFiles(task.taskId)
      const result = await analyzeRun(input)

      for (const improvement of result.improvements) {
        actions.push(createImprovementIssueAction(task.taskId, improvement, ctx))
      }

      ctx.state.set('cody:auditedTasks', [...audited, task.taskId])
    }

    return actions
  },
}
```

**Tests** (`tests/unit/scripts/inspector/plugins/cody/audit/index.test.ts`):

- Audits newly completed tasks
- Skips already-audited tasks
- Skips non-completed tasks
- Creates improvement issues from audit results
- Marks task as audited in state after execution
- Handles zero completed tasks
- Handles analyzer failure gracefully

---

## Part 4: Pipeline Changes (Remove Auditor/Apply-Audit)

### Step 4.1 — Remove Pipeline Stages

Files to modify:

| File                                       | Change                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/cody/pipeline/definitions.ts`     | Remove from `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`, delete stage definitions, remove `skipIfNoAuditorOutput` import     |
| `scripts/cody/pipeline-utils.ts`           | Remove from `NON_SKIPPABLE_STAGES`, `STAGE_COMPLEXITY_THRESHOLDS`, `IMPL_PIPELINE`, `LIGHTWEIGHT_IMPL_PIPELINE`, dry-run outputs |
| `scripts/cody/stage-prompts.ts`            | Remove from `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`                                                             |
| `scripts/cody/pipeline/post-actions.ts`    | Remove `commit-audit-history` case                                                                                               |
| `scripts/cody/pipeline/skip-conditions.ts` | Remove `skipIfNoAuditorOutput` function                                                                                          |
| `scripts/cody/engine/types.ts`             | Remove `CommitAuditHistoryAction` type and from `PostAction` union                                                               |
| `scripts/cody/agent-runner.ts`             | Remove from `STAGE_TIMEOUTS`                                                                                                     |
| `scripts/cody/audit-history.ts`            | Delete file                                                                                                                      |
| `scripts/supervisor/supervisor.ts`         | Remove `apply-audit → auditor` routing                                                                                           |
| `opencode.json`                            | Remove `auditor` and `apply-audit` agent entries                                                                                 |
| `.opencode/agents/auditor.md`              | Delete file                                                                                                                      |
| `.opencode/agents/apply-audit.md`          | Delete file                                                                                                                      |
| `.opencode/agents/taskify.md`              | Remove auditor/apply-audit from complexity tier docs                                                                             |
| `src/ui/cody/constants.ts`                 | Remove from `IMPL_STAGES`                                                                                                        |
| `src/ui/cody/pipeline-utils.ts`            | Remove from `stageLabels` and `stageMaxDurations`                                                                                |
| `src/ui/cody/agents.ts`                    | Remove from pipeline description                                                                                                 |
| `.opencode/PIPELINE.md`                    | Update pipeline documentation                                                                                                    |

### Step 4.2 — Update Existing Tests

| Test File                                             | Change                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/unit/scripts/cody/stage-prompts.test.ts`       | Update `ALL_STAGES` length expectation (13→11), remove auditor/apply-audit context file tests |
| `tests/unit/scripts/scripted-stages.spec.ts`          | Remove `audit-history path` describe block                                                    |
| `tests/unit/scripts/cody/cody-utils-extended.test.ts` | Remove from valid stages lists                                                                |
| `tests/unit/scripts/cody/rerun-gate-approval.test.ts` | Remove from pipeline arrays                                                                   |
| `tests/unit/scripts/cody/audit-history.test.ts`       | Delete file                                                                                   |

---

## Part 5: GitHub Actions Workflow

### Step 5.1 — Inspector Workflow (`.github/workflows/inspector.yml`)

```yaml
name: Inspector
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
        description: 'Run without executing actions'

concurrency:
  group: inspector
  cancel-in-progress: true

jobs:
  inspect:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
      actions: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsx scripts/inspector/index.ts
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
          REPO: ${{ github.repository }}
          MINIMAX_API_KEY: ${{ secrets.MINIMAX_API_KEY }}
          WATCHDOG_ISSUE: ${{ vars.WATCHDOG_ISSUE }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
```

---

## Part 6: Cleanup (After Validation Period)

After Inspector is running and verified for 1 week:

### Step 6.1 — Disable Old Workflows

- Comment out or delete triggers in `supervisor.yml`
- Comment out or delete triggers in `watchdog.yml`

### Step 6.2 — Remove Old Code

- Delete `scripts/watchdog/` directory
- Delete `scripts/supervisor/` directory (move reusable utilities to `scripts/inspector/shared/` first)
- Delete old test files

---

## Test Summary

### New Test Files (16 files)

| Test File                                                                       | Tests    | Priority |
| ------------------------------------------------------------------------------- | -------- | -------- |
| `tests/unit/scripts/inspector/core/types.test.ts`                               | ~3       | Low      |
| `tests/unit/scripts/inspector/core/state.test.ts`                               | ~8       | High     |
| `tests/unit/scripts/inspector/core/dedup.test.ts`                               | ~6       | High     |
| `tests/unit/scripts/inspector/core/inspector.test.ts`                           | ~9       | High     |
| `tests/unit/scripts/inspector/clients/github.test.ts`                           | ~7       | High     |
| `tests/unit/scripts/inspector/plugins/registry.test.ts`                         | ~5       | Medium   |
| `tests/unit/scripts/inspector/plugins/cody/health-check/discovery.test.ts`      | ~7       | High     |
| `tests/unit/scripts/inspector/plugins/cody/health-check/evaluator.test.ts`      | ~10      | High     |
| `tests/unit/scripts/inspector/plugins/cody/health-check/actions/retry.test.ts`  | ~11      | High     |
| `tests/unit/scripts/inspector/plugins/cody/health-check/actions/nudge.test.ts`  | ~6       | Medium   |
| `tests/unit/scripts/inspector/plugins/cody/health-check/actions/digest.test.ts` | ~6       | Medium   |
| `tests/unit/scripts/inspector/plugins/cody/health-check/index.test.ts`          | ~6       | High     |
| `tests/unit/scripts/inspector/plugins/cody/audit/analyzer.test.ts`              | ~6       | Medium   |
| `tests/unit/scripts/inspector/plugins/cody/audit/actions/create-issue.test.ts`  | ~4       | Medium   |
| `tests/unit/scripts/inspector/plugins/cody/audit/index.test.ts`                 | ~7       | High     |
| `tests/unit/scripts/inspector/index.test.ts`                                    | ~4       | Medium   |
| **Total**                                                                       | **~105** |          |

### Modified Test Files (7 files)

| Test File                     | Change                           |
| ----------------------------- | -------------------------------- |
| `stage-prompts.test.ts`       | Update expectations              |
| `scripted-stages.spec.ts`     | Remove audit-history tests       |
| `cody-utils-extended.test.ts` | Remove auditor from valid stages |
| `rerun-gate-approval.test.ts` | Remove from pipeline arrays      |
| `audit-history.test.ts`       | Delete                           |
| `auditor.test.ts`             | Delete                           |
| `apply-audit.test.ts`         | Delete                           |

---

## Implementation Order

| Phase                      | Steps   | Files                           | Depends On                          |
| -------------------------- | ------- | ------------------------------- | ----------------------------------- |
| **1. Core framework**      | 1.1–1.7 | 7 source + 6 test               | Nothing                             |
| **2. Health-check plugin** | 2.1–2.6 | 6 source + 6 test               | Phase 1                             |
| **3. Audit plugin**        | 3.1–3.3 | 3 source + 3 test               | Phase 1, Phase 2 (shares discovery) |
| **4. Pipeline removal**    | 4.1–4.2 | ~17 modified + ~5 test modified | Independent                         |
| **5. Workflow**            | 5.1     | 1 workflow file                 | Phase 1-3                           |
| **6. Cleanup**             | 6.1–6.2 | Delete old files                | After 1 week validation             |

**Phases 1-3 and Phase 4 can run in parallel** — they don't depend on each other.

---

## Risk Assessment

| Risk                                             | Mitigation                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Inspector misses failures that supervisor caught | Run both in parallel for 1 week                                   |
| Audit plugin LLM costs add up                    | Schedule: every 3rd cycle (15 min), only newly completed tasks    |
| GitHub API rate limiting (every 5 min)           | Inspector makes ~3-5 API calls per run; well within 5000/hr limit |
| State file corruption                            | Atomic write pattern + handle corrupt JSON gracefully             |
| Plugin errors crash Inspector                    | Error isolation: `try/catch` per plugin, log and continue         |

---

## Estimated Token/Cost Savings

| Optimization                         | Token Savings | Time Savings   |
| ------------------------------------ | ------------- | -------------- |
| Remove auditor stage (LLM)           | ~10% per run  | ~2-3 min       |
| Remove apply-audit stage (LLM)       | ~5% per run   | ~2 min         |
| **Pipeline subtotal**                | **~15%**      | **~4-5 min**   |
| Efficiency directive (narration cut) | ~20-25% total | ~5-10 min      |
| **Combined total**                   | **~35-40%**   | **~10-15 min** |

---

## Appendix: Reusable Components

The following existing modules are reused as-is:

| Module                                   | What to Import                                                |
| ---------------------------------------- | ------------------------------------------------------------- |
| `scripts/cody/github-api.ts`             | All functions                                                 |
| `scripts/cody/cody-utils.ts`             | `getTaskDir`, `ensureTaskDir`, `validateTaskId`, `readStatus` |
| `scripts/cody/engine/types.ts`           | `PipelineStateV2`, `StageStateV2`, `isPipelineStateV2`        |
| `scripts/supervisor/retry-classifier.ts` | `classifyRetryability`, `RetryClassification`                 |
| `scripts/supervisor/failure-analyzer.ts` | `analyzeFailure`, `AnalysisInput`, `AnalysisResult`           |
| `scripts/cody/logger.ts`                 | `logger`, `createStageLogger`                                 |
