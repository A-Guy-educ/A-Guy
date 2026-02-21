# TASK-20: Loading States, Empty States, Error Handling

## Summary
Add loading skeletons, empty state messages, and error handling across all dashboard components.

## Task Type
implement_feature

## Dependencies
- TASK-08 (board), TASK-13 (detail), TASK-16 (chat)

## Requirements

### R1: Loading skeletons
- KanbanBoard: Show 3 skeleton columns with 2-3 skeleton cards each while loading
- TaskDetail: Show skeleton layout while pipeline fetches
- BoardSwitcher: Show skeleton tabs while boards load
- Create own skeleton: simple div with `animate-pulse bg-gray-200 rounded` — no imports from ui/web

### R2: Empty states
- KanbanColumn with 0 tasks: Show "No tasks" text in muted color
- Board with 0 issues: Show "No issues found. Create one to get started." with link to create
- No pipeline data: Show "No pipeline data available" in TaskDetail
- No boards: Show only "All" tab

### R3: Error handling
- API errors: Show toast notification using own simple toast (or react-hot-toast if needed — lightweight, no A-Guy deps)
- Rate limit (429): Toast with "GitHub API rate limit reached. Retrying in 60s."
- Token expired (502): Banner at top "GitHub token expired. Check GH_TOKEN."
- Network error: Toast with "Network error. Check your connection."
- Missing GH_TOKEN: Show setup instructions instead of board

### R4: Error boundaries
- Wrap CodyDashboard in error boundary
- Show fallback UI with "Something went wrong" + retry button

## Files to Modify
- `src/ui/admin/CodyBoard/KanbanBoard.tsx` (MODIFIED)
- `src/ui/admin/CodyBoard/KanbanColumn.tsx` (MODIFIED)
- `src/ui/admin/CodyBoard/BoardSwitcher.tsx` (MODIFIED)
- `src/ui/admin/CodyTasks/TaskDetail.tsx` (MODIFIED)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED)

## Acceptance Criteria
- [ ] Loading states show while data fetches
- [ ] Empty columns show appropriate message
- [ ] API errors show toast notifications
- [ ] Token issues show banner
- [ ] Error boundary catches crashes
- [ ] `pnpm tsc --noEmit` passes

### R5: Keyboard shortcuts
- `n` — Open CreateTaskDialog
- `a` — Approve gate (when detail panel open and task is gate-waiting)
- `r` — Rerun task (when detail panel open and task is failed)
- `Escape` — Close detail panel / close dialog
- `?` — Show keyboard shortcut help overlay
- Use `useEffect` with `keydown` listener, check `document.activeElement` to avoid triggering in inputs
- Only active when no input/textarea is focused
