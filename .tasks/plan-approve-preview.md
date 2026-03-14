# Cody Dashboard: Approve Preview UI + Approve Preview PR

## Feature Overview

Three additions to the Cody Dashboard:

1. **Approve Preview UI** — Button to stamp visual approval of the preview deployment
2. **Approve Preview PR** — Button to approve the GitHub PR review (without merging)
3. **Split View Preview** — Option to open preview side-by-side with dashboard

## Current State

- **PreviewModal** shows preview URL as a link, opens in new tab
- **PreviewActions** bar has: Merge | Fix | Cancel PR
- **TaskDetail** has Merge button when in review column
- No way to mark UI as approved separately from merging

## Implementation Plan

### Step 1: Add API Actions for Approvals

**Files:**
- `src/app/api/cody/tasks/[taskId]/actions/route.ts`

**Changes:**
- Add `approve-ui` action: adds `ui-approved` label, posts approval comment
- Add `approve-pr` action: submits GitHub PR approval (no merge)

### Step 2: Add Client API Methods

**Files:**
- `src/ui/cody/api.ts`

**Changes:**
- Add `tasksApi.approveUI(issueNumber, actorLogin)`
- Add `tasksApi.approvePR(issueNumber, actorLogin)`

### Step 3: Add Hook Mutations

**Files:**
- `src/ui/cody/hooks/index.ts`

**Changes:**
- Add `approveUI` and `approvePR` mutations to `useTaskActions`

### Step 4: Update PreviewActions Component

**Files:**
- `src/ui/cody/components/PreviewActions.tsx`

**Changes:**
- Add "Approve UI" button (green, left side)
- Add "Approve PR" button (purple)
- Keep existing Merge, Fix, Cancel PR buttons

### Step 5: Update PreviewModal for Split View

**Files:**
- `src/ui/cody/components/PreviewModal.tsx`

**Changes:**
- Add "Open Split View" button that:
  1. Opens preview URL in new window
  2. Shows guidance to resize browser to left half

### Step 6: Update TaskDetail Component

**Files:**
- `src/ui/cody/components/TaskDetail.tsx`

**Changes:**
- Add "Approve UI" to contextual actions when task has PR
- Add "Approve PR" to contextual actions when task has PR

### Step 7: Update Task Parser (if needed)

**Files:**
- `src/app/api/cody/tasks/route.ts`

**Changes:**
- Parse `ui-approved` label into task data

## UI Layout

### PreviewActions Bar (new)
```
[Approve UI] [Approve PR] [Merge] [Fix]              [Cancel PR]
   green        purple       -      -                     red
```

### TaskDetail Contextual Actions
- When in 'review' column with PR: Approve UI, Approve PR, Merge buttons side by side

## Acceptance Criteria

1. ✓ "Approve UI" button adds `ui-approved` label and posts comment
2. ✓ "Approve PR" button submits GitHub PR approval without merging
3. ✓ Both buttons appear in PreviewActions and TaskDetail
4. ✓ Split view opens preview in new window with guidance
5. ✓ Labels are parsed and reflected in dashboard UI
6. ✓ TypeScript compiles without errors
7. ✓ Linting passes
