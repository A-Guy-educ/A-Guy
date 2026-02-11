# Exercise Question Block Editors (Payload Admin)

## Context

The `exercises` collection stores its authoring surface as `content` (JSON) with a strict block stream (`content.blocks`). The admin currently uses `ExerciseContentEditor` for the field, but question blocks are still edited primarily as JSON via `JSONInspector`.

This task adds type-specific editors for all _question_ blocks, matching the existing Zod schema and shared types, without replacing the overall `ExerciseContentEditor` experience (layout, block list, add/move/delete, rich text editing, JSON panel).

Primary sources of truth:

- `src/server/payload/collections/Exercises/schemas.ts` (Zod validation for `content.blocks`)
- `src/shared/exercise-content/types.ts` (shared TS types consumed by admin UI)
- `src/ui/admin/ExerciseContentEditor/index.tsx` (admin editor surface)

## Goal

Replace JSON-first editing for question blocks with form-based editors that:

- Map 1:1 to the Zod schema shape for each question block type/variant.
- Preserve existing data and remain compatible with server-side validation.
- Keep an “Advanced JSON” escape hatch (read/edit) for power users and debugging.

## Non-Goals

- No changes to persisted schema for `exercises.content`.
- No migration of existing data.
- No rewrite/replacement of the `ExerciseContentEditor` container UI.
- No changes to frontend exercise rendering/grading logic.

## Definitions

Question blocks in the current schema:

- `question_select` with `variant: 'true_false'`
- `question_select` with `variant: 'mcq'`
- `question_free_response`
- `question_table`

Supporting blocks (not in scope for custom editors):

- `rich_text` (already uses a dedicated editor)
- `latex` (not a question block; can remain JSON or get a small editor later)

## Requirements

### R1: Type-Specific Editors (Per Block)

For each question block type/variant, provide a dedicated editor UI that edits exactly the fields defined by the Zod schema:

1. `question_select` / `variant: 'true_false'`

- Editable:
  - `prompt` (Inline rich text)
  - `answer.correctOptionId` (one of `true`/`false`)
  - `hint` / `solution` / `fullSolution` (optional Inline rich text)
- Non-editable (fixed/derived, but must be preserved):
  - `type`, `variant`, `selectionMode` (always `'single'`)
  - `options` tuple with ids `true`/`false` and labels

2. `question_select` / `variant: 'mcq'`

- Editable:
  - `prompt`
  - `selectionMode` (`single` | `multiple`)
  - `answer.options` list (add/remove/reorder; each option has `id` + `content`)
  - `answer.correctOptionIds` selection UI aligned with `selectionMode`
  - `hint` / `solution` / `fullSolution`
- Must enforce invariants aligned with Zod superRefine:
  - `correctOptionIds` is a subset of `options[].id`
  - if single-select: exactly one correct option
  - `answer.multiSelect` must remain consistent with `selectionMode` (see R3)

3. `question_free_response`

- Editable:
  - `prompt`
  - `answer.acceptedAnswers` (array of strings; min 1)
  - `hint` / `solution` / `fullSolution`

4. `question_table`

- Editable:
  - `prompt`
  - `table.solutionFill`
  - `table.headers` (array; min 1)
  - `table.rowsData` (2D array; min 1 row; each row must match header column count)
  - `table.answers` (map of `"rowIdx-colIdx" -> string`, optional)
  - `table.showBorders`, `table.showHeader`
  - `table.columnAlignment` (optional; length must match header count)
- Must enforce invariants aligned with Zod superRefine when `solutionFill === true`:
  - every empty cell in `rowsData` must have an entry in `answers`
  - `answers` keys must be in bounds
  - `answers` keys must point only to empty cells

### R2: Keep Existing Editor Container

No changes to the overall workflow:

- Block list remains the primary editing surface.
- Add/move/delete remains the same.
- The right-side JSON panel remains available.

Change only the rendering of question blocks from “JSON editor” to “typed editor”.

### R3: Data Normalization Rules (In-Editor)

The typed editors must normalize data as the user edits to prevent invalid states.

Required normalizations:

- MCQ:
  - `selectionMode === 'single'` => force `answer.multiSelect = false` and `correctOptionIds = [oneOptionId]`.
  - `selectionMode === 'multiple'` => force `answer.multiSelect = true` and allow 1+ `correctOptionIds`.
  - When an option is deleted, remove its id from `correctOptionIds`.
  - When option ids change (if editable), rewrite `correctOptionIds` accordingly.

- Table:
  - When header count changes, resize each row to match.
  - When rows are added/removed, drop out-of-bounds `answers` keys.
  - When toggling `solutionFill` on:
    - Ensure `answers` exists (at least `{}` initially).
    - Provide a guided UI to mark cells fillable + set their correct value, which translates into `rowsData[row][col] === ''` and `answers["row-col"] = <value>`.
  - When toggling `solutionFill` off:
    - Keep `answers` but hide it by default (no destructive delete).

### R4: Validation + Error UX

- Client-side validation should exist at two levels:
  - Inline, per-editor guardrails (disable invalid actions; show immediate field errors for obvious issues like “no accepted answers”).
  - Optional “Validate Block” action per block, using the same Zod schema bundle if feasible in the admin runtime.
