# Cody Dashboard Improvements Plan

**Task ID**: cody-dashboard-improvements  
**Created**: 2026-03-01  
**Status**: Planned  
**Scope**: 11 improvements to the Cody Operations Dashboard

---

## Summary

A batch of UX, functionality, and infrastructure improvements to the Cody dashboard (`src/ui/cody/`). Covers comment rendering, task detail layout, filter UX, button state management, issue naming, PR management, and bot identity.

---

## Step 1: Comment autolinks — bare URLs rendered as plain text

**Root Cause**: `CommentList.tsx` uses `ReactMarkdown` without the `remark-gfm` plugin. GitHub Flavored Markdown autolinks (bare URLs like `https://...`) are not converted to clickable `<a>` tags.

**Files to Touch**:
- `src/ui/cody/components/CommentList.tsx` (MODIFIED — line 174)
- `package.json` (MODIFIED — add `remark-gfm` if missing)

**Behavior**:
- Before: `https://github.com/foo/bar` appears as plain text in comments
- After: automatically rendered as a clickable link opening in new tab

**Tests**:
1. **Integration test** (`tests/unit/cody/comment-list.test.tsx`): Render `CommentList` with a comment containing a bare URL → assert an `<a>` element with `href` matching the URL exists
2. **Visual check**: Open dashboard, find a comment with a bare URL → verify it's clickable

**Acceptance Criteria**:
- [ ] `remark-gfm` is imported and passed to `ReactMarkdown` as `remarkPlugins={[remarkGfm]}`
- [ ] Bare URLs in comments render as clickable links
- [ ] Existing markdown links still work (no regression)

---

## Step 2: Refresh button in task detail view

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — header section ~line 103-111)

**Behavior**:
- Add a `RefreshCw` icon button in the TaskDetail header bar (next to the ✕ close button)
- On click, calls `refetch()` (already available from `useTaskDetails` at line 56)
- Shows spinning animation while fetching (`isDetailsLoading` or `isFetching`)

**Tests**:
1. **Unit test** (`tests/unit/cody/task-detail.test.tsx`): Render TaskDetail with a mock task → click refresh button → assert `refetch` was called

**Acceptance Criteria**:
- [ ] RefreshCw button visible in task detail header
- [ ] Clicking it re-fetches task details and comments
- [ ] Button spins while loading

---

## Step 3: Fix issue naming — replace `auto-XX` with real issue number

**Root Cause**: `src/app/api/cody/tasks/route.ts:283-288` generates prefix `[YYMMDD-auto-XX]` before the issue is created, so the actual issue number isn't known yet.

**Files to Touch**:
- `src/app/api/cody/tasks/route.ts` (MODIFIED — POST handler, lines 282-300)

**Behavior**:
1. Create the issue with the `auto-XX` placeholder title (as now)
2. After creation, get the returned `issue.number`
3. Replace `auto-XX` in the title with the real issue number (e.g., `auto-635`)
4. Call `updateIssue(issueNumber, { title: correctedTitle })` to fix the title

**Tests**:
1. **Integration test** (`tests/int/cody/task-creation.test.ts`): POST to `/api/cody/tasks` with a title → verify the created issue title contains the real issue number instead of `XX`

**Acceptance Criteria**:
- [ ] New tasks have titles like `[260301-auto-642] My feature` (real number, not XX)
- [ ] Bug reports still skip the prefix (no change)
- [ ] Titles starting with `[` still skip the prefix (no change)

---

## Step 4: Show issue description in task detail

**Root Cause**: `task.body` is fetched from GitHub and available in `CodyTask` type but never rendered in the UI.

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — add description after title, ~line 106)

**Behavior**:
- Below the task title in TaskDetail, render `task.body` as markdown (using `ReactMarkdown`)
- Collapsible by default if longer than ~3 lines (use a "Show more" toggle)
- Styled with muted text, slightly smaller font than title

