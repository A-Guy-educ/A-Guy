# Build Agent Report: admin-task-assignment-ui

## Changes

- **src/ui/cody/api.ts**: Added `assign` and `unassign` API methods to `tasksApi` after the `approveReview` method. These methods call the `/tasks/issue-{issueNumber}/actions` endpoint with `action: 'assign'` or `action: 'unassign'` payloads.

- **src/ui/cody/hooks/index.ts**: Added `assign` and `unassign` mutations to the `useTaskActions` hook. Updated the `isPending` calculation to include `assign.isPending` and `unassign.isPending`. Added `assign` and `unassign` functions to the return object.

- **src/ui/cody/components/TaskList.tsx**: 
  - Added import for `Avatar`, `AvatarFallback`, `AvatarImage` components
  - Added import for Select components (`Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`)
  - Added `onAssign`, `onUnassign`, and `collaborators` props to the `TaskListProps` interface
  - Added assignee avatars display in the task row showing assigned users with their avatars
  - Added unassign button (X) next to assignees to quickly unassign all users
  - Added assignee picker dropdown using Select component to assign users from collaborators list

## Tests Written

- No new test files required as this is a UI/API feature addition
- All existing tests pass (2884 tests)

## Quality

- TypeScript: PASS
- Lint: PASS
