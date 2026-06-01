# Fix Summary

**Issue:** Lesson Blocks empty state had only static text with no button to add blocks. Users had to manually navigate to Exercises or Content Pages collections.

**Root Cause:** The empty state in `LessonBlocksField/index.tsx` only displayed text "No blocks yet. Create exercises or content pages for this lesson." with no interactive elements.

**Changes Made:**

1. Added `Plus` icon import from lucide-react
2. Added `lessonId` state to parse the lesson ID from the URL pathname via `useEffect`
3. Replaced the static empty state text with two dashed-border buttons:
   - "Add Exercise" button → navigates to `/admin/collections/exercises/new?lesson=<lessonId>`
   - "Add Content Page" button → navigates to `/admin/collections/content-pages/new?lesson=<lessonId>`
4. Buttons styled with hover effects matching the design system's dashed border style (similar to `add-block-button` in ExerciseContentEditor)

**Files Modified:**
- `src/ui/admin/LessonBlocksField/index.tsx`

**Verification:**
- TypeScript compilation: PASSED
- Lint: PASSED
- Integration tests (lesson-blocks-delete-persistence): PASSED (2 tests)
- Quality gates (verify tool): PASSED

**No Follow-ups Required** - This is a minimal, well-scoped fix that addresses the exact issue.
