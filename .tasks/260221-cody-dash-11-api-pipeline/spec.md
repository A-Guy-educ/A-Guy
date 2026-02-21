# TASK-11: API Routes — Pipeline, Workflows, PRs

## Summary
Create API routes for fetching pipeline status (from branch/artifact/comments), active workflow runs, and Cody-related PRs.

## Task Type
implement_feature

## Dependencies
- TASK-03 (github-client)

## Requirements

### R1: GET /api/cody/pipeline/[taskId]
- File: `src/app/api/cody/pipeline/[taskId]/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
- Fetches pipeline status using fallback chain:
  1. Try branch: `findTaskBranch(taskId)` → `getStatusFromBranch(taskId, branch)`
  2. Try artifact: find latest workflow run for taskId → `getStatusFromArtifact(taskId, runId)` (V1: stub returns null)
  3. Fallback: parse stage progress from latest running-status comment
- Return: `{ status: CodyPipelineStatus | null, source: 'branch' | 'artifact' | 'comments' | null }`

### R2: GET /api/cody/workflows
- File: `src/app/api/cody/workflows/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
- Fetch: `octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: 'cody.yml', per_page: 20 })`
- Return: `{ runs: Array<{ id, status, conclusion, created_at, updated_at, html_url, head_branch }> }`
- Cache: 10s TTL

### R3: GET /api/cody/prs
- File: `src/app/api/cody/prs/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
- Fetch: `octokit.pulls.list({ owner, repo, state: 'open', per_page: 50 })`
- Filter: PRs whose head branch matches `{prefix}/{taskId}` pattern (any of 5 prefixes)
- Return: `{ prs: Array<{ number, title, url, branch, taskId, state, merged }> }`
- Cache: 30s TTL

### R4: Standard error handling and auth pattern (same as TASK-06)

## Files to Create
- `src/app/api/cody/pipeline/[taskId]/route.ts` (NEW)
- `src/app/api/cody/workflows/route.ts` (NEW)
- `src/app/api/cody/prs/route.ts` (NEW)

## Acceptance Criteria
- [ ] `pnpm tsc --noEmit` passes
- [ ] Pipeline endpoint returns status from branch (when branch exists)
- [ ] Pipeline endpoint returns null gracefully when no data found
- [ ] Workflows endpoint returns recent runs
- [ ] PRs endpoint filters by branch pattern
- [ ] All routes require admin auth
