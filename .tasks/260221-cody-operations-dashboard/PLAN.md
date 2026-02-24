# Cody Operations Dashboard — Implementation Plan

**Created**: 2026-02-21
**Updated**: 2026-02-22 (v5 — gap analysis applied, task breakdown ready)
**Status**: Ready for Implementation
**Author**: Claude Code + aguy

---

## Gap Analysis (v4 → v5)

Cross-referencing PLAN v4 with the actual codebase revealed these additional gaps.

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 1 | **Pipeline stages incomplete**: Plan listed `taskify → spec → architect → plan-review → build → commit → verify → auditor → apply-audit → pr`. Missing `autofix` (sub-stage of verify) and `clarify` is opt-in. | Medium — dashboard would show wrong stages | Fixed: `autofix` added as looping sub-stage under verify. Clarify shown conditionally. |
| 2 | **`IMPL_PIPELINE` doesn't include `taskify` or `spec`**: Actual implementation pipeline is `architect → plan-review → build → commit → verify → auditor → apply-audit → pr`. Spec pipeline runs first, separately. | Medium — stage progress visualization wrong | Fixed: Dashboard shows two pipeline sections: spec stages (taskify, spec, clarify) + impl stages (architect through pr). |
| 3 | **Running status comment is NOT edited in-place**: `editComment` is unimplemented (TODO stub). Each `postComment()` creates a NEW comment. The plan assumed in-place editing. | High — task-parser.ts must find the LATEST status comment, not assume single editable one | Fixed: task-parser.ts must sort comments by date and find the most recent matching each type. |
| 4 | **Failure comment format mismatch**: `formatStatusComment()` outputs `❌ Cody failed for \`{taskId}\`` but cody.ts catches errors and posts `❌ Pipeline failed for \`{taskId}\`: {error}`. Both formats exist. | Medium — regex must match both | Fixed: Two separate regexes for `Cody failed` (from formatStatusComment) and `Pipeline failed` (from catch block). |
| 5 | **`autofix` is inline loop, not a formal pipeline stage**: autofix runs up to 3 times inside the verify stage's error handler. It's tracked in status.json as its own stage but not in `IMPL_PIPELINE`. | Low — dashboard can still show it from status.json stages | Fixed: Read autofix stage data from status.json `stages` record. Show as sub-indicator under verify. |
| 6 | **Supervisor uses MiniMax M2.5, not Gemini**: `failure-analyzer.ts` uses OpenAI-compatible client pointed at `api.minimax.io`. Needs `MINIMAX_API_KEY`. | Info — no action needed for dashboard (just display) | N/A |
| 7 | **PR association**: Issues don't have `pull_request` field unless the issue IS a PR. Need to find PRs by branch name pattern instead. | High — column derivation for "Review" column broken | Fixed: Query PRs separately using `pulls.list` and match by branch name `{prefix}/{taskId}`. |
| 8 | **Branch prefix discovery**: 5 possible prefixes (`feat/`, `fix/`, `refactor/`, `docs/`, `chore/`). Must try all to find status.json on branch. | Medium — API route must handle multi-prefix lookup | Fixed: `github-client.ts` exports `findTaskBranch()` that tries all 5. |
| 9 | **`GITHUB_TOKEN` not in `.env.example`**: Dashboard needs `GITHUB_TOKEN` for server-side API routes. | Low — easy to add | Fixed: Add `GITHUB_TOKEN` and `CODY_DASHBOARD_SECRET` to `.env.example` in Phase 1.
| 10 | **Workflow dispatch requires `workflow_id`**: `octokit.actions.createWorkflowDispatch()` needs the workflow file name, not just inputs. Must pass `workflow_id: 'cody.yml'`. | Low — but would break "create task" action | Fixed: Hardcode `workflow_id: 'cody.yml'` in actions route. |
| 11 | **CopilotKit Gemini adapter regression**: Issues #3217 (google/undefined), #2929 (message ID "0"). | High — Phase 0 spike must validate | Fixed: Phase 0 includes explicit fallback path to OpenAI. Budget 2 hours max. |
| 12 | **Auth check pattern**: Plan said `requireAdmin(user)` but actual auth is via Payload's `/api/users/me` endpoint. Server-side API routes need to call `getPayload()` then `payload.auth({ headers })`. | Medium — auth code would be wrong | Fixed: Decoupled — API routes use own `requireDashboardAuth()` with CODY_DASHBOARD_SECRET (no Payload dependency). |
| 13 | **Route group path**: `(cody)` is a route group, actual URL depends on folder structure. Plan implies `/cody` but Next.js may render differently. | Low — clarify URL path | Fixed: Use folder `src/app/(cody)/cody/page.tsx` → URL `/cody`. |
| 14 | **Tailwind CSS**: `(cody)` layout needs its own globals import since it has separate `<html>/<body>`. | Medium — styling breaks | Fixed: Import `'./globals.css'` in `(cody)/layout.tsx`. |
| 15 | **CopilotKit CSS conflicts**: No existing CopilotKit usage to verify styling isolation. | Low — test in Phase 0 | Tested in TASK-01 spike. |
| 16 | **No rate limiting strategy**: Plan has cache but no exponential backoff for GitHub API rate limits. | Low — add to github-client | Added retry logic with backoff to TASK-03. |

---

## Overview

A **view-only** developer operations dashboard for monitoring Cody (the CI build agent) and Supervisor (the failure retry agent). Provides a kanban board view, pipeline monitoring, and an AI chat assistant with full repo and GitHub awareness.

**Data source**: GitHub is the single source of truth. No custom database. Boards are derived from GitHub labels/milestones. Task status is derived from issue state + workflow runs + bot comments.

### Goals

1. **Kanban Board** — View tasks organized by lifecycle stage, grouped by labels/milestones as boards
2. **Pipeline Monitor** — Visualize the build pipeline with adaptive polling (5-30s)
3. **Supervisor View** — Track automated failure analysis and retry attempts
4. **Chat Assistant** — CopilotKit-powered chat with Gemini/OpenAI, full repo + GitHub awareness
5. **Multiple Boards** — Switch between boards derived from GitHub labels/milestones
6. **Actions** — Approve gates, rerun from stage, abort, create tasks (via UI and chat)

### Non-Goals (V1)

