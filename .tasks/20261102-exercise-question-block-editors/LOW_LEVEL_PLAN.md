# Low-Level Plan: Exercise Question Block Editors

## File Map

```
src/ui/admin/ExerciseContentEditor/
├── index.tsx                          # MODIFY — swap question block rendering
├── index.css                          # MODIFY — add styles for typed editors
├── editors/                           # NEW directory
│   ├── InlineRichTextEditor.tsx       # NEW — shared prompt/hint editor
│   ├── HintSolutionPanel.tsx          # NEW — shared collapsible hint/solution/fullSolution
│   ├── TrueFalseEditor.tsx            # NEW — true/false question editor
│   ├── McqEditor.tsx                  # NEW — MCQ question editor
│   ├── FreeResponseEditor.tsx         # NEW — free response question editor
│   ├── TableEditor.tsx                # NEW — table question editor (Stage 2)
│   ├── QuestionBlockWrapper.tsx       # NEW — wrapper with badge + Advanced JSON toggle
│   └── normalizers.ts                 # NEW — pure functions for MCQ/table normalization
├── JSONInspector.tsx                  # NO CHANGE (reused inside Advanced JSON toggle)
├── BlockTypeSelector.tsx              # NO CHANGE
├── RichTextEditor.tsx                 # NO CHANGE
├── MediaPicker.tsx                    # NO CHANGE
```

---

## Stage 1: Steps (True/False + MCQ + Free Response)

### Step 1: Create `InlineRichTextEditor.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor.tsx`

**What it does:** Edits an `InlineRichText` object (`{ type, format, value, mediaIds }`). Only `value` is user-editable. The rest are preserved silently.

**Props:**

```ts
interface InlineRichTextEditorProps {
  value: InlineRichText
  onChange: (value: InlineRichText) => void
  placeholder?: string
  minHeight?: string // default '80px' — shorter than RichTextEditor's 200px
}
```

**Implementation:**

- Reuse the same toolbar pattern from `RichTextEditor.tsx` (Bold, Italic, Heading, Code, Math, Link buttons with `insertText` helper).
- Render a `<textarea>` for `value.value`.
- On change: call `onChange({ ...value, value: newText })` — preserving `type`, `format`, `mediaIds`.
- Use CSS class `.inline-rich-text-editor` with a shorter default height than `.rich-text-textarea`.
- Show character count footer.

---

### Step 2: Create `HintSolutionPanel.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/HintSolutionPanel.tsx`

**What it does:** Collapsible panel containing three optional `InlineRichText` fields: hint, solution, fullSolution.

**Props:**

```ts
interface HintSolutionPanelProps {
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  onChange: (field: 'hint' | 'solution' | 'fullSolution', value: InlineRichText | undefined) => void
}
```

**Implementation:**

- Use `CollapsibleSection` from `src/ui/admin/shared/CollapsibleSection.tsx` with title "Hints & Solutions", default collapsed.
- For each field (hint, solution, fullSolution):
  - If `undefined`: show an "Enable" button. Clicking creates a default `InlineRichText`.
  - If defined: show `InlineRichTextEditor` + a "Remove" button (sets to `undefined`).
- Labels: "Hint", "Solution", "Full Solution".

---

### Step 3: Create `QuestionBlockWrapper.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/QuestionBlockWrapper.tsx`

**What it does:** Wraps any typed question editor with a type badge and an "Advanced JSON" toggle.

**Props:**

```ts
interface QuestionBlockWrapperProps {
  blockType: string // e.g. "True/False", "Multiple Choice", etc.
  block: ContentBlock
  onBlockChange: (block: ContentBlock) => void
  children: React.ReactNode // the typed editor
}
```

**Implementation:**

- Render the `.question-block-type-badge` (already styled in CSS).
- Render `children` (the typed editor).
- Below children: render an `AdvancedJsonPanel` from `src/ui/admin/shared/AdvancedJsonPanel.tsx` with `value={block}` and `onChange`. Collapsed by default.
- If the block fails to match the expected shape: show an error banner + force-open the Advanced JSON panel.

---

### Step 4: Create `normalizers.ts`

**File:** `src/ui/admin/ExerciseContentEditor/editors/normalizers.ts`

**What it does:** Pure functions that enforce invariants from R3.

**Functions:**

```ts
// MCQ: sync multiSelect with selectionMode, trim correctOptionIds
export function normalizeMcq(block: QuestionSelectMcqBlock): QuestionSelectMcqBlock

// MCQ: when an option is removed, clean up correctOptionIds
export function removeOptionAndNormalize(
  block: QuestionSelectMcqBlock,
  optionId: string,
): QuestionSelectMcqBlock

// MCQ: when selectionMode changes, reset correctOptionIds if needed
export function changeSelectionMode(
  block: QuestionSelectMcqBlock,
  mode: 'single' | 'multiple',
): QuestionSelectMcqBlock
```

**Key rules (MCQ):**

- `selectionMode === 'single'` → `answer.multiSelect = false`, `correctOptionIds` trimmed to first item only.
- `selectionMode === 'multiple'` → `answer.multiSelect = true`.
- After deleting an option: `correctOptionIds` filtered to remove deleted option's id.

---

### Step 5: Create `TrueFalseEditor.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/TrueFalseEditor.tsx`

**Props:**

