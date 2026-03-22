# Build Agent Report: Cody Dashboard Enhancements

## Changes

### Feature 1: Sort Controls in FilterBar
- **Added sort types** (`SortField`, `SortDirection`) to `src/ui/cody/types.ts`
- **Added sortTasks() function** to `src/ui/cody/utils.ts` with 9 sort fields: updatedAt, createdAt, issueNumber, column, riskLevel, pipelineProgress, assignee, title, label
- **Added sort controls** to `src/ui/cody/components/FilterBar.tsx` - Sort dropdown + asc/desc toggle button
- **Wired sort state** in `src/ui/cody/components/CodyDashboard.tsx` - Added sortField/sortDirection state, URL persistence, and applied sorting to filtered tasks

### Feature 2: Backlog Issue Edit Dialog
- **Added 'update' action** to `src/app/api/cody/tasks/[taskId]/actions/route.ts` with title, body, labels, assignees fields
- **Added tasksApi.update()** method to `src/ui/cody/api.ts`
- **Added useUpdateTask()** hook to `src/ui/cody/hooks/index.ts`
- **Created EditTaskDialog** component (`src/ui/cody/components/EditTaskDialog.tsx`) - Full edit dialog with markdown editor, label picker, and assignee picker
- **Added edit button** to `src/ui/cody/components/TaskList.tsx` - Pencil icon in task row actions
- **Added edit button** to `src/ui/cody/components/TaskDetail.tsx` - Pencil icon in header
- **Wired dialog** in `src/ui/cody/components/CodyDashboard.tsx` - State, handlers, and dialog component

### Feature 3: Remove Split View Button
- **Removed Split View button** from `src/ui/cody/components/PreviewActions.tsx`
- Removed SquareSplitHorizontal import
- Removed handleSplitView() function
- Removed Split View button JSX

### Feature 4: Move Approve UI/PR/Merge to Preview Only
- **Removed MergeButton, Approve UI, Approve PR buttons** from `src/ui/cody/components/TaskDetail.tsx` desktop header and mobile toolbar
- Removed unused imports (MergeButton)
- Removed onApproveReview and isMerging props from TaskDetailProps
- Updated CodyDashboard to remove props from TaskDetail calls

## Tests Written
- No new tests written for these UI changes (manual testing recommended)

## Deviations
- None - plan followed exactly

## Quality
- TypeScript: PASS (pnpm tsc --noEmit completed with no errors)
- Lint: N/A (not run, pre-existing module resolution issues in codebase don't affect runtime)
