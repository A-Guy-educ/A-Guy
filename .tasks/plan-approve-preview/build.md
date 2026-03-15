# Build Agent Report: Approve Preview UI + Approve PR

## Changes

### API Route
- **src/app/api/cody/tasks/[taskId]/actions/route.ts**
  - Added `approve-ui` action: adds `ui-approved` label to issue, posts approval comment
  - Added `approve-pr` action: submits GitHub PR review approval via Octokit (without merging)
  - Updated Zod schema to include new action types

### Client API
- **src/ui/cody/api.ts**
  - Added `tasksApi.approveUI(issueNumber, actorLogin)` method
  - Added `tasksApi.approvePR(issueNumber, actorLogin)` method

### Hooks
- **src/ui/cody/hooks/index.ts**
  - Added `approveUI` and `approvePR` mutations to `useTaskActions` hook
  - Updated `isPending` check and `pendingAction` to include new mutations

### UI Components
- **src/ui/cody/components/PreviewActions.tsx**
  - Added "Approve UI" button (green) - stamps visual approval
  - Added "Approve PR" button (purple) - approves PR review
  - Added "Split View" button (blue) - opens preview in new window
  - Shows "UI Approved" badge when already approved
  - Reorganized action bar: Approve UI | Approve PR | Split View | Merge | Fix | Cancel PR

- **src/ui/cody/components/TaskDetail.tsx**
  - Added Approve UI and Approve PR buttons to desktop header (when task has PR)
  - Added Approve UI and Approve PR buttons to mobile toolbar

## Tests Written

- No new test files needed - existing tests pass
- Manual testing required in Cody dashboard

## Deviations

- **Skip: Reverse proxy for iframe preview** — User opted for "Split View" (popup window) instead
- **Skip: Separate approval tracking in status.json** — UI approval tracked via `ui-approved` label on GitHub issue (already parsed from labels array)

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: PASS (3516 tests)
