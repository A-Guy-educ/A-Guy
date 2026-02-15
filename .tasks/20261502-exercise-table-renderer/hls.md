# HLS — Exercise Table Renderer (Student/Lesson UI)

**Date:** 2026-02-15
**Status:** Draft
**Depends on:** `.tasks/20261002-exercise-table-question-type/spec.md` (schema + admin — already implemented)

---

## 1. Goal

Render `question_table` blocks in the student-facing lesson UI so that tables authored in the admin panel are visible and interactive during exercises.

This HLS focuses exclusively on **UI behaviour** derived from the legacy Aguy project (`Aguy/Frontend/aguy/src/components/Exercise/Table.jsx`). Styling must follow the new design system; UX must match existing exercise block patterns (`TrueFalseQuestion`, `McqQuestion`, `FreeResponseQuestion`).

---

## 2. Scope

### Included

- Student-facing table renderer for `question_table` blocks.
- Display-only mode (table without fillable cells, `solutionFill=false`).
- Fillable-cell mode (table with `solutionFill=true`, empty cells become inputs).
- Client-side answer checking with correct/incorrect visual feedback per cell.
- "Check Table" / "Retry" interaction flow.
- Integration into the existing `ExerciseRenderer` block loop.
- Type system updates (`types.ts`, `answerChecking.ts`).
- Rich text / LaTeX support inside table cells (reuse `RichTextRenderer` / `md-math-v1`).

### Out of Scope

