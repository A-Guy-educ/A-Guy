# TASK-13: Task Detail Panel

## Summary
Create an expandable detail panel that shows full task information when a card is selected on the kanban board.

## Task Type
implement_feature

## Dependencies
- TASK-11 (pipeline API), TASK-12 (pipeline viz), TASK-14 (supervisor log)

## Requirements

### R1: TaskDetail component
- File: `src/ui/admin/CodyTasks/TaskDetail.tsx`
- Client component
- Props: `task: CodyTask`, `onClose: () => void`
- Fetches detailed data: `/api/cody/pipeline/${task.taskId}` for pipeline status
- Sections:
  1. **Header**: Issue title, number, link to GitHub, status badge, close button
  2. **Metadata**: Task type, risk level, domain, scope (from task.json via pipeline status)
  3. **Pipeline**: PipelineStatus component
  4. **Supervisor**: SupervisorLog component (if retries exist)
  5. **Actions**: Buttons for approve, reject, rerun, abort (wired in TASK-18)
  6. **Latest Error**: Error message from failure comment (if any)
  7. **Run Link**: Link to GitHub Actions run URL
  8. **Assignees**: Show assigned users with option to add/remove (calls assign/unassign action)
  9. **Labels**: Show labels as badges with option to add/remove (calls add-label/remove-label action)
  10. **Edit Description**: Expandable textarea to edit the issue body (calls update-body action, saves on blur or Cmd+Enter)
  11. **Duration**: Show total elapsed time from status.json (e.g., "Completed in 4m 32s") — visible for done/failed tasks
  12. **Preview**: Vercel deploy preview link (button, opens in new tab) — shown when task has previewUrl

### R2: Layout integration
- Update `src/ui/admin/CodyDashboard/index.tsx`
- When `selectedTask` is set, show TaskDetail below the kanban board
- SplitPaneLayout or simple conditional render
- Close button deselects task

### R3: Data fetching
- Fetch pipeline on mount and when taskId changes
- Use the task's comments (already in CodyTask) for supervisor log data
- Show loading skeleton while pipeline fetches

## Files to Create/Modify
- `src/ui/admin/CodyTasks/TaskDetail.tsx` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED — add detail panel)

## Acceptance Criteria
- [ ] Click card → detail panel appears below board
- [ ] Pipeline visualization shows current stage progress
- [ ] Supervisor retries show in timeline (if any)
- [ ] Close button dismisses panel
- [ ] Loading skeleton while fetching pipeline
- [ ] `pnpm tsc --noEmit` passes
