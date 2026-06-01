# Issue #2296 — Move up/down reorder controls unverifiable with single block

## What was fixed

LessonBlocksField (`src/ui/admin/LessonBlocksField/index.tsx`) had an empty-state panel
(`rows.length === 0`) that contained the "Add Exercise" and "Add Content Page" buttons.
When the lesson had exactly 1 block, the add buttons were hidden — QA could not add a
2nd block to test the reorder controls.

**Root cause:** The condition `rows.length === 0` hid the add buttons for any non-empty list.

**Fix:** Changed the condition to `rows.length < 2` (line 324), and added a conditional
" No blocks yet." label that only renders when `rows.length === 0` (line 333).
Now the add buttons appear for both empty lists AND single-block lists.

## Files changed

- `src/ui/admin/LessonBlocksField/index.tsx` — line 324: `rows.length === 0` → `rows.length < 2`
- `tests/e2e/lesson-blocks-field.e2e.spec.ts` — added new `test.describe` block with a
  regression test that creates a 1-block lesson and asserts the Add buttons are visible

## Verification

- `pnpm typecheck` ✅ passed
- `pnpm lint` ✅ passed (only pre-existing warning in LatexDocumentViewer)

E2E test could not be run in this session (MongoDB + dev server not available in this
environment). The test is written and will run in CI.

## Known follow-up

The Add buttons navigate away from the lesson to create new exercises/pages. After
creating one, the user still has no inline way to add it to the current lesson's blocks.
This is a separate UX gap to address in a follow-up issue.