**Tests**:
1. **Unit test** (`tests/unit/cody/task-detail.test.tsx`): Render TaskDetail with `task.body = 'Some description'` → assert description text is visible in the DOM

**Acceptance Criteria**:
- [ ] Issue description visible in task detail below the title
- [ ] Long descriptions are collapsible
- [ ] Empty descriptions don't show an empty section
- [ ] Markdown in descriptions renders correctly

---

## Step 5: Filter sub-header with status filter

**Files to Touch**:
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — extract filters, add status filter)
- `src/ui/cody/components/FilterBar.tsx` (NEW)

**Behavior**:
- Create a `FilterBar` component rendered below the header/banner
- Move date filter and label filter from header into `FilterBar`
- Add a new **status filter** (Select dropdown) with options: All, Backlog, Building, In Review, Failed, Gate Waiting, Retrying, Done
- Status filter applies client-side: `tasks.filter(t => t.column === statusFilter)`
- Combine with existing label filter (AND logic)
- Header gets cleaner: only title, action buttons (New Task, Bug Report, Chat, Refresh)

**Tests**:
1. **Integration test** (`tests/unit/cody/filter-bar.test.tsx`): Render FilterBar → select "Failed" status → verify `onStatusChange` callback fires with `'failed'`
2. **Integration test** (`tests/unit/cody/dashboard-filters.test.tsx`): Render CodyDashboard with mock tasks of various columns → select "failed" filter → verify only failed tasks are shown

**Acceptance Criteria**:
- [ ] Filter bar visible below header as a distinct row
- [ ] Date, label, and status filters all present
- [ ] Status filter correctly filters tasks by column
- [ ] Filters combine with AND logic
- [ ] Counts shown per status option
- [ ] Mobile: filters accessible via mobile menu

---

## Step 6: Approve button hidden after approval + button state improvements

**Root Cause**: After clicking "Approve Gate", `taskActions.approveGate()` posts `/cody approve` as a comment. But `task.column` still equals `'gate-waiting'` until the pipeline processes the comment and changes labels, so the button remains visible.

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — action panel, lines 383-511)
- `src/ui/cody/hooks/index.ts` (MODIFIED — `useTaskActions` return completed actions)

**Behavior**:
- `useTaskActions` tracks which actions have been successfully performed (e.g., `completedActions: Set<string>`)
- After `approveGate()` succeeds, add `'approve'` to completed set
- In TaskDetail, hide Approve/Reject buttons when `completedActions.has('approve')` or `completedActions.has('reject')`
- Show a "Pending approval..." badge instead
- Reset completed actions when task changes or data refreshes with new column

**Tests**:
1. **Unit test** (`tests/unit/cody/task-actions.test.tsx`): Call `approveGate()` → verify Approve/Reject buttons disappear and "Pending approval" badge appears

**Acceptance Criteria**:
- [ ] Approve/Reject buttons hidden immediately after clicking Approve
- [ ] "Pending approval" or similar indicator shown instead
- [ ] Buttons reappear if task is still gate-waiting after refresh (action was retried)
- [ ] Same pattern for other context-sensitive buttons

---

## Step 7: Task detail as wide dialog

**Files to Touch**:
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — replace right panel with Dialog)
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — layout adjustments for wider space)
- `src/ui/cody/components/TaskDetailDialog.tsx` (NEW — Dialog wrapper)

**Behavior**:
- Clicking a task in TaskList opens a Dialog (shadcn `Dialog` component)
- Dialog takes ~85% viewport width, ~90% viewport height, centered
- Content: TaskDetail component, now with room for side-by-side layout (info/actions left, comments right)
- Desktop right panel removed; chat becomes a separate dialog or panel
- Mobile: keep existing Sheet behavior (no change)
- Close button (✕) in dialog header or Escape key

**Tests**:
1. **Integration test** (`tests/unit/cody/task-detail-dialog.test.tsx`): Click a task → verify Dialog opens with task title visible
2. **Integration test**: Press Escape → verify Dialog closes

