# PR-A: Cody Dashboard — Backend + Data Layer (PARALLEL)

**Branch**: `feat/cody-dash-backend`
**Created**: 2026-02-21
**Status**: Planned
**Parallel with**: PR-B (UI + Chat)
**Consolidates**: TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-11, TASK-18 (API only)

---

## Summary

Complete server-side data layer for the Cody Operations Dashboard: types, GitHub client, comment parser, board mapper, and all API routes. This PR is **fully independent** — no UI, no CopilotKit, no frontend components. Can be reviewed and merged in parallel with PR-B.

---

## Architecture

```
src/lib/cody/           ← Core library (types, parsing, mapping)
  types.ts
  constants.ts
  auth.ts
  utils.ts
  github-client.ts
  task-parser.ts
  board-mapper.ts

src/app/api/cody/       ← API routes
  auth/route.ts
  boards/route.ts
  tasks/route.ts
  tasks/[taskId]/route.ts
  tasks/[taskId]/actions/route.ts
  pipeline/[taskId]/route.ts
  workflows/route.ts
  prs/route.ts

tests/unit/lib/cody/    ← Unit tests
  github-client.test.ts
  task-parser.test.ts
  board-mapper.test.ts
```

---

## Step 1: Types & Constants (from TASK-02)

### R1: Create types file

- File: `src/lib/cody/types.ts`
- Define all interfaces:

```typescript
// Comment types parsed from bot comments
export type CommentType =
  | 'task-marker'
  | 'running-status'
  | 'success'
  | 'failure' // "Pipeline failed" from catch block
  | 'cody-failed' // "Cody failed" from formatStatusComment
  | 'timeout'
  | 'gate-hard-stop'
  | 'gate-risk'
  | 'clarify-stop'
  | 'supervisor-retry'
  | 'supervisor-exhausted'
  | 'supervisor-error'
  | 'gate-approval'
  | 'gate-rejection'
  | 'vercel-preview'

// Kanban column identifiers
export type ColumnId =
  | 'open'
  | 'building'
  | 'review'
  | 'done'
  | 'failed'
  | 'gate-waiting'
  | 'retrying'

// Parsed bot comment
export interface ParsedComment {
  type: CommentType
  taskId?: string
  createdAt: string
  body: string
  error?: string
  retryNumber?: number
  maxRetries?: number
  stages?: StageProgress[]
  mode?: string
}

// Stage progress extracted from running status comment
export interface StageProgress {
  name: string
  icon: '✅' | '❌' | '🔄' | '⏳'
  elapsed?: string
}

// Board definition
export interface Board {
  id: string
  name: string
  type: 'label' | 'milestone' | 'all'
}

// Dashboard-level task (enriched GitHub issue)
export interface CodyTask {
  id: string // issue number as string
  issueNumber: number
  title: string
  body: string
  taskId?: string // parsed from task marker comment
  column: ColumnId
  labels: string[]
  milestone?: string
  createdAt: string
  updatedAt: string
  comments: ParsedComment[]
  pipelineStatus?: CodyPipelineStatus | null
  associatedPR?: { number: number; url: string; merged: boolean } | null
  workflowRun?: { id: number; status: string; url: string } | null
  latestError?: string
  riskLevel?: 'low' | 'medium' | 'high'
  taskType?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  previewUrl?: string
  assignees: string[]
  totalElapsed?: number
}

// Column display configuration
export interface ColumnDef {
  id: ColumnId
  label: string
  color: string
  alwaysShow: boolean
}
```

