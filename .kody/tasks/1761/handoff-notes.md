# LessonExerciseEditor — Implementation Notes

## What was built

New `LessonExerciseEditor` admin component at `src/ui/admin/LessonExerciseEditor/`.

**Files created:**
- `LessonExerciseEditor.tsx` — main component (~700 lines)
- `index.css` — styles (~400 lines)

**Files modified:**
- `src/server/payload/collections/Lessons.ts` — added `lessonExerciseEditor` UI field pointing to the new component

## How it works

1. Reads `blocks` field from lesson (textarea containing JSON array of block objects)
2. Filters blocks where `blockType === 'exerciseRef'`, extracts exercise IDs
3. Fetches each exercise via `GET /api/exercises/[id]?depth=0` concurrently
4. Displays each exercise as an expandable card with a numbered circle, title, block count, and Save button
5. Each card shows its `content.blocks` as editable blocks:
   - **Rich text blocks** → inline rich text editor (reuses `InlineRichTextEditor`)
   - **HTML blocks** → textarea
   - **Media blocks** → text input for media ID
   - **LaTeX blocks** → textarea with preview
   - **All other block types** → JSON editor with edit/apply/cancel UI
6. Per-exercise Save button PATCHes `content.blocks` via `PUT /api/exercises/[id]`
7. Block management: add (via `BlockTypeSelector`), move up/down, duplicate, delete (with guard against last-block deletion)

## Key patterns reused

- `LessonBlocksField` — block parsing from textarea, `extractId`, `extractTitle`, `parseBlocks`
- `ExerciseContentEditor` — `ExerciseBlockDefaults` factory, `BlockTypeSelector`, `deepCloneBlock`, `InlineRichTextEditor`
- Payload field component registration via `importMap.js` (run `pnpm generate:importmap` after adding new admin components)

## API assumption

The save uses `PATCH /api/exercises/[id]` with body `{ content: { blocks: ... } }`. This was assumed based on standard Payload REST API conventions. If the endpoint requires a different format, the `handleSaveExercise` function in `LessonExerciseEditor.tsx` is the place to fix.