**Acceptance Criteria**:
- [ ] Task detail opens as a wide centered dialog on desktop
- [ ] Dialog dismissible via ✕ button or Escape
- [ ] Mobile still uses Sheet overlay
- [ ] Chat panel still accessible (separate toggle)
- [ ] No horizontal scrolling inside dialog

---

## Step 8: Close PR button

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — add `closePR()`)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — add `'close-pr'` action)
- `src/ui/cody/hooks/index.ts` (MODIFIED — add `closePR` to `useTaskActions`)
- `src/ui/cody/api.ts` (MODIFIED — add `closePR` to `tasksApi`)
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — add Close PR button near PR link)

**Behavior**:
- New `closePR(prNumber)` function: `octokit.pulls.update({ state: 'closed' })`
- New `'close-pr'` action in actions API that calls `closePR`
- Button visible in TaskDetail quick links row when `task.associatedPR` exists
- Confirmation dialog before closing ("Close PR #{number}? This will NOT delete the branch.")
- After closing, refetch task data

**Tests**:
1. **Integration test** (`tests/int/cody/close-pr.test.ts`): POST `{ action: 'close-pr' }` → verify PR state changed to closed via mock

**Acceptance Criteria**:
- [ ] "Close PR" button visible when task has an associated PR
- [ ] Confirmation dialog shown before closing
- [ ] PR closed via GitHub API after confirmation
- [ ] Task data refreshed after closing

---

## Step 9: Merge approval dialog

**Files to Touch**:
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED — trigger dialog instead of inline confirm)
- `src/ui/cody/components/MergeApprovalDialog.tsx` (NEW)
- `src/ui/cody/hooks/usePRCIStatus.ts` (MODIFIED — optionally include file changes summary)

**Behavior**:
- First click on MergeButton opens `MergeApprovalDialog`
- Dialog shows:
  - PR title and number (linked to GitHub)
  - CI status badge (passed/failed/pending/running)
  - File changes summary: N files changed, +additions, -deletions
  - Branch info (source → target)
  - "Approve & Merge" button (disabled if CI not passed)
  - "Cancel" button
- "Approve & Merge" executes the existing merge flow (`tasksApi.approveReview`)

**Tests**:
1. **Unit test** (`tests/unit/cody/merge-approval-dialog.test.tsx`): Render dialog with mock PR data → verify PR title, CI status, file counts visible → click "Approve & Merge" → verify `onMerge` called
2. **Unit test**: Render with `ciStatus: 'failure'` → verify "Approve & Merge" button is disabled

**Acceptance Criteria**:
- [ ] Clicking merge opens a dialog (not inline confirm)
- [ ] Dialog shows PR title, CI status, file change summary
- [ ] Merge button disabled when CI hasn't passed
- [ ] Successful merge closes dialog and refreshes data

---

## Step 10: Reset Task button (full reset + re-run)

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — add `closePR()` if not done in Step 8, add `deleteBranch()` helper)
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — add `'reset'` action)
- `src/ui/cody/hooks/index.ts` (MODIFIED — add `reset` to `useTaskActions`)
- `src/ui/cody/api.ts` (MODIFIED — add `reset` to `tasksApi`)
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — add Reset button with confirmation dialog)

**Behavior** (API side — `'reset'` action):
1. Find associated branch via `findTaskBranch()` or `findBranchByIssueNumber()`
2. Find associated PR via `findAssociatedPR()`
3. If PR exists → close PR (`octokit.pulls.update({ state: 'closed' })`)
4. If branch exists and not `dev`/`main` → delete branch (`octokit.git.deleteRef()`)
5. Remove agent labels: `agent:done`, `agent:error`, `agent:running`, `hard-stop`, `risk-gated`
6. Post `/cody` comment to re-trigger pipeline from scratch

