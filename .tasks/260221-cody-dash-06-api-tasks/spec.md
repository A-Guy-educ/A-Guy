# TASK-06: API Routes — Tasks & Boards

## Summary
Create the server-side API routes for fetching tasks (with column derivation) and boards (from labels/milestones). These routes power the kanban board UI.

## Task Type
implement_feature

## Dependencies
- TASK-03 (github-client), TASK-04 (task-parser), TASK-05 (board-mapper)

## Requirements

### R1: GET /api/cody/boards
- File: `src/app/api/cody/boards/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth` — checks CODY_DASHBOARD_SECRET cookie/header
- Fetch labels: `octokit.issues.listLabelsForRepo({ owner, repo })`
- Fetch milestones: `octokit.issues.listMilestones({ owner, repo, state: 'open' })`
- Return: `{ boards: [{ id: 'all', name: 'All', type: 'all' }, ...labelBoards, ...milestoneBoards] }`
- Cache: 60s TTL via getCached

### R2: GET /api/cody/tasks
- File: `src/app/api/cody/tasks/route.ts`
- Auth: Same as R1
- Query params: `board` (label/milestone name, default 'all'), `limit` (default 50)
- Fetch issues:
  - If board is 'all': `octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: limit, sort: 'updated' })`
  - If board is a label: add `labels: board` filter
  - If board is a milestone: add `milestone: milestoneNumber` filter
  - Also include recently closed issues (last 7 days) for 'done' column
- For each issue:
  - Fetch comments: `octokit.issues.listComments({ owner, repo, issue_number })`
  - Parse comments via `parseAllComments()`
  - Find taskId from task-marker comment
  - If taskId: `findAssociatedPR(taskId)`, check for active workflow run
  - If associatedPR: fetch PR comments, find vercel[bot] comment, extract preview URL via `/\[Visit Preview\]\((https:\/\/[^)]+)\)/`
  - Derive column via `deriveColumn()`
  - Build CodyTask object
- Return: `{ tasks: CodyTask[], visibleColumns: ColumnId[] }`
- Cache: 10s TTL for the full board

### R3: POST /api/cody/tasks (Create)
- File: same as R2 (same route.ts, POST handler)
- Auth: Same
- Body validation with Zod:
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
- Create issue: `octokit.issues.create({ owner, repo, title, body, labels, assignees })`
- If triggerWorkflow:
  - Generate taskId: `YYMMDD-auto-{NN}` format (check existing tasks to find next number)
  - Dispatch workflow: `octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id: 'cody.yml', ref: 'main', inputs: { task_id: taskId, mode } })`
- Return: `{ issue: { number, url }, taskId }`

### R4: Error handling
All routes use try/catch with the standard error mapping:
- GitHub 401 → 502 (token expired)
- GitHub 403 → 429 (rate limit)
- GitHub 404 → 404
- Zod validation error → 400
- Other → 500

### R5: Auth pattern (decoupled)
```typescript
```

## Files to Create
- `src/app/api/cody/boards/route.ts` (NEW)
- `src/app/api/cody/tasks/route.ts` (NEW)

## Tests
- File: `tests/unit/lib/cody/api-tasks.test.ts` (optional — main logic is tested in TASK-04/05)
- The critical logic (parsing, column derivation) is already tested in task-parser and board-mapper tests
- API routes are best tested via manual testing or E2E

## Acceptance Criteria
- [ ] `pnpm tsc --noEmit` passes
- [ ] GET /api/cody/boards returns board list (manual test with curl)
- [ ] GET /api/cody/tasks returns tasks with columns derived (manual test)
- [ ] POST /api/cody/tasks creates issue and optionally dispatches workflow
- [ ] Unauthenticated requests get 401
- [ ] Non-admin users get 403
- [ ] GH_TOKEN not exposed in any response

## Notes
- Issues endpoint returns issues AND pull requests by default — filter out PRs with `!issue.pull_request`
- For closed issues in "done" column: use `state: 'closed'` with `since` parameter (ISO date, 7 days ago)
- The N+1 problem (fetching comments per issue) is mitigated by the 10s cache TTL