- Copy `CodyPipelineStatus` and `StageStatus` from `scripts/cody/cody-utils.ts` lines 38-65 (don't import from scripts)
- Copy `TaskDefinition` from `scripts/cody/pipeline-utils.ts` lines 49-61

### R2: Create constants file

- File: `src/lib/cody/constants.ts`

```typescript
export const SPEC_STAGES = ['taskify', 'spec', 'clarify'] as const
export const IMPL_STAGES = [
  'architect',
  'plan-review',
  'build',
  'commit',
  'verify',
  'auditor',
  'apply-audit',
  'pr',
] as const
export const AUTOFIX_STAGE = 'autofix' as const
export const ALL_STAGES = [...SPEC_STAGES, ...IMPL_STAGES, AUTOFIX_STAGE] as const

export const COLUMN_DEFS: ColumnDef[] = [
  { id: 'open', label: 'Open', color: 'bg-gray-100', alwaysShow: true },
  { id: 'building', label: 'Building', color: 'bg-blue-100', alwaysShow: true },
  { id: 'gate-waiting', label: 'Gate Waiting', color: 'bg-yellow-100', alwaysShow: false },
  { id: 'retrying', label: 'Retrying', color: 'bg-orange-100', alwaysShow: false },
  { id: 'review', label: 'Review', color: 'bg-purple-100', alwaysShow: false },
  { id: 'failed', label: 'Failed', color: 'bg-red-100', alwaysShow: false },
  { id: 'done', label: 'Done', color: 'bg-green-100', alwaysShow: true },
]

export const POLLING_INTERVALS = { idle: 30000, board: 10000, active: 5000 } as const
export const BRANCH_PREFIXES = ['feat', 'fix', 'refactor', 'docs', 'chore'] as const
export const TASK_ID_REGEX = /^[0-9]{6}-[a-zA-Z0-9-]+$/
export const WORKFLOW_ID = 'cody.yml'

export const STAGE_OUTPUT_MAP: Record<string, string> = {
  taskify: 'task.json',
  clarify: 'questions.md',
  architect: 'plan.md',
  'plan-review': 'plan-review.md',
  commit: 'commit.md',
  autofix: 'autofix.md',
}
```

### R3: Dashboard auth helper (decoupled from Payload)

- File: `src/lib/cody/auth.ts`
- Simple secret-based auth using `CODY_DASHBOARD_SECRET` env var
- Exports: `requireDashboardAuth(req: NextRequest): boolean` — checks cookie `cody-session` or `Authorization: Bearer` header
- No Payload dependency. No `getPayload()`. No `@payload-config`.

### R4: Own cn() utility

- File: `src/lib/cody/utils.ts`
- Copy of `cn()` (clsx + twMerge)
- Also add `formatDuration(ms: number): string` helper (e.g., 4232 -> "4s", 92000 -> "1m 32s")

---

## Step 2: GitHub Client (from TASK-03)

### Install

- `pnpm add @octokit/rest`

### Create github-client.ts

- File: `src/lib/cody/github-client.ts`

**Exports**:

```typescript
export function getOctokit(): Octokit // Lazy singleton, uses GH_TOKEN
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T>
export async function findTaskBranch(taskId: string): Promise<string | null>
export async function getStatusFromBranch(
  taskId: string,
  branch: string,
): Promise<CodyPipelineStatus | null>
export async function getStatusFromArtifact(
  taskId: string,
  runId: number,
): Promise<CodyPipelineStatus | null> // V1: stub
export async function findAssociatedPR(
  taskId: string,
): Promise<{ number: number; url: string; merged: boolean; merged_at: string | null } | null>
export function getRepoConfig(): { owner: string; repo: string }
```

**Implementation details**:

- `getCached()`: Simple `Map<string, { data: unknown; expires: number }>` — returns cached if within TTL
- `findTaskBranch()`: `Promise.allSettled()` with all 5 BRANCH_PREFIXES, returns first fulfilled
- `getStatusFromBranch()`: GitHub Contents API -> base64 decode -> JSON parse
- `getStatusFromArtifact()`: Stub returning null for V1
- `findAssociatedPR()`: `octokit.pulls.list({ state: 'all', per_page: 30 })`, filter by `head.ref` matching `{prefix}/{taskId}`

### Tests

- File: `tests/unit/lib/cody/github-client.test.ts`
- Mock Octokit using vi.mock
- Test getCached returns cached value within TTL / re-fetches after TTL
- Test findTaskBranch returns correct branch / null
- Test findAssociatedPR finds PR by branch name
- Test getOctokit throws when GH_TOKEN missing

---

## Step 3: Bot Comment Parser (from TASK-04)

### Create task-parser.ts

- File: `src/lib/cody/task-parser.ts`

**Exports**:

```typescript
export function parseComment(comment: { body: string; created_at: string; user?: { login: string } }): ParsedComment | null
export function parseAllComments(comments: Array<...>): ParsedComment[]
export function getLatestByType(comments: ParsedComment[], type: CommentType): ParsedComment | null
export function extractStageProgress(body: string): StageProgress[]
```

**Comment type detection regexes**:

| Type                   | Detection                                              | Extract                 |
| ---------------------- | ------------------------------------------------------ | ----------------------- |
| `task-marker`          | `/🎯 Task created: \`(\d{6}-[a-zA-Z0-9-]+)\`/`         | taskId, mode            |
| `running-status`       | `/^🔄 Cody running for \`(\d{6}-[a-zA-Z0-9-]+)\`/`     | taskId, stages          |
| `success`              | `/✅ Cody completed for \`(\d{6}-[a-zA-Z0-9-]+)\`/`    | taskId                  |
| `failure`              | ``/❌ Pipeline failed for \`([^`]+)\`:\s*(.+)$/s``     | taskId, error           |
| `cody-failed`          | ``/❌ Cody failed for \`([^`]+)\`/``                   | taskId                  |
| `timeout`              | ``/⏰ Cody timed out for \`([^`]+)\`/``                | taskId                  |
| `gate-hard-stop`       | `/## 🚫 Hard Stop/`                                    | —                       |
| `gate-risk`            | `/## 🚦 Risk Gate/`                                    | —                       |
| `clarify-stop`         | `/stopped at clarify stage/`                           | —                       |
| `supervisor-retry`     | `/\[supervisor-retry:\s*(\d+)\/(\d+)\]/`               | retryNumber, maxRetries |
| `supervisor-exhausted` | `/Max Retries Exhausted/` AND has `[supervisor-retry:` | retryNumber             |
| `supervisor-error`     | `/## Supervisor Error/`                                | —                       |
| `gate-approval`        | `/^\/cody\s+approve/`                                  | (must NOT be from bot)  |
| `gate-rejection`       | `/^\/cody\s+reject/`                                   | (must NOT be from bot)  |
| `vercel-preview`       | `/\[Visit Preview\]\((https:\/\/[^\)]+)\)/`            | previewUrl              |

