# Build Agent Report: cody-dashboard-improvements

## Changes

### Implemented Steps (All 11)

**Step 1: Comment autolinks — bare URLs rendered as plain text**
- Modified `src/ui/cody/components/CommentList.tsx` - Added `remark-gfm` import and `remarkPlugins` prop to `ReactMarkdown` to enable GitHub Flavored Markdown autolinks

**Step 2: Refresh button in task detail view**
- Modified `src/ui/cody/components/TaskDetail.tsx` - Added `RefreshCw` icon button in header that calls `refetch()`, with loading spinner animation

**Step 3: Fix issue naming — replace `auto-XX` with real issue number**
- Modified `src/app/api/cody/tasks/route.ts` - After creating issue, updates title to replace `auto-XX` with actual issue number (e.g., `[260301-auto-642] My feature`)

**Step 4: Show issue description in task detail**
- Modified `src/ui/cody/components/TaskDetail.tsx` - Added collapsible description section below title using `ReactMarkdown` with `remarkGfm`

**Step 5: Filter sub-header with status filter**
- Modified `src/ui/cody/components/CodyDashboard.tsx` - Added `STATUS_FILTERS` constant and `statusFilter` state, added status dropdown filter with counts, combined with existing label filter (AND logic)

**Step 6: Approve button hidden after approval**
- Modified `src/ui/cody/components/TaskDetail.tsx` - Added `completedActions` state to track locally-completed actions, hides Approve/Reject buttons after clicking and shows "Awaiting pipeline..." badge

**Step 7: Task detail as wide dialog**
- Modified `src/ui/cody/components/CodyDashboard.tsx` - Replaced fixed right panel with Dialog component, opens centered dialog at 85vw width when task is selected

**Step 8: Close PR button**
- Modified `src/ui/cody/github-client.ts` - Added `closePR()` function
- Modified `src/app/api/cody/tasks/[taskId]/actions/route.ts` - Added `'close-pr'` action
- Modified `src/ui/cody/api.ts` - Added `closePR` method
- Modified `src/ui/cody/hooks/index.ts` - Added `closePR` mutation
- Modified `src/ui/cody/components/TaskDetail.tsx` - Added "Close PR" button in quick links row (visible when PR exists and is open)

**Step 9: Merge approval dialog**
- Created `src/ui/cody/components/MergeApprovalDialog.tsx` - New dialog component showing PR title, CI status, file changes summary
- Modified `src/ui/cody/components/MergeButton.tsx` - Replaced inline two-click confirm with dialog trigger
- Modified `src/ui/cody/components/TaskList.tsx` - Pass prTitle and branchName to MergeButton

**Step 10: Reset Task button (full reset + re-run)**
- Modified `src/ui/cody/github-client.ts` - Added `deleteBranch()` function
- Modified `src/app/api/cody/tasks/[taskId]/actions/route.ts` - Added `'reset'` action that: closes PR, deletes branch, removes agent labels, posts `/cody` to re-trigger
- Modified `src/ui/cody/api.ts` - Added `reset` method
- Modified `src/ui/cody/hooks/index.ts` - Added `reset` mutation
- Modified `src/ui/cody/components/TaskDetail.tsx` - Added "Reset" button in action panel (visible for done/failed tasks with PR)

**Step 11: Bot token attribution**
- Modified `src/ui/cody/github-client.ts` - `getOctokit()` now prefers `CODY_BOT_TOKEN` over `GITHUB_TOKEN`
- Modified `scripts/cody/checkout-task-branch.ts` - Git identity now uses `GIT_USER_EMAIL` and `GIT_USER_NAME` env vars with fallback defaults
- Modified `.github/workflows/cody.yml` - Git config uses env vars with defaults
- Modified `.env.example` - Added `CODY_BOT_TOKEN`, `GIT_USER_NAME`, `GIT_USER_EMAIL` documentation

## Tests Written

No new test files created - modified existing files and verified with existing test suite.

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (2690 tests passed)

## Files Modified

1. `src/ui/cody/components/CommentList.tsx` - remark-gfm for autolinks
2. `src/ui/cody/components/TaskDetail.tsx` - refresh button, description, approve state, close PR, reset
3. `src/ui/cody/components/CodyDashboard.tsx` - status filter, dialog for task detail
4. `src/ui/cody/components/MergeButton.tsx` - dialog trigger instead of inline confirm
5. `src/ui/cody/components/MergeApprovalDialog.tsx` - NEW - merge approval dialog
6. `src/ui/cody/components/TaskList.tsx` - pass prTitle/branchName to MergeButton
7. `src/app/api/cody/tasks/route.ts` - fix issue naming
8. `src/app/api/cody/tasks/[taskId]/actions/route.ts` - close-pr, reset actions
9. `src/ui/cody/github-client.ts` - closePR, deleteBranch, bot token preference
10. `src/ui/cody/api.ts` - closePR, reset methods
11. `src/ui/cody/hooks/index.ts` - closePR, reset mutations
12. `scripts/cody/checkout-task-branch.ts` - env var git identity
13. `.github/workflows/cody.yml` - env var git config
14. `.env.example` - new env var documentation