- If a block is structurally invalid (e.g. edited via JSON and no longer matches expected shape), the typed editor must:
  - Show a clear error state (what is missing / what is wrong at a high level).
  - Provide a single action: “Open Advanced JSON” to repair.

Server-side validation remains authoritative via `ContentSchema` in the collection field validate.

### R5: Advanced JSON Escape Hatch

- JSON view/edit stays available.
- For question blocks, JSON is hidden behind an explicit “Advanced JSON” toggle/button (to reduce accidental usage).
- Applying JSON changes should re-render the typed editor if the block becomes valid.

### R6: Backward Compatibility

- Existing documents must remain editable.
- No automatic data reshaping on load beyond safe normalization (R3) that preserves semantics.
- Any unknown future block types should continue to render with the existing JSON inspector so the editor remains forward-compatible.

## Proposed Admin UI Design (High-Level)

### Shared Building Blocks

1. `InlineRichTextEditor`

- A small component that edits an `InlineRichText` object:
  - primary control: markdown editor for `value` (reuse existing `RichTextEditor` behavior)
  - optional controls: media ids management (Stage 2; see Stages)
- Must preserve `type`, `format`, `mediaIds`.

2. `HintSolutionPanel`

- A collapsible panel for `hint`, `solution`, `fullSolution`.
- Each field is optional; provide “Enable” toggles that add/remove the object (or set to `undefined`) without losing content accidentally.

3. `QuestionBlockHeader`

- Displays the block type badge and quick actions:
  - Move up/down
  - Delete
  - Advanced JSON toggle

### Per-Block Editors

1. True/False (`question_select` + `variant: 'true_false'`)

- Prompt editor
- Correct answer radio group (True/False)
- Hint/Solution panel
- (Optional) edit labels for True/False options (if you want teacher-defined phrasing); if not, keep fixed but preserve existing.

2. MCQ (`question_select` + `variant: 'mcq'`)

- Prompt editor
- Selection mode toggle:
  - Single (radio)
  - Multiple (checkbox)
- Options list:
  - Add option
  - Remove option
  - Reorder options
  - Edit option content (Inline rich text)
- Correct option selection UI aligned with selection mode
- Hint/Solution panel

3. Free Response (`question_free_response`)

- Prompt editor
- Accepted answers editor:
  - Tag-style input or line-separated list
  - Must enforce min 1
- Hint/Solution panel

4. Table (`question_table`)

- Prompt editor
- Table builder:
  - Header row editor
  - Row/column add/remove
  - Cell editor grid
- Solution-fill mode:
  - When off: all cells are just text
  - When on: each cell supports “fillable” toggle; fillable cells become empty in `rowsData` and store answer in `answers`
- Table display options:
  - borders, header visibility
  - per-column alignment

## Architecture Notes

### Where This Fits

- `Exercises` collection stays unchanged; the `content` field remains JSON.
- `ExerciseContentEditor` continues managing localValue, Save Changes, block operations.
- Only the “question block rendering” section changes: it should dispatch by block type/variant to typed editors instead of embedding `JSONInspector` as the primary UI.

### Type + Schema Alignment

- All editors must use `src/shared/exercise-content/types.ts` types as the UI contract.
- Validation and edge-case rules must mirror `src/server/payload/collections/Exercises/schemas.ts`.
- If discrepancies are found (e.g., a field exists in Zod but not in shared types), the spec requires resolving them before UI is considered done.

## Stages (Single Path)

### Stage 1 — Typed Editors for Select + Free Response

Timebox: 1 day

Deliverables:

- True/False editor
- MCQ editor (options + correct answer + selection mode normalization)
- Free response editor (acceptedAnswers)
- Advanced JSON remains accessible

Guardrails:

- No schema changes
- No media editing inside inline rich text yet (preserve existing `mediaIds` silently)

Gates:

- Create/edit each question type without touching JSON and save successfully.
- Server-side `ContentSchema` accepts edited content.

### Stage 2 — Table Editor (solutionFill support)

Timebox: 1–2 days

Deliverables:

- Table builder grid
- solutionFill workflow that guarantees Zod invariants
- Minimal inline validation messages

Gates:

- Can build a valid `question_table` with `solutionFill: true` without using JSON.

### Stage 3 — Inline Rich Text MediaIds (Optional)

Timebox: 0.5–1 day

Deliverables:

- Media picker support for `InlineRichText.mediaIds` inside prompt/options/hint/solution/fullSolution

Gates:

- mediaIds can be added/removed in question prompts/options and persists.

## Testing Strategy (High-Level)

- Unit tests for normalization functions (MCQ + table key behaviors).
- Admin-component tests (lightweight): render editor, simulate edits, ensure resulting block JSON matches expected shape.
- Integration test: create an exercise, edit each question block via typed UI, save, and verify server-side validation passes.

## Acceptance Criteria

- All question blocks are fully editable through typed UIs that map to the Zod schema.
- Editors prevent common invalid states (especially MCQ correctness selection and table solutionFill constraints).
- “Advanced JSON” remains available but is not the primary UI for question blocks.
- No schema changes and no migrations.

## Open Questions (Must Answer If You Want Them In V1)

1. Should True/False option labels be editable (stored in `options[].label.value`) or fixed to “True/False”?
   - Default: fixed labels, preserve any existing values.

2. Is editing `InlineRichText.mediaIds` required in V1 for prompts/options/hints, or can it be Stage 3?
   - Default: Stage 3.
