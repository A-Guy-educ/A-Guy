# TASK-18: Task Actions API + Create Task Dialog

## Summary
Create the task detail API route, actions API route (approve/reject/rerun/abort), and CreateTaskDialog UI.

## Task Type
implement_feature

## Dependencies
- TASK-06 (tasks API), TASK-11 (pipeline API)

## Requirements

### R1: GET /api/cody/tasks/[taskId]
- File: `src/app/api/cody/tasks/[taskId]/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
- Finds the issue that has this taskId in its comments:
  1. Search recent issues for one with task-marker containing the taskId
  2. Fetch all comments for that issue
  3. Parse comments
  4. Fetch pipeline status
  5. Fetch associated PR
- Return: Full CodyTask object with all enriched data

### R2: POST /api/cody/tasks/[taskId]/actions
- File: `src/app/api/cody/tasks/[taskId]/actions/route.ts`
- Auth: `requireDashboardAuth(req)` from `@/lib/cody/auth`
- Body validation:
```typescript
const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'rerun', 'abort', 'assign', 'unassign', 'add-label', 'remove-label', 'update-body']),
  feedback: z.string().optional(),
  fromStage: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  body: z.string().optional(),
})
```
- Actions:
  - **approve**: Find issue number for taskId → `octokit.issues.createComment({ body: '/cody approve' })`
  - **reject**: Find issue number → `octokit.issues.createComment({ body: '/cody reject' })`
  - **rerun**: `octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id: 'cody.yml', ref: 'main', inputs: { task_id: taskId, mode: 'rerun', feedback, from_stage: fromStage } })`
  - **abort**: Find active workflow run for this taskId → `octokit.actions.cancelWorkflowRun({ owner, repo, run_id })`
  - **assign**: `octokit.issues.addAssignees({ owner, repo, issue_number, assignees })`
  - **unassign**: `octokit.issues.removeAssignees({ owner, repo, issue_number, assignees })`
  - **add-label**: `octokit.issues.addLabels({ owner, repo, issue_number, labels })`
  - **remove-label**: For each label: `octokit.issues.removeLabel({ owner, repo, issue_number, name: label })`
  - **update-body**: `octokit.issues.update({ owner, repo, issue_number, body })` — edit the issue description
- Return: `{ success: true, action, message }` or error

### R3: CreateTaskDialog
- File: `src/ui/admin/CodyTasks/CreateTaskDialog.tsx`
- Client component
- Form fields:
  - Title (text input, required)
  - Description (textarea, required)
  - Labels (multi-select or comma-separated, optional)
  - Assignees (dropdown of repo collaborators, optional)
  - Mode (select: spec/impl/full, default: full)
  - "Create & Run" checkbox (triggers workflow after creating issue)
- Submit → POST /api/cody/tasks
- Success: close dialog, show toast, refresh board
- Error: show error message in dialog

### R4: Wire actions to TaskDetail
- Update `src/ui/admin/CodyTasks/TaskDetail.tsx` (from TASK-13)
- Add action buttons:
  - **Approve** (visible when column is 'gate-waiting')
  - **Reject** (visible when column is 'gate-waiting')
  - **Rerun** (visible when column is 'failed' or 'retrying')
  - **Abort** (visible when column is 'building')
- Each button calls POST /api/cody/tasks/[taskId]/actions
- Show loading state on button while action executes
- Refresh task data after action

### R5: Wire "Create Task" button
- Add "+" or "Create Task" button to dashboard header
- Opens CreateTaskDialog

## Files to Create/Modify
- `src/app/api/cody/tasks/[taskId]/route.ts` (NEW)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (NEW)
- `src/ui/admin/CodyTasks/CreateTaskDialog.tsx` (NEW)
- `src/ui/admin/CodyTasks/TaskDetail.tsx` (MODIFIED — add action buttons)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED — add create button)

## Acceptance Criteria
- [ ] GET /api/cody/tasks/[taskId] returns full task detail
- [ ] POST actions/approve posts `/cody approve` comment
- [ ] POST actions/rerun triggers workflow dispatch
- [ ] POST actions/abort cancels running workflow
- [ ] CreateTaskDialog creates issue and optionally triggers Cody
- [ ] Action buttons show/hide based on task column
- [ ] `pnpm tsc --noEmit` passes
- [ ] Invalid actions return 400

## Notes
- To find the issue number for a taskId: search issues for task marker comment containing the taskId. Or pass issueNumber through the CodyTask object.
- For abort: need to find the RUNNING workflow run. Use `octokit.actions.listWorkflowRuns({ workflow_id: 'cody.yml', status: 'in_progress' })` and match by taskId in the run name or head branch.
- `workflow_id: 'cody.yml'` is required for createWorkflowDispatch (Gap #10 fix).
