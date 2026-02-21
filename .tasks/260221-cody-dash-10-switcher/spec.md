# TASK-10: Board Switcher Component

## Summary
Create a tab-based board switcher that fetches available boards from the API and allows switching between them.

## Task Type
implement_feature

## Dependencies
- TASK-06 (boards API), TASK-08 (kanban board)

## Requirements

### R1: BoardSwitcher component
- File: `src/ui/admin/CodyBoard/BoardSwitcher.tsx`
- Client component
- Fetches boards from `/api/cody/boards`
- Renders horizontal tab bar with board names
- "All" board is always first and selected by default
- Click a tab → calls `onBoardChange(boardId)` callback
- Active tab has highlighted style (underline or filled background)

### R2: Wire to CodyDashboard
- Update `src/ui/admin/CodyDashboard/index.tsx`
- Add `selectedBoard` state (default: 'all')
- Pass selectedBoard to tasks API: `/api/cody/tasks?board=${selectedBoard}`
- Re-fetch tasks when board changes

## Files to Create/Modify
- `src/ui/admin/CodyBoard/BoardSwitcher.tsx` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED)

## Acceptance Criteria
- [ ] Board tabs appear above the kanban board
- [ ] "All" tab is selected by default
- [ ] Switching tabs re-fetches and filters tasks
- [ ] `pnpm tsc --noEmit` passes