- LLM/AI fallback validation (future enhancement).
- SVG cell content (not used in new project's content model — cells are plain strings / `md-math-v1`).
- Admin editing (already implemented — `TableEditor.tsx`).
- Grading persistence / attempt storage.

---

## 3. Behaviour Specification (from Aguy Legacy)

### 3.1 Table Rendering (Display)

| Aspect | Behaviour |
|---|---|
| **Layout** | HTML `<table>` with `border-collapse: collapse`, `table-layout: fixed`, full width of exercise content area. |
| **Headers** | Rendered as `<thead><tr><th>` cells. Each header cell supports `md-math-v1` rich text (LaTeX, bold, etc.). |
| **Header visibility** | When `showHeader=false`, the `<thead>` is not rendered at all. |
| **Rows** | Each row in `rowsData` renders as `<tr>` with `<td>` cells. |
| **Cell content** | Each cell value is rendered through the same `md-math-v1` rich text pipeline used by `RichTextRenderer`. Empty non-fillable cells render as a blank space with minimum height. |
| **Borders** | When `showBorders=true` (default), cells have visible borders. When `showBorders=false`, all borders and box shadow are removed. |
| **Column alignment** | Each column respects its `columnAlignment` value (`left`, `center`, `right`). Default is `center` if `columnAlignment` is not provided. Applied to both `<th>` and `<td>`. |
| **Column widths** | Columns share equal width by default (`table-layout: fixed`). If a column has fillable cells, a minimum width is enforced (see 3.2). |
| **Alternating rows** | Even rows get a subtle background tint for readability. |
| **Responsive** | Table wrapper has `overflow-x: auto` for horizontal scroll on narrow screens. |

### 3.2 Fillable Cells (Interactive — `solutionFill=true`)

A cell is fillable when ALL of these are true:
1. `table.solutionFill === true`
2. `rowsData[rowIdx][colIdx] === ""` (empty string)
3. `table.answers` contains key `"${rowIdx}-${colIdx}"`

| Aspect | Behaviour |
|---|---|
| **Input element** | Fillable cell renders a text `<input>` (not textarea) inside the `<td>`. |
| **Input direction** | `dir="ltr"`, `text-align` matches column alignment. |
| **Input width** | 100% of cell. Minimum cell width calculated from the longest answer in that column (min ~120px). |
| **Placeholder** | None (empty input). |
| **Disabled state** | When the question is already answered correctly, all inputs become `readOnly`. |
| **Fixed empty cells** | Empty cells that do NOT have a matching answer key render as a non-interactive empty block (not an input). |

### 3.3 Answer Checking Flow

The table question uses its own "Check Table" button (not the generic `QuestionCard` check button), because checking is per-table (all cells at once), not per-question.

| Step | Behaviour |
|---|---|
| **1. Initial state** | All fillable inputs are editable. "Check Table" button visible below the table. |
| **2. User fills cells** | Student types answers into fillable inputs. No live validation. |
| **3. Click "Check Table"** | All fillable cells are validated simultaneously against `table.answers`. |
| **4. Per-cell feedback** | Each cell input gets a visual state: **correct** (green border + background) or **incorrect** (red border + background). Cell value is preserved. |
| **5. Overall result** | If ALL cells correct → show success feedback (matches `QuestionCard` success pattern: green border on card, "Correct" message). If ANY cell incorrect → show "Incorrect" feedback. |
| **6. Retry** | After a failed check, the button text changes to "Try Again". Incorrect cells remain editable with red styling. Correct cells become read-only with green styling. |
| **7. On correct** | All inputs become read-only. Button changes to disabled "Correct" state matching other question blocks. Dispatch `exercise-incorrect-answer` event is NOT triggered (only on failure). |
| **8. On incorrect** | Dispatch `exercise-incorrect-answer` CustomEvent (once per question, matching existing pattern) with table JSON + student answers for chat AI context. |

### 3.4 Client-Side Validation Strategy

Validation is performed per-cell. For each fillable cell at `"${rowIdx}-${colIdx}"`:

| Strategy | Description | Priority |
|---|---|---|
| **Exact match** | Normalize both values (trim, lowercase, strip HTML/LaTeX wrappers, collapse whitespace), then compare strings. | 1st |
| **Numeric match** | Parse both as floats. If both parse successfully, compare with tolerance `0.01`. Handle RTL minus convention (trailing `-` → leading `-`). | 2nd |

If either strategy matches → cell is **correct**. Otherwise → **incorrect**.

### 3.5 Table as Question Block (Integration Pattern)

The table question follows the same structural pattern as other questions:

```
┌─ QuestionCard ─────────────────────────────┐
│  ┌─ Prompt (RichTextRenderer) ──────────┐  │
│  │  "Complete the table:"               │  │
│  └──────────────────────────────────────┘  │
│  ┌─ ExerciseTable ──────────────────────┐  │
│  │  ┌──────┬──────┬──────┐              │  │
│  │  │ hdr1 │ hdr2 │ hdr3 │              │  │
│  │  ├──────┼──────┼──────┤              │  │
│  │  │ val  │ val  │ [__] │ ← input      │  │
│  │  ├──────┼──────┼──────┤              │  │
│  │  │ val  │ val  │ [__] │ ← input      │  │
│  │  └──────┴──────┴──────┘              │  │
│  └──────────────────────────────────────┘  │
│  ┌─ Check Button ───────────────────────┐  │
│  │  [ Check Table ]  or  [ ✓ Correct ]  │  │
│  └──────────────────────────────────────┘  │
│  ┌─ Feedback (if checked) ──────────────┐  │
│  │  ✓ Correct  /  ✗ Incorrect           │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

The table question renders inside `QuestionCard` just like other questions, reusing `FeedbackDisplay` for the overall result.

---

## 4. Component Architecture

### 4.1 New Files

| File | Purpose |
|---|---|
| `src/ui/web/exerciserenderer/questions/TableQuestion/index.tsx` | Main `TableQuestion` component (prompt + table + check button). |
| `src/ui/web/exerciserenderer/questions/TableQuestion/ExerciseTable.tsx` | Pure table renderer (headers, rows, fillable cells). |
| `src/ui/web/exerciserenderer/questions/TableQuestion/tableValidation.ts` | Client-side cell validation (exact match, numeric match). |

### 4.2 Modified Files

| File | Change |
|---|---|
| `src/ui/web/exerciserenderer/types.ts` | Add `QuestionTableBlock`, `TableBlock`, `TableUserAnswer`, `TableCellResult` types. Add to `QuestionBlock` union and `ContentBlock` union. |
| `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` | Add `question_table` branch in the block rendering loop. Include in `questionBlocks` filter. |
| `src/ui/web/exerciserenderer/utils/answerChecking.ts` | Add `question_table` case to `checkQuestionAnswer` and `getInitialAnswer`. |
| `messages/en.json` | Add `courses.checkTable`, `courses.tryAgain` translation keys. |
| `messages/he.json` | Add Hebrew equivalents. |

### 4.3 Type Additions (types.ts)

```typescript
export interface TableBlock {
  solutionFill: boolean
  headers: string[]
  rowsData: string[][]
  answers?: Record<string, string>
  showBorders: boolean
  showHeader: boolean
  columnAlignment?: ('left' | 'center' | 'right')[]
}

export interface QuestionTableBlock {
  id: string
  type: 'question_table'
  prompt: InlineRichText
  table: TableBlock
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

// Add to UserAnswer union:
| { type: 'table'; cellValues: Record<string, string> }  // key: "rowIdx-colIdx"

// Cell-level check result:
export interface TableCellResult {
  key: string          // "rowIdx-colIdx"
  isCorrect: boolean
}
```

---

## 5. Behavioural Edge Cases

| Case | Behaviour |
|---|---|
| `solutionFill=false` (display-only table) | Render table with no inputs, no check button. Table appears as content block similar to `rich_text`. |
| Empty `rowsData` or `headers` | Should not happen (Zod schema enforces min 1). If encountered, render nothing / skip gracefully. |
| All cells already correct on first check | Immediately show success state, disable all inputs. |
| `columnAlignment` missing | Default all columns to `center`. |
| `columnAlignment` shorter than headers | Pad with `center` for missing columns. |
| Cell value contains LaTeX (`$...$`) | Render via `md-math-v1` pipeline (same as `RichTextRenderer`). |
| Fillable cell answer contains LaTeX | Compare raw string values (before rendering). Validation strips LaTeX wrappers for comparison. |
| Non-fillable table inside exercise with other questions | Table renders inline in the block stream. Other questions retain their own check buttons. |

---

## 6. Styling Constraints

- All colours via CSS variables / Tailwind design tokens (`bg-success`, `border-destructive`, `bg-muted`, etc.).
- No hardcoded hex values.
- Table must look consistent with `Card` component styling.
- Fillable cell input styling follows the existing `Textarea` / `Input` component patterns.
- Correct/incorrect cell colours use the same semantic tokens as `FeedbackDisplay` (`success`, `destructive`).
- RTL support via `dir` attribute and Tailwind logical properties where applicable.

---

## 7. Acceptance Criteria

1. Exercises with `question_table` blocks (both `solutionFill=true` and `false`) render correctly in the lesson UI.
2. Table displays headers, rows, borders, and alignment per backend data.
3. `showBorders=false` removes all table borders.
4. `showHeader=false` hides the header row.
5. Fillable cells render as text inputs; non-fillable cells render as static content.
6. "Check Table" validates all cells and shows per-cell correct/incorrect feedback.
7. Fully correct table shows overall success state matching other question blocks.
8. Incorrect answer dispatches `exercise-incorrect-answer` event once per question.
9. LaTeX / `md-math-v1` content renders correctly in cells.
10. No console errors when table data exists in backend.
11. Works in both LTR and RTL layouts.
12. Translations exist for both `en` and `he`.
