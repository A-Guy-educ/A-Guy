# Plan: GitHub Actions Orchestrated Pipeline

**Date:** 2026-02-17
**Status:** Approved for Implementation
**Revision:** 2 (post-review, all critical/medium/minor findings addressed)

---

## Summary

Create a new `pipeline-orchestrated.yml` workflow and a `scripts/orchestrator.ts` script that runs the multi-agent pipeline in CI, triggered by `workflow_dispatch` or issue/PR comments (`/oc <subcommand>`). The orchestrator controls the agent sequence, calls `opencode github run` for each stage, and posts results back as GitHub comments.

---

## Architecture

```
Trigger (comment or dispatch)
  → GitHub Action
    → Job 1: parse (read-only, lightweight)
      → validate trigger, extract params, output { mode, taskId, ... }
    → Job 2: orchestrate (write permissions, depends on parse)
      → obtain GitHub App installation token (via OpenCode action)
      → orchestrator.ts (brain: sequence agents, handle failures)
        → opencode github run --agent <stage> (uses exported token)
          → writes artifacts to .tasks/<task-id>/
        → posts results as GitHub comments
      → upload artifacts
```

### Responsibility Matrix

| Layer | Responsibility | NOT Responsible For |
|-------|---------------|---------------------|
| **GitHub Action** | Trigger handling, env setup, auth context, concurrency, permissions | Business logic, agent sequencing |
| **Orchestrator** | Input normalization, agent sequencing, failure handling, artifact management, comment posting | Authentication negotiation, token issuance |
| **OpenCode CLI** | Agent execution, model invocation, GitHub API interaction | Multi-step orchestration, cross-agent logic |
| **GitHub App** | Authentication identity, token issuance | Any runtime decisions |

---

## New Files

| File | Purpose |
|------|---------|
| `.github/workflows/pipeline-orchestrated.yml` | Workflow definition (two-job: parse + orchestrate) |
| `scripts/orchestrator.ts` | Central orchestration logic |
| `scripts/orchestrator-utils.ts` | CI-specific utilities (comment parsing, GitHub API helpers, status file management) |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `pipeline:orchestrate` script |
| `scripts/pipeline-utils.ts` | Extract shared types/functions (reused by both local and CI pipelines) |

---

## Workflow Design (`.github/workflows/pipeline-orchestrated.yml`)

### Triggers

1. **`workflow_dispatch`** — manual with inputs: `task_id`, `mode` (spec/impl/rerun/full/status), `dry_run`, `feedback`, `from_stage`
2. **`issue_comment`** — `/oc <subcommand> <task-id> [options]`

### Supported Commands

```
/oc spec <task-id>          # Run Phase 1: taskify → spec → clarify
/oc impl <task-id>          # Run Phase 2: architect → build → test → verify → auditor → pr
/oc rerun <task-id> [--from <stage>] [--feedback "..."]
/oc status <task-id>        # Post current pipeline status as comment
/oc full <task-id>          # Run Phase 1 + auto-clarify + Phase 2
```

### Comment Trigger Safety Rules

1. **Trigger pattern:** only when comment body matches `^/oc\s+` (start of body)
2. **Bot filter:** ignore comments created by `github-actions[bot]` or the GitHub App actor
3. **Author filter:** reject commands from non-collaborators (check `github.event.comment.author_association` is `OWNER`, `MEMBER`, or `COLLABORATOR`)
4. **Strict parsing:** reject unknown subcommands/flags; post error comment for malformed input
5. **No secret leakage:** never echo env vars, tokens, or API keys into comments

### Concurrency

```yaml
concurrency:
  group: pipeline-${{ github.event.inputs.task_id || github.event.issue.number }}
  cancel-in-progress: false  # Don't cancel running pipelines
```

**Constraint:** For comment triggers, concurrency is scoped to `issue.number` (not task-id) because GitHub Actions evaluates concurrency groups at job definition time, before any parsing step runs. This means two different tasks triggered from the same issue will serialize. This is acceptable — one issue should map to one active pipeline at a time.

For `workflow_dispatch`, the exact `task_id` is used.

### Two-Job Structure

#### Job 1: `parse` (read-only)

**Purpose:** Validate trigger, extract parameters, gate execution.

**Permissions (minimal):**
```yaml
permissions:
  issues: read
  pull-requests: read
  contents: read
```

**Steps:**
1. Determine trigger type (dispatch vs comment)
2. For comments: validate author association, check bot filter, parse command
3. For dispatch: read inputs directly
4. Normalize to canonical `OrchestratorInput` format
5. Set job outputs: `task_id`, `mode`, `dry_run`, `from_stage`, `feedback`, `issue_number`, `valid`