**Important**: Comments are NOT edited in-place. Each `postComment()` creates a NEW comment. Multiple of same type may exist. Always use `getLatestByType()`.

### Tests

- File: `tests/unit/lib/cody/task-parser.test.ts` — 17 test cases:
  1. Parse task marker (taskId + mode)
  2. Parse running status (taskId + stages)
  3. Parse success
  4. Parse failure (catch block, with error)
  5. Parse cody-failed
  6. Parse timeout
  7. Parse hard-stop gate
  8. Parse risk gate
  9. Parse clarify stop
  10. Parse supervisor retry (retryNumber/maxRetries)
  11. Parse supervisor exhausted
  12. Parse gate approval (human)
  13. Parse gate rejection (human)
  14. Ignore bot gate commands
  15. Unknown comment returns null
  16. getLatestByType returns most recent
  17. parseAllComments filters nulls

---

## Step 4: Board Mapper (from TASK-05)

### Create board-mapper.ts

- File: `src/lib/cody/board-mapper.ts`

**Exports**:

```typescript
export function deriveColumn(
  issue: { state: string; closed_at?: string | null },
  comments: ParsedComment[],
  workflowRun?: { status: string } | null,
  associatedPR?: { merged: boolean; merged_at?: string | null } | null,
): ColumnId

export function organizeBoard(tasks: CodyTask[]): Record<ColumnId, CodyTask[]>
export function getVisibleColumns(tasks: CodyTask[]): ColumnId[]
```

**Column derivation priority order**:

1. **Done**: Latest `success` newer than any `failure`/`cody-failed`. OR PR merged.
2. **Failed**: Has `failure`/`cody-failed` AND `supervisor-exhausted`.
3. **Gate Waiting**: Has `gate-hard-stop`/`gate-risk` AND no newer `gate-approval`.
4. **Retrying**: Has `supervisor-retry` AND `failure`/`cody-failed` AND NOT `supervisor-exhausted`.
5. **Building**: Has `task-marker` AND `workflowRun?.status === 'in_progress'`.
6. **Review**: Has associated PR that is not merged.
7. **Building** (fallback): Has `task-marker` (queued/between steps).
8. **Open**: No `task-marker` found.

### Tests

- File: `tests/unit/lib/cody/board-mapper.test.ts` — 15 test cases:
  - 11 deriveColumn scenarios (open, building, building-queued, done-success, done-pr-merged, failed-exhausted, gate-waiting, gate-approved, retrying, review, recovery)
  - 3 getVisibleColumns scenarios
  - 1 organizeBoard grouping test

---

## Step 5: API Routes — Tasks & Boards (from TASK-06)

### GET /api/cody/boards

