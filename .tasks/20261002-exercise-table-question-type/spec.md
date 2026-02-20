# Exercise Table Question Type (Admin + Zod Only)

Date: 2026-02-10
Owner: OpenCode (spec)
Status: Draft

## PRD

### Goal

Add a new exercise question block type, `question_table`, representing a table-based question with optional fillable cells, validated by Zod and creatable/editable in the Payload admin UI.

### User Problem

Teachers need to author exercises where the question is naturally expressed as a table (rows/columns), including cases where students are expected to fill specific cells.

### Key Decisions (Locked)

- This stage is **schema + admin authoring only**. No student runtime grading/validation endpoint.
- The exercise content model remains a **single ordered block stream** (`content.blocks`). The table question is another block in this stream.
- Block naming follows existing conventions: question blocks are `question_*`.
- **Fillable cell rule (enforced at schema level)**:
  - A cell is considered fillable iff:
    - `solutionFill === true`, and
    - the cell value in `rowsData[rowIdx][colIdx]` is an empty string, and
    - `answers` contains a key `${rowIdx}-${colIdx}`.
  - Guardrail: if `solutionFill === true`, **every empty cell must have a matching answer key** (prevents silent “ungradable blanks”).

### Requirements

- Zod schema:
  - Add `question_table` to the Exercises content block discriminated union.
  - Enforce rectangular table structure (all rows match header column count).
  - Enforce answer key format and bounds (`rowIdx-colIdx` within `rowsData`).
  - Enforce fillable cell invariants when `solutionFill === true`.
- Admin UI authoring:
  - “Add block” menu includes “Table Question”.
  - A default table question block is inserted with sensible starter data.
  - The existing JSON-based editing flow works for this block (no custom table builder in this stage).
- Backward compatibility:
  - No migration needed; this is a net-new block type.

### Out Of Scope

- Frontend renderer changes (student view) for `question_table`.
- Any grading UI (“Check Table”, per-cell feedback), attempt state, or submission storage.
- Any LLM/semantic validation endpoint.

### Success Metrics (Practical)

- In Payload Admin, teachers can create/edit an Exercise containing a `question_table` block and save successfully.
- Invalid tables are rejected with clear validation errors (rectangular rows, invalid answer keys, out-of-bounds indices, missing answers for empty cells when `solutionFill` is enabled).

## HLS

### Current State (Relevant)

- Exercise content is stored in `exercises.content` as JSON validated by `ContentSchema`.
- Content block validation is defined in `src/server/payload/collections/Exercises/schemas.ts`.
- Admin authoring uses a block editor that inserts blocks using factories:
  - `src/server/payload/collections/Exercises/defaults.ts` (`ExerciseBlockDefaults`)
  - `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx`
  - `src/ui/admin/ExerciseContentEditor/index.tsx` (block list + JSON inspector)

### Proposed Data Model (Block Shape)

Add a new block type:

```json
{
  "id": "...",
  "type": "question_table",
  "prompt": { "type": "rich_text", "format": "md-math-v1", "value": "...", "mediaIds": [] },
  "table": {
    "solutionFill": true,
    "headers": ["Step", "Calculation", "Result"],
    "rowsData": [
      ["1", "2+2", ""],
      ["2", "3+4", ""]
    ],
    "answers": {
      "0-2": "4",
      "1-2": "7"
    },
    "showBorders": true,
    "showHeader": true,
    "columnAlignment": ["center", "left", "right"]
  },
  "hint": { "type": "rich_text", "format": "md-math-v1", "value": "", "mediaIds": [] },
  "solution": { "type": "rich_text", "format": "md-math-v1", "value": "", "mediaIds": [] },
  "fullSolution": { "type": "rich_text", "format": "md-math-v1", "value": "", "mediaIds": [] }
}
```

Notes:

- `headers` and `rowsData` cell values are plain strings, expected to follow the same authoring conventions as markdown/math text used elsewhere (rendering is out of scope here).
- `answers` is a string-to-string map keyed by `${rowIdx}-${colIdx}`.
- `columnAlignment` values: `left | center | right`.

### Zod Contract (Validation Rules)

Add `QuestionTableBlockSchema` with these rules:

- Base:
  - `id`: non-empty string.
  - `type`: literal `question_table`.
  - `prompt`: `InlineRichTextSchema` (same as other question blocks).
  - `table`: object, strict.
- Table shape:
  - `headers`: `string[]`, min 1.
  - `rowsData`: `string[][]`, min 1.
  - Rectangular: every row length equals `headers.length`.
- Display options:
  - `showBorders`: boolean, default `true`.
  - `showHeader`: boolean, default `true`.
  - `columnAlignment`: optional array of enum values; if present, length must equal `headers.length`.
- Fill mode:
  - `solutionFill`: boolean, default `false`.
  - If `solutionFill === true`:
    - `answers` is required and must have at least 1 entry.
    - Every key must match regex `^\\d+-\\d+$`.
    - Each key index must be within bounds of `rowsData`.
    - For each answer key `r-c`, `rowsData[r][c]` must be `""` (empty string).
    - For every empty cell `rowsData[r][c] === ""`, `answers` must contain key `r-c`.
- If `solutionFill === false`:
  - `answers` is optional; if provided, it is still bounds-checked (guardrail).

### Admin UX Contract

- Add Block menu:
  - Add a “Table Question” entry that inserts a `question_table` block using `ExerciseBlockDefaults`.
- Editing:
  - Uses the existing JSON inspector panel for the block.
  - Badge label in block list shows “Table Question”.

### Risks / Guardrails

- Critical: Without strict rectangular validation, tables will become non-renderable and un-debuggable in content.
- Medium: Answer keys can drift when teachers edit `rowsData` manually; schema-level invariants prevent the worst cases but don’t solve UX. (Custom builder is explicitly deferred.)

## LLP

### Stage 1 (Timebox: 1–2h) — Zod Schema Extension

Deliverable: `question_table` is accepted by the Exercises `ContentSchema` and rejected when invalid.

Implementation notes:

- Add `QuestionTableBlockSchema` to `src/server/payload/collections/Exercises/schemas.ts`.
- Add it to `ContentBlockSchema` discriminated union.
- Re-export types similarly to other blocks.

Acceptance criteria:

- `ContentSchema.safeParse(...)` accepts a valid `question_table` block.
- It rejects:
  - non-rectangular `rowsData`
  - malformed answer keys
  - out-of-bounds answer indices
  - `solutionFill=true` with empty cells missing answers
  - `solutionFill=true` with answer keys pointing to non-empty cells

### Stage 2 (Timebox: 1–2h) — Admin Block Authoring Support

Deliverable: teachers can insert and edit a `question_table` block in Payload Admin.

Implementation notes:

- Add factory to `src/server/payload/collections/Exercises/defaults.ts` under a new menu key (recommended): `question_table`.
- Update `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx` to show “Table Question”.
- Update `src/ui/admin/ExerciseContentEditor/index.tsx` to display the correct badge label for this block.

Acceptance criteria:

- “Add block” shows “Table Question”.
- Inserting it creates a valid default block that passes `ContentSchema` validation.
- Saving an Exercise with this block succeeds.

### Stage 3 (Timebox: 1–2h) — Contract Tests / Gates

Deliverable: automated coverage to prevent regressions.

Implementation notes:

- Add integration/contract tests validating `QuestionTableBlockSchema` edge cases.

Quality gates (must pass):

- `pnpm -s tsc --noEmit`
- `pnpm -s lint`
- relevant test suite(s) covering schema validation

## Open Questions

- None for this stage. Frontend rendering and student-side interaction/grading are explicitly deferred.