**Outputs:**
```yaml
outputs:
  task_id: ${{ steps.parse.outputs.task_id }}
  mode: ${{ steps.parse.outputs.mode }}
  dry_run: ${{ steps.parse.outputs.dry_run }}
  from_stage: ${{ steps.parse.outputs.from_stage }}
  feedback: ${{ steps.parse.outputs.feedback }}
  issue_number: ${{ steps.parse.outputs.issue_number }}
  valid: ${{ steps.parse.outputs.valid }}
```

**Fail behavior:** If parsing fails or author is unauthorized, set `valid=false` and (for comments) post an error comment via `gh` CLI.

#### Job 2: `orchestrate` (write permissions)

**Condition:** `needs.parse.outputs.valid == 'true'`

**Permissions (scoped to what's needed):**
```yaml
permissions:
  id-token: write        # OpenCode GitHub App OIDC
  contents: write        # Branch/commit operations
  pull-requests: write   # Create PRs, post comments
  issues: write          # Post status comments
```

**Steps:**
1. Checkout repo
2. Install Node 22 + pnpm + dependencies
3. Obtain GitHub App installation token (via `anomalyco/opencode/github@latest` action token export step)
4. Export token to env var (`OPENCODE_GITHUB_TOKEN`)
5. Run `pnpm pipeline:orchestrate` with parsed inputs from Job 1
6. Upload `.tasks/<task-id>/` as artifact
7. Post summary comment on completion/failure

### Auth Contract

```
anomalyco/opencode/github@latest (setup step)
  → obtains GitHub App installation token via OIDC
  → exports token as env var: OPENCODE_GITHUB_TOKEN

orchestrator.ts
  → reads OPENCODE_GITHUB_TOKEN from env
  → passes to each `opencode github run` invocation

opencode github run
  → uses OPENCODE_GITHUB_TOKEN for GitHub API operations
  → no interactive auth, no manual PAT
```

**Single channel rule:** The token flows through exactly one env var (`OPENCODE_GITHUB_TOKEN`). The orchestrator never generates, refreshes, or negotiates tokens. If the token is missing or expired, the orchestrator fails immediately with a clear error.

### Environment Variables

All LLM provider keys are passed to support flexible model selection per agent/stage:

```yaml
env:
  # Auth
  OPENCODE_GITHUB_TOKEN: ${{ steps.auth.outputs.token }}

  # LLM provider keys (all available, each agent picks its model)
  MINIMAX_API_KEY: ${{ secrets.MINIMAX_API_KEY }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
```

Each agent/stage uses whichever model it's configured for. Model selection is delegated to agent definitions in `.opencode/agents/*.md` or the orchestrator's stage config — not hardcoded in the workflow.

---

## Orchestrator Design (`scripts/orchestrator.ts`)

### Input Schema (Canonical Internal Representation)

```typescript
interface OrchestratorInput {
  mode: 'spec' | 'impl' | 'rerun' | 'full' | 'status'
  taskId: string
  dryRun: boolean
  fromStage?: string          // for rerun
  feedback?: string           // for rerun
  issueNumber?: number        // for comment posting
  repo?: string               // owner/repo
}
```

**Normalization rule:** All inputs — whether from `workflow_dispatch`, comment parsing, or CLI args — are normalized to this single `OrchestratorInput` interface before any logic runs. Comments map subcommands to `mode`. Dispatch supplies `mode` directly. No exceptions. No alternate representations flow past the normalization boundary.

### Key Differences from `pipeline-impl.ts`

| Concern | Local (`pipeline-impl.ts`) | CI (`orchestrator.ts`) |
|---------|---------------------------|------------------------|
| Agent invocation | `pnpm ocode run --agent` | `opencode github run --agent` |
| Auth | `OPENCODE_API_KEY` env var | `OPENCODE_GITHUB_TOKEN` (GitHub App, exported by setup step) |
| Output | Console logs | Console + GitHub comments + status.json |
| Interactive prompts | Readline for feedback | No prompts (headless, all input via dispatch/comments) |
| Branch creation | `git checkout -b` locally | Via OpenCode GitHub mode or `gh` CLI |
| File watching | Polls for output file | Same pattern (works in CI) |
| Error recovery | Manual rerun | Comment-triggered rerun (`/oc rerun`) |
| Human loop | Local clarified.md editing | `/oc spec` posts questions → human answers → `/oc impl` |

### Reused from Existing Pipeline

- `pipeline-utils.ts`: `readTask()`, `validateTask()`, `writeAgentContext()`, `stageOutputFile()`, stage definitions, dry-run support
- `preflight.ts`: Adapted for CI (skip local `ocode` check; verify `OPENCODE_GITHUB_TOKEN` is set)
- Agent definitions: `.opencode/agents/*.md` (unchanged)
- Task structure: `.tasks/<task-id>/` (unchanged)

### New CI-Specific Capabilities

- `postComment(issueNumber, body)` — Posts structured markdown to issue/PR via `gh` CLI
- `parseCommand(commentBody)` — Extracts subcommand, task-id, options from comment body; returns `OrchestratorInput` or error
- `updateStatus(taskDir, stage, state)` — Updates `status.json` (see Status section below)
- `reportProgress(issueNumber, stage, total, state)` — Posts/edits progress comment

### Timeout Enforcement

Each stage runs inside a wrapper that:

1. Spawns the `opencode github run` process
2. Starts a timer for the stage-specific timeout
3. If timeout fires: sends SIGTERM, waits 5s, sends SIGKILL if still alive
4. Updates `status.json` with `{ stage, state: 'timeout', elapsed }`
5. Logs timeout to console and posts failure comment
6. Applies retry logic (max 2 retries per stage, same as existing)

```typescript
const STAGE_TIMEOUTS: Record<string, number> = {
  architect: 5 * 60_000,
  build: 30 * 60_000,
  test: 10 * 60_000,
  verify: 5 * 60_000,
  auditor: 5 * 60_000,
  pr: 5 * 60_000,
}
```

---

## Status Source of Truth

### `status.json` Schema

Every pipeline run maintains `.tasks/<task-id>/status.json`:

```typescript
interface PipelineStatus {
  taskId: string
  mode: string
  pipeline: string                    // 'spec_only' | 'spec_execute_verify'
  startedAt: string                   // ISO 8601
  updatedAt: string                   // ISO 8601
  state: 'running' | 'completed' | 'failed' | 'timeout'
  currentStage: string | null
  stages: Record<string, StageStatus>
  triggeredBy: string                 // 'dispatch' | 'comment'
  issueNumber?: number
  runId?: string                      // GitHub Actions run ID
  runUrl?: string                     // GitHub Actions run URL
}

interface StageStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped'
  startedAt?: string
  completedAt?: string
  elapsed?: number                    // milliseconds
  retries: number
  outputFile?: string                 // relative path to output
  error?: string                      // failure reason (truncated, no secrets)
}
```

**Rules:**
- Updated in real-time as each stage starts/completes/fails
- The `/oc status` command reads this file and formats it as a comment
- Never contains secrets, tokens, or full error traces
- Committed to the task directory alongside other artifacts

---

## Comment Interaction Flow

### Phase 1 (spec)

```
Human posts:    /oc spec 260217-user-metrics
Bot comments:   🔄 Pipeline: Running spec for 260217-user-metrics...
                Run: https://github.com/.../actions/runs/12345
Bot comments:   ✅ Spec complete for 260217-user-metrics

                **Questions for clarification:**
                1. Should metrics include API response times?
                2. Export formats: CSV only or also JSON/PDF?

                📋 Answer in a follow-up comment, then run:
                `/oc impl 260217-user-metrics`
```

### Phase 2 (impl)

```
Human posts:    /oc impl 260217-user-metrics
Bot comments:   🔄 Pipeline: Running impl for 260217-user-metrics...
                Stage 1/6: architect ✅
                Stage 2/6: build 🔄 running...
Bot edits:      🔄 Pipeline: Running impl for 260217-user-metrics...
                Stage 1/6: architect ✅ (2m 14s)
                Stage 2/6: build ✅ (12m 03s)
                Stage 3/6: test 🔄 running...
Bot edits:      ✅ Pipeline complete for 260217-user-metrics!
                All stages passed. PR: #142
```

### Rerun

```
Human posts:    /oc rerun 260217-user-metrics --feedback "TypeScript errors in MetricsService"
Bot comments:   🔄 Re-running from build with feedback...
Bot comments:   ✅ Rerun complete! PR #142 updated.
```

### Error

```
Human posts:    /oc blah 260217-user-metrics
Bot comments:   ❌ Unknown command `blah`.
                Valid commands: `spec`, `impl`, `rerun`, `status`, `full`
```

### Unauthorized

```
Random user:    /oc full 260217-user-metrics
(no response — workflow `if` condition rejects non-collaborators)
```

---

## Guardrails

1. **Headless execution** — No interactive prompts in CI; all input via dispatch/comments
2. **Deterministic input schema** — All inputs normalized to `OrchestratorInput`; reject malformed
3. **Dry-run capability** — `--dry-run` flag on all modes; writes mock outputs, posts "[DRY RUN]" comments
4. **Scoped permissions** — Parse job is read-only; write permissions only on orchestrate job
5. **Concurrency boundaries** — One pipeline per `task_id` (dispatch) or `issue.number` (comments)
6. **Bot loop prevention** — Ignore comments from bot actors; only trigger on `^/oc\s+` pattern
7. **Author gating** — Only `OWNER`, `MEMBER`, `COLLABORATOR` can trigger via comments
8. **Artifact generation** — Every run uploads `.tasks/<task-id>/` with status.json for observability
9. **Timeout enforcement** — Per-stage wrapper with SIGTERM → SIGKILL → status update → retry
10. **Max retries** — 2 retries per stage (same as existing)
11. **No secret leakage** — Comments never contain env vars, tokens, or full stack traces
12. **Single auth channel** — Token flows through `OPENCODE_GITHUB_TOKEN` env var only

---

## Artifact Management

### Upload Policy

- **What:** `.tasks/<task-id>/` directory (all stage outputs + status.json)
- **When:** After every orchestrate job run (success or failure)
- **Retention:** 7 days (sufficient for debugging; task files are also committed to the branch)
- **Size expectation:** Typically 50-200KB per task (markdown files + JSON)
- **Name pattern:** `pipeline-<task-id>-<run-id>`

### Committed Artifacts

Stage outputs (plan.md, build.md, verify.md, etc.) and status.json are committed to the feature branch by the orchestrator, so they persist beyond artifact retention. The uploaded artifact serves as a debugging snapshot for failed runs that never commit.

---

## Migration Path

1. **Phase 1** (this implementation): New workflow + orchestrator, coexists with existing `pipeline.yml`
2. **Phase 2** (future): Deprecate `pipeline.yml` once orchestrated mode is stable
3. **Phase 3** (future): Add scheduled trigger for batch task processing

The existing local pipeline (`pipeline:spec`, `pipeline:impl`, `pipeline:rerun`) remains untouched — developers can still run pipelines locally.

---

## Estimated Work

| Component | Effort |
|-----------|--------|
| `pipeline-orchestrated.yml` | ~120 lines YAML (two jobs, safety filters) |
| `scripts/orchestrator.ts` | ~350 lines (heavy reuse from pipeline-impl.ts, + status management) |
| `scripts/orchestrator-utils.ts` | ~200 lines (comment parsing, GitHub API, status.json, auth validation) |
| `package.json` script | 1 line |
| **Total** | **~670 lines new code** |

---

## Command Reference

### Local Development

```bash
# Run orchestrated pipeline locally (for testing)
pnpm pipeline:orchestrate --task-id=<task-id> --mode=full

# Specific modes
pnpm pipeline:orchestrate --task-id=<task-id> --mode=spec
pnpm pipeline:orchestrate --task-id=<task-id> --mode=impl
pnpm pipeline:orchestrate --task-id=<task-id> --mode=rerun --from=build --feedback="fix this"
pnpm pipeline:orchestrate --task-id=<task-id> --mode=status

# Dry run
pnpm pipeline:orchestrate --task-id=<task-id> --mode=full --dry-run
```

### GitHub Comments

```bash
# Phase 1: Create spec and questions
/oc spec 260217-user-metrics

# Phase 2: Run implementation (after human answers questions)
/oc impl 260217-user-metrics

# Full pipeline with auto-clarify
/oc full 260217-user-metrics

# Rerun with feedback
/oc rerun 260217-user-metrics --feedback "TypeScript errors"

# Check status
/oc status 260217-user-metrics
```

### Manual Workflow Dispatch

```yaml
# In GitHub UI
inputs:
  task_id: "260217-user-metrics"
  mode: "full"
  dry_run: false
  feedback: ""
  from_stage: ""
```

---

## Review Findings Addressed

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | Concurrency key wrong for comment triggers | Use `task_id \|\| issue.number` fallback; documented constraint |
| 2 | Critical | Comment triggers can create infinite loops | Bot actor filter + `^/oc\s+` regex + author_association gating |
| 3 | Critical | Auth "implicit" is a hand-wave | Explicit token export step → `OPENCODE_GITHUB_TOKEN` env var contract |
| 4 | Medium | Command model inconsistent | Canonical `OrchestratorInput` normalization rule; one representation past boundary |
| 5 | Medium | Permissions too generous | Two-job split: parse (read-only) → orchestrate (write) |
| 6 | Medium | Status command has no source of truth | `.tasks/<task-id>/status.json` with defined schema |
| 7 | Minor | Artifact retention undefined | 7-day retention, 50-200KB expected, named `pipeline-<task-id>-<run-id>` |
| 8 | Minor | Timeout enforcement hand-waved | Per-stage wrapper: spawn → timer → SIGTERM → SIGKILL → status update → retry |