- Custom task persistence (no Payload collections for tasks)
- Drag-and-drop reordering
- Tasks that don't map to GitHub issues
- Replacing Jira
- Moving existing Cody scripts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      /cody (route group)                     │
│         Auth-gated via CODY_DASHBOARD_SECRET, own <html> layout   │
│                                                              │
│  ┌─ Board Switcher ─────────────────────────────────────┐   │
│  │  [All]  [v2.1]  [v2.2]  [Bugs]                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Kanban Board ───────────────────────────────────────┐   │
│  │ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐     │   │
│  │ │ Open   │ │ Planning │ │ Building │ │ Done   │     │   │
│  │ │        │ │          │ │          │ │        │     │   │
│  │ │ #481   │ │ task-98  │ │ task-94  │ │ task-90│     │   │
│  │ │ #479   │ │ ✅✅🔄⏳ │ │ ✅✅✅❌ │ │ ✓ PR   │     │   │
│  │ └────────┘ └──────────┘ └──────────┘ └────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Detail Panel + Chat ────────────────────────────────┐   │
│  │ Pipeline: ● taskify → ● spec → ◌ build → ○ verify   │   │
│  │ Supervisor: [retry 1/3] Missing import in...         │   │
│  │ Actions: [Approve] [Rerun] [Abort]                   │   │
│  │ Chat: CopilotChat with actions + readable context    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Backend (server-side, GH_TOKEN never exposed to browser):  │
│  /api/copilotkit  → CopilotRuntime + Gemini/OpenAI         │
│  /api/cody/*      → Octokit → GitHub API                   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
GitHub (single source of truth)
  ├── Issues (with labels/milestones)
  ├── Issue comments (Cody bot: github-actions[bot])
  ├── Workflow runs (GitHub Actions API)
  ├── Branch contents (status.json via Contents API)
  ├── Pull requests (matched by branch name)
  └── Artifacts (status.json after run completes)
          │
          ▼
  /api/cody/* (Next.js API routes, server-side)
  │   ├── Octokit with process.env.GH_TOKEN
  │   ├── Dashboard auth via requireDashboardAuth()
  │   ├── task-parser.ts (parses bot comments, sorts by date)
  │   ├── board-mapper.ts (derives kanban columns)
  │   └── In-memory cache (10s TTL for responsiveness)
          │
          ▼
  Browser (React client components)
  │   ├── Kanban board + cards
  │   ├── Pipeline visualization
  │   ├── CopilotKit chat (actions call /api/cody/*)
  │   └── Adaptive polling (5s/10s/30s)
```

---

## Critical Investigation Results

### Route Compatibility: ✅ GREEN LIGHT

| Check | Status | Notes |
|-------|--------|-------|
| Middleware | Clear | Only sets locale cookie/header, no blocking |
| `/api/cody/` | Free | No existing routes |
| `/api/copilotkit/` | Free | No existing routes |
| Auth | Decoupled | Own secret-based auth (CODY_DASHBOARD_SECRET), no Payload dependency |
| `[slug]` catch-all | Safe | Explicit routes beat dynamic; keep under `/cody/` prefix |
| Root layout | Required | `(cody)` needs own `<html>`/`<body>` (same pattern as `(frontend)`) |

### Bot Comment Formats (for `task-parser.ts`)

**IMPORTANT**: Comments are NOT edited in-place (`editComment` is unimplemented). Each `postComment()` call creates a NEW comment. Parser must find the LATEST comment matching each type.

| Comment Type | Marker/Pattern | Regex |
|-------------|----------------|-------|
| Task marker | `🎯 Task created: \`{taskId}\`` | `/Task created: \`(\d{6}-[a-zA-Z0-9-]+)\`/` |
| Running status | `🔄 Cody running for \`{taskId}\`` | Stage icons: ✅=done, ❌=failed, 🔄=running, ⏳=pending |
| Success | `✅ Cody completed for \`{taskId}\`!` | `/✅ Cody completed/` |
| Failure (catch) | `❌ Pipeline failed for \`{taskId}\`: {error}` | `/❌ Pipeline failed for \`([^`]+)\`:\s*(.+)$/s` |
| Failure (status) | `❌ Cody failed for \`{taskId}\`` | `/❌ Cody failed for/` |
| Timeout | `⏰ Cody timed out for \`{taskId}\`` | `/⏰ Cody timed out/` |
| Gate (hard-stop) | `## 🚫 Hard Stop: Approval Required` | `/## 🚫 Hard Stop/` |
| Gate (risk-gated) | `## 🚦 Risk Gate: Approval Required` | `/## 🚦 Risk Gate/` |
| Clarify stop | `🔄 Cody stopped at clarify stage` | `/stopped at clarify stage/` |
| Supervisor retry | `[supervisor-retry: N/3]` | `/\[supervisor-retry:\s*(\d+)\/(\d+)\]/` |
| Supervisor exhausted | `## Supervisor: Max Retries Exhausted` | `/Max Retries Exhausted/` |
| Supervisor error | `## Supervisor Error` | `/## Supervisor Error/` |
| Gate approval | `/cody approve` | `/^\/cody\s+approve/` |
| Gate rejection | `/cody reject` | `/^\/cody\s+reject/` |
| Vercel preview | `[Visit Preview](https://...)` on PR | `/\[Visit Preview\]\((https:\/\/[^)]+)\)/` (from vercel[bot] on PR comments) |

### `status.json` Schema (from `.tasks/{taskId}/status.json`)

```typescript
interface CodyPipelineStatus {
  taskId: string                    // "260219-auto-98"
  mode: string                      // "full" | "spec" | "impl" | "rerun"
  pipeline: string                  // "spec_execute_verify" | "spec_only"
  startedAt: string                 // ISO 8601
  updatedAt: string                 // ISO 8601
  completedAt?: string              // ISO 8601
  totalElapsed?: number             // ms
  state: 'running' | 'completed' | 'failed' | 'timeout'
  currentStage: string | null
  stages: Record<string, {
    state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'gate-waiting'
    startedAt?: string
    completedAt?: string
    elapsed?: number                // ms
    retries: number
    outputFile?: string             // e.g., "plan.md"
    error?: string
  }>
  triggeredBy: string               // "dispatch" | "comment"
  issueNumber?: number
  runId?: string
  runUrl?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  gatePoint?: string                // "taskify" | "architect"
}
```

### `task.json` Schema (from `.tasks/{taskId}/task.json`)

```typescript
interface TaskDefinition {
  task_type: 'spec_only' | 'implement_feature' | 'fix_bug' | 'refactor' | 'docs' | 'ops' | 'research'
  pipeline: 'spec_only' | 'spec_execute_verify'
  risk_level: 'low' | 'medium' | 'high'
  confidence: number                // 0.0-1.0
  primary_domain: 'backend' | 'frontend' | 'infra' | 'data' | 'llm' | 'devops' | 'product'
  scope: string[]
  missing_inputs: Array<{ field: string; question: string }>
  assumptions: string[]
}
```

### Pipeline Stages (CORRECTED)

**Spec pipeline:** `taskify` → `spec` → `clarify` (opt-in)

**Implementation pipeline (IMPL_PIPELINE):** `architect` → `plan-review` → `build` → `commit` → `verify` → `auditor` → `apply-audit` → `pr`

**Note:** `autofix` is a looping sub-stage within verify's error handler (up to 3 attempts). It appears in `status.json` stages but is NOT in `IMPL_PIPELINE`. Spec stages (`taskify`, `spec`) run before impl pipeline but are separate.

**Full pipeline (mode=full):** spec pipeline first, then impl pipeline.

### Stage Output Files

| Stage | Output File |
|-------|------------|
| taskify | `task.json` |
| spec | `spec.md` |
| clarify | `questions.md` |
| architect | `plan.md` |
| plan-review | `plan-review.md` |
| build | `build.md` |
| commit | `commit.md` |
| verify | `verify.md` |
| autofix | `autofix.md` |
| auditor | `auditor.md` |
| apply-audit | `apply-audit.md` (file: `{stage}.md` default) |
| pr | `pr.md` |

### Workflow Dispatch Inputs (`cody.yml`)

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `task_id` | string | yes | — | Task ID (format: `YYMMDD-description`) |
| `mode` | string | no | `full` | `spec`, `impl`, `rerun`, `full`, `status` |
| `clarify` | boolean | no | `false` | Run clarify Q&A loop |
| `dry_run` | boolean | no | `false` | Dry run mode |
| `feedback` | string | no | `''` | Feedback for rerun mode |
| `from_stage` | string | no | `''` | Stage to restart from |

### Task ID Format

- Regex: `/^[0-9]{6}-[a-zA-Z0-9-]+$/`
- Format: `YYMMDD-description` (e.g., `260219-auto-98`)
- Auto-generated: `YYMMDD-auto-{01-99}`

### Task Creation (How It Actually Works)

Issues are **not created by Cody** — they're created by humans. Cody responds to:
1. `workflow_dispatch` — user provides `task_id`, optional `issue_number`
2. `/cody` comment on an existing issue — parses command from first line

**No label requirements.** Cody doesn't check labels. Only requirements:
- Comment author must be OWNER, MEMBER, or COLLABORATOR
- Comment starts with `/cody`
- Not from a `[bot]` account

### Artifacts

- **Upload:** End of run only (`if: always()`)
- **Name format:** `cody-{taskId}-{runId}`
- **Retention:** 7 days
- **Contents:** Entire `.tasks/{taskId}/` directory (zipped)
- **NOT available mid-run** — only after workflow completes

### Branch-Based Status Access (Mid-Run)

status.json IS committed to the feature branch at specific points during the run:
- After spec completes (commitPipelineFiles with staging: 'task-only')
- At gate points (hard-stop, risk-gated)
- After verify passes

**Read from branch** via GitHub Contents API: `GET /repos/{owner}/{repo}/contents/.tasks/{taskId}/status.json?ref={branch}`

Must discover branch name by trying 5 prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` + taskId.

### Supervisor Behavior

- Triggers on `issue_comment` (any comment with backtick-wrapped task ID)
- Counts `[supervisor-retry: N/M]` tags in existing comments
- Max 3 retries
- Posts analysis + `/cody rerun ...` command
- Uses MiniMax M2.5 for failure analysis
- **Supervisor comment does NOT auto-trigger Cody** (bot comments are filtered by `parse-safety.sh`)
- Human must manually approve/copy the rerun command

### Branch Naming

| task_type | Prefix | Example |
|-----------|--------|---------|
| implement_feature | feat | `feat/260219-auto-98` |
| fix_bug | fix | `fix/260219-auto-98` |
| refactor | refactor | `refactor/260219-auto-98` |
| docs | docs | `docs/260219-auto-98` |
| ops | chore | `chore/260219-auto-98` |

---

## Board & Column Derivation

### Boards

Derived from GitHub labels/milestones:
- Any label → potential board
- Any open milestone → potential board
- "All" → always available, shows everything

**Current state:** No label convention exists yet. Dashboard launches with "All" board. Users create boards by adding labels to issues in GitHub.

### Columns (4 initial, expandable to 7)

Starting with 4 columns (fewer empty columns):

| Column | Derived From |
|--------|-------------|
| **Open** | Issue open, no `🎯 Task created` comment yet |
| **Building** | Has task marker, pipeline running (any stage) |
| **Review** | PR found matching task branch (not merged) |
| **Done** | `✅ Cody completed` comment OR PR merged OR issue closed |

Added when needed:
| Column | Derived From |
|--------|-------------|
| **Failed** | `❌ Pipeline failed` / `❌ Cody failed` and max retries exhausted |
| **Gate Waiting** | `🚫 Hard Stop` or `🚦 Risk Gate` comment, no `/cody approve` after it |
| **Retrying** | `[supervisor-retry: N/3]` where N < 3, no exhausted comment |

### Column Derivation Logic (`board-mapper.ts`) — CORRECTED

```typescript
export function deriveColumn(
  issue: GitHubIssue,
  comments: ParsedComment[],
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,     // ← Gap #7 fix: PR found by branch name
): ColumnId {
  // Sort comments by date (newest last) — Gap #3 fix
  const sorted = [...comments].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const taskMarker = sorted.find(c => c.type === 'task-marker')
  const completion = sorted.findLast(c => c.type === 'success')
  const failure = sorted.findLast(c => c.type === 'failure' || c.type === 'cody-failed')
  const gate = sorted.findLast(c => c.type === 'gate-request')
  const gateApproval = sorted.findLast(c => c.type === 'gate-approval')
  const retries = sorted.filter(c => c.type === 'supervisor-retry')
  const exhausted = sorted.findLast(c => c.type === 'supervisor-exhausted')

  // Done: completed (newest completion after newest failure = recovered)
  if (completion && (!failure || completion.createdAt > failure.createdAt)) return 'done'
  if (associatedPR?.merged_at) return 'done'

  // Failed: failure + max retries exhausted
  if (failure && exhausted) return 'failed'

  // Gate waiting: gate request without subsequent approval
  if (gate && (!gateApproval || gate.createdAt > gateApproval.createdAt)) return 'gate-waiting'

  // Retrying: has retries, not exhausted
  if (retries.length > 0 && !exhausted && failure) return 'retrying'

  // Building: has task marker and workflow is active
  if (taskMarker && workflowRun?.status === 'in_progress') return 'building'

  // Review: has associated PR (not merged)
  if (associatedPR && !associatedPR.merged_at) return 'review'

  // Building: has task marker (may be between retries or queued)
  if (taskMarker) return 'building'

  // No task marker → open
  return 'open'
}
```

---

## Adaptive Polling

| Context | Interval | Condition |
|---------|----------|-----------|
| Board (no running tasks) | 30s | No task has `building` column |
| Board (has running tasks) | 10s | At least one task in `building` |
| Selected task (running) | 5s | Selected task is in `building` |
| Selected task (idle) | 30s | Selected task is done/failed/open |

---

## New Dependencies

```bash
pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @octokit/rest
```

---


## File Structure

```
# Everything under two directories — portable to standalone repo

src/app/(cody)/                              # Route group (own <html>/<body>)
├── layout.tsx                               # Root layout + Tailwind + CopilotKit
├── cody/
│   ├── page.tsx                             # Dashboard page (auth-gated)
│   └── login/
│       └── page.tsx                         # Simple password login
├── components/                              # Own UI components (NO imports from ui/web)
│   ├── card.tsx                             # Simple Card (div + border/shadow)
│   ├── badge.tsx                            # Simple Badge (span + color variants)
│   ├── button.tsx                           # Simple Button
│   ├── input.tsx                            # Simple Input
│   ├── select.tsx                           # Simple Select
│   └── skeleton.tsx                         # Loading skeleton (animate-pulse)
├── dashboard/                               # Dashboard components
│   ├── CodyDashboard.tsx                    # Main layout
│   ├── CodyActions.tsx                      # useCopilotAction hooks
│   ├── CodyContext.tsx                      # useCopilotReadable hooks
│   └── useAdaptivePolling.ts               # Polling hook
├── board/                                   # Kanban board
│   ├── BoardSwitcher.tsx
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   └── KanbanCard.tsx
├── tasks/                                   # Task management
│   ├── TaskDetail.tsx
│   └── CreateTaskDialog.tsx
├── pipeline/                                # Pipeline visualization
│   ├── PipelineStatus.tsx
│   ├── StageIndicator.tsx
│   └── SupervisorLog.tsx
├── chat/                                    # Chat panel
│   └── CodyChatPanel.tsx
└── shared/                                  # Shared badges + types
    ├── StatusBadge.tsx
    ├── RiskBadge.tsx
    ├── TaskTypeBadge.tsx
    └── types.ts

src/app/api/cody/                            # API routes (server-side)
├── auth/route.ts                            # POST login (check CODY_DASHBOARD_SECRET)
├── boards/route.ts                          # GET boards
├── tasks/route.ts                           # GET tasks, POST create
├── tasks/[taskId]/route.ts                  # GET task detail
├── tasks/[taskId]/actions/route.ts          # POST actions (approve/rerun/assign/etc)
├── pipeline/[taskId]/route.ts               # GET pipeline status
├── prs/route.ts                             # GET PRs
└── workflows/route.ts                       # GET workflow runs

src/app/api/copilotkit/route.ts              # CopilotKit runtime

src/lib/cody/                                # Core library (zero A-Guy imports)
├── auth.ts                                  # requireDashboardAuth() — secret-based
├── github-client.ts                         # Octokit + cache + branch discovery
├── task-parser.ts                           # Parse bot comments
├── board-mapper.ts                          # Derive kanban columns
├── types.ts                                 # All TypeScript interfaces
├── constants.ts                             # Stage names, columns, intervals
└── utils.ts                                 # cn(), formatDuration()

tests/unit/lib/cody/                         # Unit tests
├── task-parser.test.ts
├── board-mapper.test.ts
└── github-client.test.ts
```

### Portability

The dashboard has **zero imports from outside these two directories** (`src/app/(cody)/` and `src/lib/cody/`).
To extract to a standalone repo: copy both directories + add Next.js + Tailwind config.
No Payload CMS dependency. No `@payload-config`. No `useCurrentUser()`.


---

## API Routes (All Server-Side, Auth-Protected)

Every `/api/cody/*` route (decoupled from Payload):
1. Checks auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
2. If unauthorized: returns 401
3. Uses Octokit with `process.env.GITHUB_TOKEN`
4. Returns JSON

### Error Handling Strategy

All API routes wrap in try/catch with:
```typescript
try {
  // ... Octokit calls
} catch (error: any) {
  if (error.status === 401) return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
  if (error.status === 403) return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
  if (error.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  console.error('Cody API error:', error)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

### In-Memory Cache

Simple TTL cache to avoid hammering GitHub on every poll:
```typescript
const cache = new Map<string, { data: unknown; expires: number }>()

async function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data as T
  const data = await fetcher()
  cache.set(key, { data, expires: Date.now() + ttlMs })
  return data
}
```

TTL values: 10s for task list, 5s for running pipeline, 60s for boards.

### `GET /api/cody/boards`

Returns labels + milestones as boards.

### `GET /api/cody/tasks?board=&status=`

Fetches issues, parses comments, derives columns, returns board-ready data.

### `GET /api/cody/tasks/[taskId]`

Fetches specific issue + all comments + workflow run + status.json (from branch or artifact).

**Branch-based status.json** (for running tasks): Try 5 branch prefixes, use GitHub Contents API.
**Artifact-based** (for completed tasks): Download artifact zip, extract status.json.
**Fallback**: Parse stage progress from the latest running status comment.

### `POST /api/cody/tasks` (Create)

Creates a GitHub issue and optionally triggers `workflow_dispatch`:
- Creates issue via `octokit.issues.create()`
- If `triggerWorkflow: true`, calls `octokit.actions.createWorkflowDispatch({ workflow_id: 'cody.yml', ... })`

### `POST /api/cody/tasks/[taskId]/actions`

| Action | What it does |
|--------|-------------|
| `approve` | Posts `/cody approve` as issue comment |
| `reject` | Posts `/cody reject` as issue comment |
| `rerun` | Triggers `workflow_dispatch` with mode=rerun, from_stage, feedback |
| `abort` | Cancels workflow run via `octokit.actions.cancelWorkflowRun()` |

### `GET /api/cody/pipeline/[taskId]`

Returns pipeline status from: branch status.json → artifact status.json → parsed comments (fallback chain).

### `GET /api/cody/prs`

Returns open PRs with branches matching `{prefix}/{taskId}` patterns.

### `GET /api/cody/workflows`

Returns active workflow runs for the `cody.yml` workflow.

### `POST /api/copilotkit`

CopilotRuntime with Gemini adapter (or OpenAI fallback). **Spike this first.**

---

## Chat System Prompt

```
You are Cody Assistant — an AI helper for the Cody Operations Dashboard.

You help developers manage the Cody CI build agent. You have access to:
- GitHub issues, PRs, and workflow runs via actions
- Cody task pipeline status and artifacts
- The full A-Guy codebase context

## Repository Context
- Project: A-Guy — interactive math practice platform
- Stack: Payload CMS 3.x + Next.js 15 + React 19 + Tailwind CSS 4
- Database: MongoDB
- AI: Gemini, OpenAI (for exercise generation), MiniMax M2.5 (for supervisor)
- CI Agent: Cody (OpenCode-based, runs in GitHub Actions)

## Cody Pipeline
Spec: taskify → spec → clarify (opt-in)
Implementation: architect → plan-review → build → commit → verify → auditor → apply-audit → pr
Note: autofix is a sub-stage loop inside verify (up to 3 attempts)

## Task ID Format: YYMMDD-description (e.g., 260219-auto-98)

## Risk Levels
- low → auto (fully autonomous)
- medium → risk-gated (pauses after architect)
- high → hard-stop (pauses after taskify AND architect)

## Supervisor: Analyzes failures with MiniMax M2.5, posts rerun commands.
Retry comments tagged [supervisor-retry: N/3]. Max 3 retries. Human must approve rerun.

Use the available actions to fetch real-time data. Be concise and technical.
```

---

## Implementation Phases & Task Breakdown

Each task below is sized for a single Cody run (~10-30 min). Tasks have explicit dependencies.

### Phase 0 — Spike CopilotKit + LLM (~2 hours max)

**TASK-01: copilotkit-spike** — Validate CopilotKit + Gemini/OpenAI

### Phase 1 — Foundation + Core Library (~1.5 days, 5 tasks)

**TASK-02: cody-types-constants** — Types, constants, shared interfaces
**TASK-03: github-client** — Octokit wrapper with cache + branch finder
**TASK-04: task-parser** — Parse all bot comment types with tests
**TASK-05: board-mapper** — Derive kanban columns with tests
**TASK-06: api-tasks-boards** — API routes for /api/cody/tasks and /api/cody/boards

### Phase 2 — Dashboard UI + Board (~1.5 days, 4 tasks)

**TASK-07: cody-layout-page** — Route group layout, page, auth gate
**TASK-08: kanban-board** — Board + Column + Card components
**TASK-09: shared-badges** — StatusBadge, RiskBadge, TaskTypeBadge
**TASK-10: board-switcher** — Board tabs, filtering, board state

### Phase 3 — Pipeline & Detail (~1.5 days, 4 tasks)

**TASK-11: api-pipeline-workflows** — /api/cody/pipeline/[taskId] and /api/cody/workflows
**TASK-12: pipeline-viz** — PipelineStatus, StageIndicator components
**TASK-13: task-detail** — Detail panel with pipeline + supervisor log
**TASK-14: supervisor-log** — SupervisorLog timeline component

### Phase 4 — Chat + Actions (~1.5 days, 4 tasks)

**TASK-15: copilotkit-runtime** — Production CopilotKit runtime route
**TASK-16: chat-panel** — CodyChatPanel component
**TASK-17: chat-actions-context** — CodyActions + CodyContext hooks
**TASK-18: api-actions-create** — /api/cody/tasks/[taskId]/actions + CreateTaskDialog

### Phase 5 — Polling + Polish (~1 day, 3 tasks)

**TASK-19: adaptive-polling** — useAdaptivePolling hook
**TASK-20: loading-empty-error** — Skeleton, EmptyState, error toasts
**TASK-21: quality-gates** — tsc, lint, format pass + GH_TOKEN in .env.example

---

## Detailed Task Specs

### TASK-01: copilotkit-spike

**Goal**: Prove CopilotKit works with Gemini or OpenAI before building any UI.
**Dependencies**: None
**Estimated time**: 2 hours (hard time-box)

**Steps**:
1. `pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime`
2. Create `src/app/api/copilotkit/route.ts` with CopilotRuntime + GoogleGenerativeAIAdapter
3. Create minimal test page `src/app/(cody)/cody/page.tsx` with `<CopilotChat>`
4. Wire one `useCopilotAction` (e.g., return current time)
5. Verify streaming works

**If Gemini fails**: Switch to OpenAIAdapter. Document which one works.

**Deliverable**: Working chat widget at `/cody`, response streams. File: `.tasks/260221-cody-operations-dashboard/spike-result.md`

---

### TASK-02: cody-types-constants

**Goal**: Create all shared TypeScript types and constants.
**Dependencies**: None
**Files**: `src/lib/cody/types.ts` (NEW), `src/lib/cody/constants.ts` (NEW)

**types.ts contents**:
- `CodyTask` — dashboard-level task (issue + parsed data)
- `ParsedComment` — result of parsing a bot comment
- `CommentType` — union of all comment types
- `ColumnId` — 'open' | 'building' | 'review' | 'done' | 'failed' | 'gate-waiting' | 'retrying'
- `Board` — { id, name, type: 'label' | 'milestone' | 'all' }
- `PipelineStage` — stage display data
- `StageState` — matches CodyPipelineStatus stage states
- Re-export `CodyPipelineStatus`, `StageStatus`, `TaskDefinition` interfaces

**constants.ts contents**:
- `SPEC_STAGES` = ['taskify', 'spec', 'clarify']
- `IMPL_STAGES` = ['architect', 'plan-review', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']
- `AUTOFIX_STAGE` = 'autofix' (sub-stage of verify)
- `ALL_STAGES` = [...SPEC_STAGES, ...IMPL_STAGES, AUTOFIX_STAGE]
- `COLUMN_DEFS` — column display config (label, color, order)
- `POLLING_INTERVALS` = { idle: 30000, board: 10000, active: 5000 }
- `BRANCH_PREFIXES` = ['feat', 'fix', 'refactor', 'docs', 'chore']
- `TASK_ID_REGEX` = /^[0-9]{6}-[a-zA-Z0-9-]+$/
- `GITHUB_OWNER`, `GITHUB_REPO` (from env or hardcoded)
- `WORKFLOW_ID` = 'cody.yml'

**Tests**: None (pure type/constant files). Validated by tsc.

---

### TASK-03: github-client

**Goal**: Octokit wrapper with caching and branch discovery.
**Dependencies**: TASK-02
**Files**: `src/lib/cody/github-client.ts` (NEW)

**Exports**:
- `getOctokit()` — singleton Octokit instance
- `getCached<T>(key, ttl, fetcher)` — TTL cache helper
- `findTaskBranch(taskId)` — tries all 5 branch prefixes, returns first that exists
- `getStatusFromBranch(taskId, branch)` — reads status.json via Contents API
- `getStatusFromArtifact(taskId, runId)` — downloads artifact zip, extracts status.json
- `findAssociatedPR(taskId)` — finds open PR by branch name match

**Key behavior**:
- `findTaskBranch()`: parallel `Promise.allSettled` for all 5 prefixes via `repos.getBranch()`, return first success
- `getStatusFromBranch()`: `repos.getContent()` → base64 decode → JSON parse
- `findAssociatedPR()`: `pulls.list({ state: 'open' })` filtered by head matching any branch prefix + taskId

**Tests**: Unit test with mocked Octokit:
- `findTaskBranch` returns correct branch for each task_type
- `findTaskBranch` returns null when no branch exists
- `getCached` returns cached value within TTL, re-fetches after expiry

---

### TASK-04: task-parser

**Goal**: Parse all Cody bot comment types into structured data.
**Dependencies**: TASK-02
**Files**: `src/lib/cody/task-parser.ts` (NEW), `tests/unit/lib/cody/task-parser.test.ts` (NEW)

**Exports**:
- `parseComment(comment: GitHubComment): ParsedComment | null`
- `parseAllComments(comments: GitHubComment[]): ParsedComment[]`
- `getLatestByType(comments: ParsedComment[], type: CommentType): ParsedComment | null`
- `extractStageProgress(comment: ParsedComment): StageProgress[]` — from running status comments

**ParsedComment type**:
```typescript
interface ParsedComment {
  type: CommentType
  taskId?: string
  createdAt: string
  body: string
  // type-specific fields:
  error?: string           // for failure types
  retryNumber?: number     // for supervisor-retry
  maxRetries?: number      // for supervisor-retry
  stages?: StageProgress[] // for running-status
  mode?: string            // for task-marker
}
```

**Tests** (integration-style with real comment samples from the codebase):
- Parse task marker: `🎯 Task created: \`260219-auto-98\` (\`full\` mode)\nRun: https://...`
- Parse running status with multiple stages and icons
- Parse success: `✅ Cody completed for \`260219-auto-98\`!`
- Parse failure (catch): `❌ Pipeline failed for \`260219-auto-98\`: Stage "build" failed`
- Parse failure (status): `❌ Cody failed for \`260219-auto-98\``
- Parse timeout: `⏰ Cody timed out for \`260219-auto-98\``
- Parse hard-stop gate: `## 🚫 Hard Stop: Approval Required\n...`
- Parse risk gate: `## 🚦 Risk Gate: Approval Required\n...`
- Parse clarify stop: `🔄 Cody stopped at clarify stage - questions need answering:...`
- Parse supervisor retry: `[supervisor-retry: 2/3]\n\n## Failure Analysis\n...`
- Parse supervisor exhausted: `[supervisor-retry: 3/3]\n\n## Supervisor: Max Retries Exhausted\n...`
- Parse gate approval: `/cody approve`
- Parse gate rejection: `/cody reject`
- `getLatestByType` returns newest matching comment
- Unknown comment → returns null

---

### TASK-05: board-mapper

**Goal**: Derive kanban columns from issue state + comments + workflow runs.
**Dependencies**: TASK-02, TASK-04
**Files**: `src/lib/cody/board-mapper.ts` (NEW), `tests/unit/lib/cody/board-mapper.test.ts` (NEW)

**Exports**:
- `deriveColumn(issue, comments, workflowRun?, associatedPR?): ColumnId`
- `organizeBoard(tasks: CodyTask[]): Record<ColumnId, CodyTask[]>`
- `getVisibleColumns(tasks: CodyTask[]): ColumnId[]` — only show columns that have tasks (except always show Open/Building/Done)

**Tests** (11 scenarios):
1. No task marker → 'open'
2. Task marker, workflow running → 'building'
3. Task marker, no workflow → 'building' (queued)
4. Completion comment → 'done'
5. PR merged → 'done'
6. Failure + exhausted → 'failed'
7. Hard-stop gate, no approval → 'gate-waiting'
8. Risk gate, then approved → 'building' (not gate-waiting)
9. Supervisor retry (1/3), not exhausted → 'retrying'
10. Open PR (not merged) → 'review'
11. Completion after failure (recovery) → 'done'

---

### TASK-06: api-tasks-boards

**Goal**: Create API routes for fetching tasks and boards.
**Dependencies**: TASK-03, TASK-04, TASK-05
**Files**:
- `src/app/api/cody/boards/route.ts` (NEW)
- `src/app/api/cody/tasks/route.ts` (NEW)

**`GET /api/cody/boards`**:
- Auth check
- Fetch labels: `octokit.issues.listLabelsForRepo()`
- Fetch milestones: `octokit.issues.listMilestones()`
- Return `[{ id: 'all', name: 'All', type: 'all' }, ...labels, ...milestones]`

**`GET /api/cody/tasks?board=all&limit=50`**:
- Auth check
- Fetch issues with label/milestone filter
- For each issue: fetch comments, parse them, find workflow runs, find PRs
- Derive column for each
- Return `{ tasks: CodyTask[], columns: ColumnId[] }`

**`POST /api/cody/tasks`**:
- Auth check
- Validate body with Zod: `{ title, body, labels?, triggerWorkflow?, mode? }`
- Create issue via Octokit
- If triggerWorkflow: dispatch workflow with generated taskId
- Return `{ issue, taskId? }`

**Tests**: Integration tests with mocked Octokit (test auth gating, error handling).

---

### TASK-07: cody-layout-page

**Goal**: Create the (cody) route group with auth-gated layout.
**Dependencies**: TASK-01 (spike result determines Gemini vs OpenAI)
**Files**:
- `src/app/(cody)/layout.tsx` (NEW)
- `src/app/(cody)/cody/page.tsx` (NEW — upgrade from spike)

**layout.tsx**:
- Own `<html>`/`<body>` tags (required since no shared root)
- Tailwind CSS import
- `<CopilotKit runtimeUrl="/api/copilotkit">` provider
- No i18n, no locale — English only

**page.tsx**:
- Client component with own auth check (cody-session cookie)
- If not authenticated: redirect to `/cody/login`
- If not admin: show "Access Denied"
- If admin: render `<CodyDashboard />`

---

### TASK-08: kanban-board

**Goal**: Kanban board UI with columns and cards.
**Dependencies**: TASK-07, TASK-09
**Files**:
- `src/ui/admin/CodyBoard/KanbanBoard.tsx` (NEW)
- `src/ui/admin/CodyBoard/KanbanColumn.tsx` (NEW)
- `src/ui/admin/CodyBoard/KanbanCard.tsx` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (NEW — shell)

**KanbanBoard**: Horizontal flex layout, receives `tasks` and `columns`, maps to KanbanColumn.
**KanbanColumn**: Vertical card list with header showing column name + count.
**KanbanCard**: Shows task ID, issue title, stage progress icons, risk badge. Click → sets selected task.
**CodyDashboard**: Top-level layout combining board + detail panel (detail panel is placeholder until TASK-13).

**Own components**: Card, Badge in `src/app/(cody)/components/` (no A-Guy imports)

---

### TASK-09: shared-badges

**Goal**: Badge components for task metadata.
**Dependencies**: TASK-02
**Files**:
- `src/ui/admin/CodyShared/StatusBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/RiskBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/TaskTypeBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/types.ts` (NEW — re-exports from lib/cody/types)

**StatusBadge**: running=blue, completed=green, failed=red, timeout=orange, gate-waiting=yellow
**RiskBadge**: low=green, medium=yellow, high=red
**TaskTypeBadge**: implement_feature=blue, fix_bug=red, spec_only=gray, etc.

---

### TASK-10: board-switcher

**Goal**: Board tabs for switching between label/milestone boards.
**Dependencies**: TASK-06, TASK-08
**Files**: `src/ui/admin/CodyBoard/BoardSwitcher.tsx` (NEW)

**Behavior**: Fetches boards from `/api/cody/boards`, renders tabs. "All" always first. Click → re-fetches tasks with board filter.

---

### TASK-11: api-pipeline-workflows

**Goal**: API routes for pipeline status and workflow runs.
**Dependencies**: TASK-03
**Files**:
- `src/app/api/cody/pipeline/[taskId]/route.ts` (NEW)
- `src/app/api/cody/workflows/route.ts` (NEW)
- `src/app/api/cody/prs/route.ts` (NEW)

**`GET /api/cody/pipeline/[taskId]`**:
- Try: branch status.json → artifact status.json → parsed comments
- Return: `{ status: CodyPipelineStatus | null, source: 'branch' | 'artifact' | 'comments' }`

**`GET /api/cody/workflows`**:
- List workflow runs for `cody.yml`: `octokit.actions.listWorkflowRuns()`
- Return active/recent runs

**`GET /api/cody/prs`**:
- List open PRs
- Filter by branch prefix pattern

---

### TASK-12: pipeline-viz

**Goal**: Pipeline visualization components.
**Dependencies**: TASK-02, TASK-09
**Files**:
- `src/ui/admin/CodyPipeline/PipelineStatus.tsx` (NEW)
- `src/ui/admin/CodyPipeline/StageIndicator.tsx` (NEW)

**PipelineStatus**: Two rows — spec stages (taskify, spec, clarify) and impl stages (architect through pr). Shows autofix as sub-indicator under verify.
**StageIndicator**: Circle with icon (✅❌🔄⏳⚪), label, elapsed time if available.

---

### TASK-13: task-detail

**Goal**: Expandable detail panel for selected task.
**Dependencies**: TASK-11, TASK-12, TASK-14
**Files**: `src/ui/admin/CodyTasks/TaskDetail.tsx` (NEW)

**Shows**: Pipeline status, task metadata (type, risk, domain, scope), latest error, run URL, supervisor retries.
**Fetches**: `/api/cody/pipeline/{taskId}` for status, `/api/cody/tasks/{taskId}` for detail.

---

### TASK-14: supervisor-log

**Goal**: Supervisor retry timeline.
**Dependencies**: TASK-02
**Files**: `src/ui/admin/CodyPipeline/SupervisorLog.tsx` (NEW)

**Shows**: Timeline of supervisor retry comments — attempt number, root cause, refined feedback, rerun command.
**Data**: Extracted from ParsedComment[] where type === 'supervisor-retry'.

---

### TASK-15: copilotkit-runtime

**Goal**: Production CopilotKit runtime route (upgrade from spike).
**Dependencies**: TASK-01, TASK-07
**Files**: `src/app/api/copilotkit/route.ts` (MODIFIED — from spike)

**Upgrades from spike**:
- Add dashboard auth check (requireDashboardAuth)
- Add system prompt (from Chat System Prompt section)
- Configure model parameters
- Error handling for missing API keys

---

### TASK-16: chat-panel

**Goal**: Chat panel component wrapping CopilotKit.
**Dependencies**: TASK-15
**Files**: `src/ui/admin/CodyChat/CodyChatPanel.tsx` (NEW)

**Component**: Wraps `<CopilotChat>` with custom styling to match dashboard. Positioned as collapsible panel on the right side.

---

### TASK-17: chat-actions-context

**Goal**: Wire CopilotKit actions and readable context.
**Dependencies**: TASK-16, TASK-06, TASK-11
**Files**:
- `src/ui/admin/CodyDashboard/CodyActions.tsx` (NEW)
- `src/ui/admin/CodyDashboard/CodyContext.tsx` (NEW)

**CodyActions** (useCopilotAction):
- `listTasks` — fetches tasks from /api/cody/tasks
- `getTaskStatus` — fetches pipeline status
- `getWorkflowRuns` — fetches active workflows
- `createTask` — creates issue + triggers workflow
- `approveGate` — posts /cody approve
- `rerunTask` — triggers rerun workflow dispatch
- `abortTask` — cancels workflow run

**CodyContext** (useCopilotReadable):
- Selected task details
- Current board name
- Active pipeline status

---

### TASK-18: api-actions-create

**Goal**: Task actions API route + CreateTaskDialog.
**Dependencies**: TASK-06, TASK-11
**Files**:
- `src/app/api/cody/tasks/[taskId]/route.ts` (NEW)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (NEW)
- `src/ui/admin/CodyTasks/CreateTaskDialog.tsx` (NEW)

**`GET /api/cody/tasks/[taskId]`**: Full task detail (issue + comments + pipeline).

**`POST /api/cody/tasks/[taskId]/actions`**:
- Body: `{ action: 'approve' | 'reject' | 'rerun' | 'abort', feedback?, fromStage? }`
- approve: `octokit.issues.createComment({ body: '/cody approve' })`
- reject: `octokit.issues.createComment({ body: '/cody reject' })`
- rerun: `octokit.actions.createWorkflowDispatch({ workflow_id: 'cody.yml', ref: 'main', inputs: { task_id, mode: 'rerun', feedback, from_stage } })`
- abort: Find running workflow run, `octokit.actions.cancelWorkflowRun()`

**CreateTaskDialog**: Form with title, body, labels (optional), mode select, "Create & Run" button.

---

### TASK-19: adaptive-polling

**Goal**: Smart polling hook that adjusts interval based on context.
**Dependencies**: TASK-08, TASK-13
**Files**: `src/ui/admin/CodyDashboard/useAdaptivePolling.ts` (NEW)

**Hook**: `useAdaptivePolling({ tasks, selectedTask })` returns `{ isPolling }`
- Uses `setInterval` with dynamic interval
- Computes interval from task states
- Calls refetch on tasks/pipeline when interval fires
- Cleans up on unmount

---

### TASK-20: loading-empty-error

**Goal**: Loading skeletons, empty states, error handling.
**Dependencies**: TASK-08, TASK-13, TASK-16
**Files**: Multiple (MODIFIED — add loading/empty/error states to existing components)

- KanbanBoard: skeleton while loading
- KanbanColumn: empty state text
- TaskDetail: skeleton while loading
- CodyChatPanel: error state for missing API key
- Global: toast for API errors (429 rate limit, 502 token expired)
- Banner for missing GH_TOKEN

---

### TASK-21: quality-gates

**Goal**: Ensure all quality gates pass.
**Dependencies**: All previous tasks
**Files**: `.env.example` (MODIFIED — add GITHUB_TOKEN, CODY_DASHBOARD_SECRET)

**Steps**:
1. `pnpm tsc --noEmit` — fix all type errors
2. `pnpm lint` — fix all lint errors
3. `pnpm format:fix` — format all new files
4. Verify `GITHUB_TOKEN=` and `CODY_DASHBOARD_SECRET=` in `.env.example`
5. Run existing tests to verify no regressions
6. Manual smoke test: load /cody, verify board loads

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| CopilotKit + Gemini adapter | Medium | Phase 0 spike (TASK-01). Fallback to OpenAI. 2-hour time-box. |
| GitHub rate limiting | Low | Cache (10s TTL) + adaptive polling |
| Comment format changes | Medium | Solid regex tests in task-parser (TASK-04). Document contract. |
| Artifacts only after run completes | Low | Branch-based status.json + comment parsing fallback |
| No label convention exists | Low | "All" board works immediately. Labels are additive. |
| Large issue count (100+) | Low | Paginate API, limit to last 30 days by default |
| CopilotKit CSS conflicts | Low | Scoped to `(cody)` layout only. Test in TASK-01. |
| PR not linked to issue | Medium | Find PRs by branch name (Gap #7 fix) |
| Multiple running status comments | Medium | Sort by date, take latest (Gap #3 fix) |

---

## Testing Strategy

### Unit Tests (Critical — in scope)
- `task-parser.ts` — every comment type regex against real samples (TASK-04)
- `board-mapper.ts` — column derivation for every lifecycle state (TASK-05)
- `github-client.ts` — branch discovery, cache TTL (TASK-03)

### Integration Tests (Deferred to TASK-06)
- API routes with mocked Octokit
- Auth gating (admin-only access)

### Manual Testing
- Create issue, comment `/cody`, watch card move through columns
- Test all chat actions
- Test gate approval flow
- Test with 0 issues (empty state), 1 issue, 20+ issues

---

## Dependency Graph

```
TASK-01 (spike) ─────────────────────────┐
                                         │
TASK-02 (types) ──┬── TASK-04 (parser) ──┤
                  │                      │
                  ├── TASK-09 (badges) ──┤
                  │                      │
                  ├── TASK-14 (sup-log) ─┤
                  │                      │
                  └── TASK-12 (pipe-viz)─┤
                                         │
TASK-03 (gh-client) ─┬── TASK-05 (mapper, needs 04) ──┐
                     │                                 │
                     └── TASK-11 (api-pipeline) ───────┤
                                                       │
TASK-06 (api-tasks, needs 03,04,05) ──────────────────┤
                                                       │
TASK-07 (layout, needs 01) ──┬── TASK-08 (board, needs 09) ─┐
                             │                               │
                             └── TASK-15 (runtime, needs 01) │
                                                             │
TASK-10 (switcher, needs 06,08) ─────────────────────────────┤
                                                             │
TASK-13 (detail, needs 11,12,14) ────────────────────────────┤
                                                             │
TASK-16 (chat, needs 15) ───── TASK-17 (actions, needs 16,06,11)
                                                             │
TASK-18 (api-actions, needs 06,11) ──────────────────────────┤
                                                             │
TASK-19 (polling, needs 08,13) ──────────────────────────────┤
                                                             │
TASK-20 (polish, needs 08,13,16) ────────────────────────────┤
                                                             │
TASK-21 (quality, needs all) ────────────────────────────────┘
```

**Critical path**: TASK-01 → TASK-02 → TASK-04 → TASK-05 → TASK-06 → TASK-08 → TASK-13 → TASK-19

**Parallelizable pairs**:
- TASK-02 + TASK-03 (no deps on each other)
- TASK-04 + TASK-09 + TASK-14 (all depend only on TASK-02)
- TASK-11 + TASK-06 (different API routes)
- TASK-12 + TASK-10 (different UI components)

---

## Open Items / V2 Enhancements

- [ ] Payload collections for persistent task management
- [ ] Draft tasks before GitHub issue creation
- [ ] Drag-and-drop between columns
- [ ] Real-time SSE via GitHub webhooks
- [ ] Browser notifications
- [ ] Task templates
- [ ] Analytics (success rate, duration, cost)
- [ ] MCP integration (CopilotKit → OpenCode MCP)