**Behavior** (UI side):
- "Reset" button (with `RotateCcw` icon) visible in TaskDetail action panel for open tasks
- Shows a confirmation dialog: "This will delete the branch, close the PR, and re-run the pipeline from scratch. Continue?"
- After confirmation, calls `taskActions.reset()`
- Toast notification on success/failure

**Tests**:
1. **Integration test** (`tests/int/cody/reset-task.test.ts`): POST `{ action: 'reset' }` for a task with branch + PR → verify branch deleted, PR closed, labels removed, `/cody` comment posted
2. **Unit test**: Render TaskDetail with open task → click Reset → confirm dialog → verify API called

**Acceptance Criteria**:
- [ ] Reset button visible for tasks that have been run
- [ ] Confirmation dialog prevents accidental resets
- [ ] Branch deleted (except dev/main)
- [ ] PR closed if exists
- [ ] Agent labels removed
- [ ] `/cody` posted to re-trigger pipeline
- [ ] Toast feedback on success/failure

---

## Step 11: Fix `/cody` comment attribution (bot token)

**Root Cause**: `github-client.ts:78` uses `process.env.GITHUB_TOKEN` which is your personal PAT. All API actions (comments, issue creation, PR reviews) are attributed to your GitHub account.

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — `getOctokit()` prefers `CODY_BOT_TOKEN`)
- `scripts/cody/checkout-task-branch.ts` (MODIFIED — use env vars for git identity)
- `.github/workflows/cody.yml` (MODIFIED — parameterize git config lines 302-303)
- `.env.example` (MODIFIED — document `CODY_BOT_TOKEN`, `GIT_USER_NAME`, `GIT_USER_EMAIL`)

**Behavior**:
- `getOctokit()` checks `CODY_BOT_TOKEN` first, falls back to `GITHUB_TOKEN`
- When `CODY_BOT_TOKEN` is set (pointing to a bot/machine account), all dashboard actions (comments, PR reviews, issue creation) appear from the bot account
- Git identity in CI uses `GIT_USER_NAME` / `GIT_USER_EMAIL` env vars with current values as defaults
- **Note**: This requires creating a GitHub bot account or GitHub App and generating a PAT for it. That's an external setup step.

**Tests**:
1. **Unit test** (`tests/unit/cody/github-client.test.ts`): Mock env with `CODY_BOT_TOKEN` → verify Octokit created with bot token. Mock env without → verify falls back to `GITHUB_TOKEN`.

**Acceptance Criteria**:
- [ ] `getOctokit()` prefers `CODY_BOT_TOKEN` over `GITHUB_TOKEN`
- [ ] Fallback to `GITHUB_TOKEN` when bot token not set
- [ ] Git identity in CI configurable via env vars
- [ ] `.env.example` documents new variables

---

## Implementation Priority

| Priority | Step | Description | Effort | Impact |
|----------|------|-------------|--------|--------|
| 1 | Step 1 | Comment autolinks | ~15min | High |
| 2 | Step 2 | Refresh button | ~15min | Medium |
| 3 | Step 3 | Fix issue naming | ~20min | Medium |
| 4 | Step 4 | Issue description | ~25min | High |
| 5 | Step 5 | Filter sub-header + status | ~45min | High |
| 6 | Step 6 | Approve button state | ~30min | Medium |
| 7 | Step 7 | Wide dialog | ~45min | High |
| 8 | Step 8 | Close PR button | ~30min | Medium |
| 9 | Step 9 | Merge approval dialog | ~40min | Medium |
| 10 | Step 10 | Reset task button | ~45min | High |
| 11 | Step 11 | Bot token attribution | ~30min | Medium |

**Total estimated effort**: ~5-6 hours

---

## Assumptions

1. `remark-gfm` package is available or can be installed
2. shadcn `Dialog` component is already available in the project
3. A GitHub bot account / GitHub App can be created for Step 11 (external setup)
4. All changes are to the Cody dashboard UI layer — no pipeline (`scripts/cody/`) changes except Step 11 git identity
5. Tests use Vitest + React Testing Library (project standard)
