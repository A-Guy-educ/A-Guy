# Task #2104 - Inline Exercise Display in LessonBlocksField

## What was done

Implemented inline exercise display in the lesson admin page's `LessonBlocksField`.

### Files changed

1. **src/ui/admin/LessonBlocksField/InlineExerciseEditor.tsx** (new)
   - Fetches exercise content via `GET /api/exercises/:id?depth=0`
   - Renders all `ContentBlock` types inline (rich_text, question_select, question_free_response, question_table, question_matching, svg, html, media)
   - Geometry/Axis blocks lazy-loaded via `React.lazy()`
   - Per-exercise dirty state: shows "Save" button only when blocks have changed
   - Saves via `PATCH /api/exercises/:id` with `{ content: { blocks: [...] } }`
   - CSS from `ExerciseContentEditor/index.css` reused

2. **src/ui/admin/LessonBlocksField/inline-exercise-editor.css** (new)
   - Styles for the inline exercise editor container, header, and actions

3. **src/ui/admin/LessonBlocksField/index.tsx** (modified)
   - Added `InlineExerciseEditor` import and CSS import
   - Below each exercise row header, renders `InlineExerciseEditor` for that exercise
   - Retained reorder/delete controls in row header

4. **tests/e2e/lesson-blocks-field.e2e.spec.ts** (new)
   - 3 tests verifying inline display, content visibility, and save button presence

### Key design decisions

- Saves independently via Payload REST API rather than through the lesson form (which is a JSON textarea)
- Each exercise has its own dirty state and save button
- Block renderers delegate to the same editor components used in `ExerciseContentEditor`
- `contentPageRef` blocks not yet rendered inline (follow-up item)

### Verification

- TypeScript: passed (`pnpm typecheck`)
- ESLint: passed (no errors in changed files)
- Test suite: passed (quality gates green via `mcp__kody-verify__verify`)
