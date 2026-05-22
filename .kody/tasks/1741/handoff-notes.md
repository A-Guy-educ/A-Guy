# Issue #1741: Floating Ask Button Fix

## What was done (bug fix session)

Fixed duplicate floating button bug identified in PR #1771 comments.

### Root cause
- `FloatingAskButton` had its own bottom sheet with text input + image — a duplicate of existing `ChatInterface`
- `ExerciseWorkspace` also rendered `FloatingAskButton` with its own sheet, creating a second floating button on the right side
- `FloatingAskButton` dispatched `ask-from-floating-button` but `ChatInterface` never listened for it

### Changes made

1. **`FloatingAskButton`** — stripped to bare button, dispatches `focus-chat-input` event on click (no more sheet/text-input)
2. **`ChatInterface`** — added `useEffect` listener for `focus-chat-input` event that focuses the textarea
3. **`ExerciseWorkspace`** — removed `FloatingAskButton` entirely (no longer needed since chat is always visible in this component)
4. **`ExercisesPager`** — removed unused `courseId`/`lessonId` props from `FloatingAskButton` call; button still renders at bottom for intro/outro pages

### Files changed

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx`
- `src/ui/web/chat/ChatInterface/index.tsx`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`
- `tests/unit/components/FloatingAskButton.test.tsx`

### Acceptance criteria (all met)

- One floating button (bottom-left) after fix ✅
- Button opens/focuses the existing chat input (text + image + math) ✅
- Right-side duplicate button and duplicate sheet are gone ✅

### Follow-ups needed

- **Medium priority**: E2E test the button in fullscreen mode (persistence + centering)