```ts
interface TrueFalseEditorProps {
  block: QuestionSelectTrueFalseBlock
  onChange: (block: QuestionSelectTrueFalseBlock) => void
}
```

**UI Layout:**

1. **Prompt** — `InlineRichTextEditor` editing `block.prompt`.
2. **Correct Answer** — Two styled radio buttons: "True" and "False". Selected = `block.answer.correctOptionId`.
3. **Hints & Solutions** — `HintSolutionPanel`.

---

### Step 6: Create `McqEditor.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/McqEditor.tsx`

**Props:**

```ts
interface McqEditorProps {
  block: QuestionSelectMcqBlock
  onChange: (block: QuestionSelectMcqBlock) => void
}
```

**UI Layout:**

1. **Prompt** — `InlineRichTextEditor`.
2. **Selection Mode** — Two buttons/tabs: "Single Answer" | "Multiple Answers". Maps to `block.selectionMode`.
3. **Options List** — For each option:
   - Correct marker (Radio if single, Checkbox if multiple).
   - Option content: `InlineRichTextEditor`.
   - Move up/down buttons.
   - Delete button (disabled if only 2 options remain).
4. **Add Option** button.
5. **Hints & Solutions** — `HintSolutionPanel`.

---

### Step 7: Create `FreeResponseEditor.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/FreeResponseEditor.tsx`

**Props:**

```ts
interface FreeResponseEditorProps {
  block: QuestionFreeResponseBlock
  onChange: (block: QuestionFreeResponseBlock) => void
}
```

**UI Layout:**

1. **Prompt** — `InlineRichTextEditor`.
2. **Accepted Answers** — List of text inputs with "Add Answer" and delete buttons (disabled if only 1 answer).
3. **Hints & Solutions** — `HintSolutionPanel`.

---

### Step 8: Modify `ExerciseContentEditor/index.tsx` — Wire Up Editors

**File:** `src/ui/admin/ExerciseContentEditor/index.tsx`

Replace lines 507-521 with:

```tsx
<QuestionBlockWrapper
  blockType={getBlockTypeLabel(block)}
  block={block}
  onBlockChange={(updated) => onUpdateBlock(block.id, updated)}
>
  {renderQuestionEditor(block, (updated) => onUpdateBlock(block.id, updated))}
</QuestionBlockWrapper>
```

Add `renderQuestionEditor` dispatcher function that returns the appropriate typed editor based on block type/variant.

---

### Step 9: Add CSS for Typed Editors

**File:** `src/ui/admin/ExerciseContentEditor/index.css`

Add sections for:

- `.inline-rich-text-editor`
- `.hint-solution-panel`
- `.tf-radio-group`, `.tf-radio-option`, `.tf-radio-option--selected`
- `.mcq-option-row`
- `.mcq-selection-mode`
- `.accepted-answers-list`, `.accepted-answer-row`
- `.question-editor-section`
- `.question-editor-label`

---

### Step 10: Verify & Test (Stage 1 Gate)

1. Run `pnpm tsc --noEmit`
2. Run `pnpm generate:importmap`
3. Manual test in browser
4. Run `pnpm lint`

---

## Stage 2: Table Editor

### Step 11: Create `TableEditor.tsx`

**File:** `src/ui/admin/ExerciseContentEditor/editors/TableEditor.tsx`

**UI Layout:**

1. **Prompt** — `InlineRichTextEditor`.
2. **Table Config** — Checkboxes for `showBorders`, `showHeader`, `solutionFill`.
3. **Headers** — Editable row of text inputs. "Add Column" / "Remove Column" buttons.
4. **Column Alignment** — Per-column select: left/center/right.
5. **Data Rows** — Grid of text inputs. "Add Row" / "Remove Row" buttons.
6. **Solution Fill Mode** (when `solutionFill === true`):
   - Empty cells get visual indicator.
   - Below each empty cell: text input for correct answer.
7. **Hints & Solutions** — `HintSolutionPanel`.

### Step 12: Add table normalizers to `normalizers.ts`

- `normalizeTableOnHeaderChange`: resize rows when header count changes.
- `normalizeTableAnswers`: drop out-of-bounds answer keys.
- `normalizeTableSolutionFill`: handle toggle on/off.

### Step 13: Add table CSS + verify

Same pattern as Step 9-10 for `.table-editor-*` classes.

---

## Summary: Files Created / Modified

| File                               | Action                  | Stage |
| ---------------------------------- | ----------------------- | ----- |
| `editors/InlineRichTextEditor.tsx` | CREATE                  | 1     |
| `editors/HintSolutionPanel.tsx`    | CREATE                  | 1     |
| `editors/QuestionBlockWrapper.tsx` | CREATE                  | 1     |
| `editors/normalizers.ts`           | CREATE                  | 1+2   |
| `editors/TrueFalseEditor.tsx`      | CREATE                  | 1     |
| `editors/McqEditor.tsx`            | CREATE                  | 1     |
| `editors/FreeResponseEditor.tsx`   | CREATE                  | 1     |
| `editors/TableEditor.tsx`          | CREATE                  | 2     |
| `index.tsx`                        | MODIFY (lines ~507-521) | 1     |
| `index.css`                        | MODIFY (append)         | 1+2   |

**Zero changes to:** schemas, types, defaults, collection config, frontend rendering, grading.