- File: `src/app/api/cody/boards/route.ts`
- Auth: `requireDashboardAuth(req)`
- Fetch labels + milestones from GitHub
- Return: `{ boards: [{ id: 'all', name: 'All', type: 'all' }, ...labelBoards, ...milestoneBoards] }`
- Cache: 60s TTL

### GET /api/cody/tasks

- File: `src/app/api/cody/tasks/route.ts`
- Auth, query params: `board` (default 'all'), `limit` (default 50)
- For each issue: fetch comments -> parse -> find taskId -> find PR -> derive column -> build CodyTask
- Include recently closed issues (last 7 days) for 'done' column
- Filter out PRs from issues endpoint (`!issue.pull_request`)
- Return: `{ tasks: CodyTask[], visibleColumns: ColumnId[] }`
- Cache: 10s TTL

### POST /api/cody/tasks

- Same route file, POST handler
- Zod validation:

```typescript
const createTaskSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().min(1),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  triggerWorkflow: z.boolean().optional().default(false),
  mode: z.enum(['spec', 'impl', 'full']).optional().default('full'),
})
```

- Create issue, optionally dispatch workflow with taskId `YYMMDD-auto-{NN}`

### POST /api/cody/auth

- File: `src/app/api/cody/auth/route.ts`
- Check password against `CODY_DASHBOARD_SECRET`, set `cody-session` cookie

### Error handling (all routes)

- GitHub 401 -> 502, GitHub 403 -> 429, GitHub 404 -> 404, Zod error -> 400, Other -> 500

---

## Step 6: API Routes — Pipeline, Workflows, PRs (from TASK-11)

### GET /api/cody/pipeline/[taskId]

- File: `src/app/api/cody/pipeline/[taskId]/route.ts`
- Fallback chain: branch -> artifact (stub) -> comments
- Return: `{ status: CodyPipelineStatus | null, source: 'branch' | 'artifact' | 'comments' | null }`

### GET /api/cody/workflows

- File: `src/app/api/cody/workflows/route.ts`
- Fetch workflow runs for `cody.yml`, cache 10s

### GET /api/cody/prs

- File: `src/app/api/cody/prs/route.ts`
- Fetch open PRs, filter by branch pattern `{prefix}/{taskId}`, cache 30s

---

## Step 7: Task Actions API (from TASK-18, API only)

### GET /api/cody/tasks/[taskId]

- File: `src/app/api/cody/tasks/[taskId]/route.ts`
- Find issue with task-marker containing taskId, return full CodyTask

### POST /api/cody/tasks/[taskId]/actions

- File: `src/app/api/cody/tasks/[taskId]/actions/route.ts`
- 9 actions: approve, reject, rerun, abort, assign, unassign, add-label, remove-label, update-body
- Each calls appropriate Octokit method

---

## Files Summary

### New Files (17)

- `src/lib/cody/types.ts`
- `src/lib/cody/constants.ts`
- `src/lib/cody/auth.ts`
- `src/lib/cody/utils.ts`
- `src/lib/cody/github-client.ts`
- `src/lib/cody/task-parser.ts`
- `src/lib/cody/board-mapper.ts`
- `src/app/api/cody/auth/route.ts`
- `src/app/api/cody/boards/route.ts`
- `src/app/api/cody/tasks/route.ts`
- `src/app/api/cody/tasks/[taskId]/route.ts`
- `src/app/api/cody/tasks/[taskId]/actions/route.ts`
- `src/app/api/cody/pipeline/[taskId]/route.ts`
- `src/app/api/cody/workflows/route.ts`
- `src/app/api/cody/prs/route.ts`
- `tests/unit/lib/cody/github-client.test.ts`
- `tests/unit/lib/cody/task-parser.test.ts`
- `tests/unit/lib/cody/board-mapper.test.ts`

### Modified Files (1)

- `package.json` (add `@octokit/rest`)

---

## Acceptance Criteria

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm vitest run tests/unit/lib/cody/` — all tests pass (~38 tests)
- [ ] All API routes return correct data (curl testing)
- [ ] Auth check works on all routes (401 for unauthenticated)
- [ ] Error mapping works (GitHub errors -> appropriate HTTP codes)
- [ ] `GH_TOKEN` not exposed in any response
- [ ] No imports from `scripts/` directory
- [ ] No Payload dependency (no `getPayload()`, no `@payload-config`)

## Guardrails

- No UI components in this PR
- No CopilotKit dependencies
- No frontend route changes
- All code is server-side only
- `GH_TOKEN` never reaches the browser
