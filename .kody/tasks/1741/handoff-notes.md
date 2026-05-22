# Issue #1741: Floating Ask Button Implementation

## What was done

Created a new `FloatingAskButton` component with bottom sheet for asking questions on mobile lesson pages.

### Files changed

1. **New: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx`**
   - Floating action button fixed to bottom-left (or center when `isCentered=true`)
   - Opens a Radix UI bottom sheet with text input + image attachment
   - Dispatches `ask-from-floating-button` custom event on submit
   - Mobile-only (`md:hidden`)

2. **Modified: `ExercisesPager/index.tsx`**
   - Added import for FloatingAskButton
   - Renders button outside main scrollable area for intro/outro states
   - Passes `isCentered={isAt85Percent}` to center button when navigation arrows appear
   - Passes `courseId` and `lessonId` to ExerciseWorkspace

3. **Modified: `ExerciseWorkspace/index.tsx`**
   - Added `courseId` and `lessonId` props
   - Renders FloatingAskButton (always at bottom-left, not centered)

4. **New: `tests/unit/components/FloatingAskButton.test.tsx`**
   - 11 tests covering button positioning, accessibility, sheet content

## Key design decisions

- Uses existing `Sheet` component from `@/ui/web/components/sheet` (Radix UI)
- Button uses `MessageSquare` icon from lucide-react
- Safe-area insets handled via `pb-[max(1rem,env(safe-area-inset-bottom))]`
- Button hidden on desktop (`md:hidden`)

## Follow-ups needed

1. **High priority**: Wire `ask-from-floating-button` event to ChatInterface so submitted questions appear in chat
2. **Medium priority**: E2E test the button in fullscreen mode (persistence + centering)
