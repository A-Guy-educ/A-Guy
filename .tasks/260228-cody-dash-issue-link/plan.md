# Plan: Add Prominent GitHub Issue Link to Cody Dashboard

**Task ID**: 260228-cody-dash-issue-link
**Task Type**: enhancement
**Estimated Time**: 15 minutes (1 step)

## Problem Analysis

The Cody dashboard at `/cody` has two views that display task information:
1. **TaskList** (`src/ui/cody/components/TaskList.tsx`) — list items in the left panel
2. **TaskDetail** (`src/ui/cody/components/TaskDetail.tsx`) — detail panel on the right

Both views currently show only `#{issueNumber}` as a small muted monospace link that's easy to miss. The issue link blends in with metadata and doesn't look like a prominent clickable link to GitHub.

**Key finding**: The TaskDetail "Quick links" row (lines 197-233) has styled pill-links for PR, Preview, and Workflow — but does NOT include a GitHub Issue link. This is the main gap.

In the TaskList, the `#{issueNumber}` text is styled as `text-zinc-500` which is very subdued and easily overlooked. It needs a GitHub icon to make it visually recognizable as an external link.

## Assumptions

- The `getGitHubIssueUrl()` helper in `src/ui/cody/constants.ts` already constructs the correct URL
- No API or data model changes needed — `task.issueNumber` is always available
- The existing `lucide-react` icon library has a suitable icon (`Github` or `ExternalLink`)
- We should match the visual style of existing quick-links (PR, Preview, Workflow) in TaskDetail

---

### Step 1: Add Prominent GitHub Issue Links in TaskList and TaskDetail

**Files to Touch**:
- `src/ui/cody/components/TaskList.tsx` (MODIFIED — lines 168-177)
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — lines 197-233)

**Exact Behavior**:

#### TaskList.tsx Changes (list item row):
- On the existing `#{task.issueNumber}` link (lines 168-177), add a small GitHub icon (`ExternalLink` or `Github` from lucide-react) before the text to make it visually recognizable as a link
- Change the styling to be slightly more prominent: use `text-zinc-400` (lighter) and add an icon `w-3 h-3` inline
- Keep the existing `onClick={(e) => e.stopPropagation()}` to prevent row selection when clicking

#### TaskDetail.tsx Changes (quick links row):
- Add a GitHub Issue pill-link to the "Quick links" row (after line 197), matching the exact visual style of the PR/Preview/Workflow links
- The link should appear FIRST in the quick links row (before PR, Preview, Workflow) since it's the source issue
- Style: `bg-zinc-700 text-zinc-300 hover:bg-zinc-600` (similar to Workflow link style, or use a blue tint for GitHub)
- Icon: Use the `ExternalLink` icon (already imported) or import `Github` from lucide-react
- Text: `Issue #{task.issueNumber}`
- This link should ALWAYS render (unlike PR/Preview which are conditional) since every task has an issue number
- The existing muted `#{task.issueNumber}` in the info row (lines 140-148) can remain as-is for secondary reference

**Implementation Details**:

For **TaskList.tsx**, update lines 168-177:
```
// Before: plain #{issueNumber}
// After: icon + #{issueNumber} with slightly better visibility
```
Add `ExternalLink` icon (already imported at line 16) with `w-3 h-3` before the `#` text.

For **TaskDetail.tsx**, add before line 198 (before the PR link):
```
// Always-visible GitHub Issue pill link
// Styled like the Workflow link: bg-zinc-700 text-zinc-300
// With ExternalLink or Github icon
// Text: "Issue #{task.issueNumber}"
```

**Tests (1 test file, 2 test cases)**:

- **Test location**: `tests/unit/ui/cody/task-issue-link.test.tsx`
- **Test 1 — TaskList shows GitHub issue link with icon**:
  - Render `<TaskList>` with a mock task (issueNumber: 42)
  - Assert that a link with `href` containing `/issues/42` exists
  - Assert the link contains both the icon element and `#42` text
  - Assert the link has `target="_blank"` and `rel="noopener noreferrer"`
  - **FAILS before**: Icon element not present in the issue number link (currently just plain text)
  - **PASSES after**: Icon + text renders correctly

- **Test 2 — TaskDetail shows GitHub Issue in quick links row**:
  - Render `<TaskDetail>` with a mock task (issueNumber: 42, no PR, no preview)
  - Assert that a link with text matching `Issue #42` exists
  - Assert the link `href` is `https://github.com/A-Guy-educ/A-Guy/issues/42`
  - Assert the link has `target="_blank"` and `rel="noopener noreferrer"`
  - Assert the link is styled as a pill (has the expected classes)
  - **FAILS before**: No "Issue #42" pill link exists in quick links row
  - **PASSES after**: Pill link renders with correct href, text, and styling

**Acceptance Criteria**:
- [ ] TaskList: Each list item's `#{issueNumber}` link has a small icon making it recognizable as a GitHub link
- [ ] TaskDetail: A styled pill-link "Issue #{issueNumber}" appears in the Quick links row, always visible
- [ ] TaskDetail pill-link opens the correct GitHub issue URL in a new tab
- [ ] TaskList issue link still prevents row selection on click (stopPropagation)
- [ ] Visual style of new TaskDetail pill matches existing PR/Preview/Workflow link pills
- [ ] Both tests pass
- [ ] `pnpm tsc --noEmit` passes with no new errors
