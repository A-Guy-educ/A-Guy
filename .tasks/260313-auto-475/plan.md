# Plan: 260313-auto-475 — Graph Display Size Control

## Rerun Context

This is a rerun requested via `/cody rerun` with no specific code-level feedback. The previous run likely lacked a plan. This plan addresses the full feature from scratch with proper step ordering and TDD gates.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/collections/Exercises/schemas.ts` — QuestionAxisBlockSchema at lines 417-428, uses `.strict()`
- ✅ `src/server/payload/collections/Exercises/types.ts` — QuestionAxisBlock interface at lines 224-233
- ✅ `src/server/payload/collections/Exercises/defaults.ts` — question_axis factory at lines 326-347
- ✅ `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — Admin axis editor (126 lines)
- ✅ `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Config panel for axis settings
- ✅ `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Student-facing renderer, hardcodes width=600 height=400
- ✅ `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — Board component, takes `width: number` and `height: number`
- ✅ `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` — Main renderer, lines 331-336 render question_axis blocks
- ✅ `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` — Admin canvas, also hardcodes 600x400
- ✅ `tests/int/contracts/axis-spec.int.spec.ts` — Existing axis schema tests
- ✅ `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Existing content block tests

### Patterns Observed
- Schemas use `.strict()` (no unknown keys allowed) — new fields must be added to the Zod schema for validation to pass
- TypeScript interfaces in `types.ts` mirror Zod schemas in `schemas.ts` manually (not generated)
- `defaults.ts` provides factory functions for each block type with sensible defaults
- The admin AxisEditor delegates to AxisConfigPanel for config fields (grid, viewport, labels)
- Student-facing AxisRenderer passes fixed pixel `width={600}` and `height={400}` to JSXGraphBoard
- JSXGraphBoard accepts `width: number` and `height: number` — sets them as inline style
- Both admin and student JSXGraphBoard components use inline `style={{ width, height }}` for sizing

### Integration Points
- QuestionAxisBlockSchema is part of ContentBlockSchema discriminated union (line 534)
- Adding a field to QuestionAxisBlockSchema doesn't affect the union discriminator (`type` field)
- ExerciseRenderer reads axis blocks at lines 331-336 using `b.axis as AxisSpecV1` — needs to also read `displaySize`

## Reuse Inventory

### Existing utilities the plan will reuse
- `AxisConfigPanel` from `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — extend with displaySize selector (same UI pattern: select dropdown + label)
- `generateId` from `src/server/payload/collections/Exercises/types.ts` — already used in defaults
- `cn` from `src/infra/utils/ui` — for conditional Tailwind classes in renderer
- Existing test patterns from `tests/int/contracts/axis-spec.int.spec.ts` and `exercise-content-blocks.int.spec.ts`

### New code justified
- `GraphDisplaySize` type constant — no existing enum/type for display sizes exists
- Display size → CSS width mapping utility — no existing sizing utility applies to graphs

---

## Step 1: Add `displaySize` to Schema, Types, and Defaults (Backend Contract)

**Spec refs**: Requirement 1 (Size Configuration), Requirement 2 (Default State), Requirement 6 (Size Persistence)

**Files to Touch**:
- `src/server/payload/collections/Exercises/schemas.ts` (MODIFIED — lines 417-428)
- `src/server/payload/collections/Exercises/types.ts` (MODIFIED — lines 224-233)
- `src/server/payload/collections/Exercises/defaults.ts` (MODIFIED — lines 326-347)

**Exact Behavior**:

1. In `schemas.ts`, add a `DisplaySizeSchema` Zod enum: `z.enum(['small', 'medium', 'large', 'full']).default('full')` representing width percentages (small=33%, medium=50%, large=75%, full=100%).

2. Add `displaySize: DisplaySizeSchema.optional()` to `QuestionAxisBlockSchema` (line 418, inside the `.object({...})`). Making it `.optional()` with `.default('full')` ensures backward compatibility — existing data without this field will parse as `'full'`.

3. In `types.ts`, add `displaySize?: 'small' | 'medium' | 'large' | 'full'` to the `QuestionAxisBlock` interface.

4. In `defaults.ts`, add `displaySize: 'full'` to the `question_axis` factory default (line 327).

**Tests that FAIL before, PASS after**:
- Test file: `tests/unit/collections/exercise-display-size.test.ts` (NEW)
- Test 1: "QuestionAxisBlockSchema accepts block with displaySize='small'" — parse a valid question_axis block with `displaySize: 'small'` → should NOT throw
- Test 2: "QuestionAxisBlockSchema accepts block without displaySize (backward compat)" — parse existing block data without displaySize → should NOT throw, parsed value should default to 'full'
- Test 3: "QuestionAxisBlockSchema rejects invalid displaySize value" — parse block with `displaySize: 'tiny'` → should throw ZodError
- Test 4: "ContentBlockSchema validates question_axis with displaySize" — parse through ContentBlockSchema union → should NOT throw
- **Run**: `pnpm vitest run tests/unit/collections/exercise-display-size.test.ts`

**Acceptance Criteria**:
- [ ] `QuestionAxisBlockSchema.parse(blockWithDisplaySize)` succeeds for all valid sizes
- [ ] Existing blocks without `displaySize` still parse correctly (defaults to 'full')
- [ ] Invalid `displaySize` values are rejected by Zod
- [ ] `QuestionAxisBlock` TypeScript interface includes `displaySize?` field
- [ ] Default factory creates blocks with `displaySize: 'full'`

---

## Step 2: Add Display Size Selector to Admin AxisEditor

**Spec refs**: Requirement 1 (Size Configuration), Requirement 5 (End-User Presentation — save alongside content)

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (MODIFIED — add displaySize dropdown)

**Exact Behavior**:

1. Add a "Display Size" section at the top of the AxisEditor, BEFORE the "Prompt" section. This is a block-level setting, not an axis-spec-level setting, so it updates `block.displaySize` directly (not `block.axis`).

2. Render a `<select>` with options:
   - Small (33%) — value `'small'`
   - Medium (50%) — value `'medium'`
   - Large (75%) — value `'large'`
   - Full Width (100%) — value `'full'` (default)

3. On change, call `onChange({ ...block, displaySize: selectedValue })`.

4. Use the existing `panel-field` and `panel-field-select` CSS classes from the AxisConfigPanel pattern for consistent styling.

**Tests that FAIL before, PASS after**:
- Test file: `tests/unit/ui/axis-editor-display-size.test.ts` (NEW)
- Test 1: "AxisEditor renders display size selector with current value" — render AxisEditor with a block that has `displaySize: 'medium'`, verify a select element exists with value 'medium'
- Test 2: "AxisEditor calls onChange with updated displaySize when selector changes" — simulate selecting 'small', verify onChange was called with `{ ...block, displaySize: 'small' }`
- Test 3: "AxisEditor defaults display size to 'full' when not set" — render AxisEditor with block without displaySize, verify select shows 'full'
- **Run**: `pnpm vitest run tests/unit/ui/axis-editor-display-size.test.ts`

**Acceptance Criteria**:
- [ ] Admin AxisEditor shows a "Display Size" dropdown
- [ ] Changing the dropdown calls onChange with the new displaySize value
- [ ] Default selection is "Full Width" when no displaySize is set
- [ ] The displaySize value persists after save and reload (tested manually — it's stored in the JSON content)

---

## Step 3: Update Student-Facing AxisRenderer to Use `displaySize`

**Spec refs**: Requirement 3 (Proportional Scaling), Requirement 5 (End-User Presentation)

**Files to Touch**:
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED)
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — lines 331-336, pass displaySize)

**Exact Behavior**:

1. **AxisRenderer** — Add a `displaySize` prop (optional, defaults to `'full'`). Create a constant mapping:
   ```
   const SIZE_MAP = { small: '33%', medium: '50%', large: '75%', full: '100%' } as const
   ```
   
2. Instead of hardcoding `width={600}` and `height={400}`, use a responsive approach:
   - Use a ResizeObserver (or `useRef` + `useEffect`) to measure the container's actual width
   - Apply the percentage from SIZE_MAP to determine the actual pixel width
   - Calculate height proportionally: `height = measuredWidth * (2/3)` (maintaining 3:2 aspect ratio from original 600x400)
   - Pass computed pixel values to JSXGraphBoard

3. **Simpler approach** (preferred for reliability with JSXGraph which needs pixel values):
   - Wrap JSXGraphBoard in a container `<div>` with `style={{ width: SIZE_MAP[displaySize] }}` and `className="mx-auto"`
   - Keep JSXGraphBoard at `width={600}` `height={400}` but add `style={{ maxWidth: '100%', height: 'auto', aspectRatio: '3/2' }}` via the existing `className` prop
   - Actually: JSXGraph requires explicit pixel width/height for proper rendering. Use a `useRef` + `ResizeObserver` on a wrapper div to measure actual available width, then pass `width={Math.min(600, measuredWidth)}` and `height={Math.min(600, measuredWidth) * 2/3}` to JSXGraphBoard.

4. **ExerciseRenderer** — At lines 331-336, extract `displaySize` from the block and pass it to AxisRenderer:
   ```tsx
   const axisBlock = b as ContentBlock & { axis?: AxisSpecV1; displaySize?: string }
   <AxisRenderer blockId={b.id} spec={axisBlock.axis as AxisSpecV1} displaySize={axisBlock.displaySize as 'small' | 'medium' | 'large' | 'full' | undefined} />
   ```

**Tests that FAIL before, PASS after**:
- Test file: `tests/unit/ui/axis-renderer-display-size.test.ts` (NEW)
- Test 1: "AxisRenderer container applies correct width percentage for 'small'" — render with displaySize='small', verify wrapper div has `width: 33%` style
- Test 2: "AxisRenderer defaults to full width when displaySize is undefined" — render without displaySize, verify wrapper div has `width: 100%`
- Test 3: "AxisRenderer maintains aspect ratio at different sizes" — verify the computed height maintains 3:2 ratio relative to width
- **Run**: `pnpm vitest run tests/unit/ui/axis-renderer-display-size.test.ts`

**Acceptance Criteria**:
- [ ] AxisRenderer renders at the correct width percentage for each size option
- [ ] Graph maintains 3:2 aspect ratio regardless of selected size
- [ ] Default behavior (no displaySize) renders at full width (backward compatible)
- [ ] JSXGraphBoard receives proper pixel dimensions

---

## Step 4: Support Side-by-Side Layout (Text + Graph)

**Spec refs**: Requirement 4 (Layout Interaction — Text & Graph)

**Files to Touch**:
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — lines 318-337)

**Exact Behavior**:

The exercise content uses a flat block stream. To support side-by-side layout: when a `question_axis` block with `displaySize` != 'full' is followed by (or preceded by) a `rich_text` block, they should be grouped into a flex row where:
- The graph takes the configured percentage width
- The text fills the remaining space

Implementation approach:
1. In the block rendering loop (line 321), detect when a `question_axis` block with a non-'full' displaySize is adjacent to a `rich_text` block.
2. Group them into a `<div className="flex gap-4 items-start">` container where:
   - The axis block wrapper gets `style={{ width: SIZE_MAP[displaySize] }}` with `flex-shrink: 0`
   - The rich_text block wrapper gets `className="flex-1 min-w-0"`
3. The grouping logic: look ahead one block — if the current block is `question_axis` with displaySize != 'full' AND the next block is `rich_text`, render them together and skip the next block in the iteration.

**Tests that FAIL before, PASS after**:
- Test file: `tests/unit/ui/exercise-renderer-side-by-side.test.ts` (NEW)
- Test 1: "renders axis + rich_text side-by-side when displaySize is not full" — provide content with [question_axis(displaySize='medium'), rich_text], verify they share a flex container
- Test 2: "renders axis at full width without side-by-side when displaySize is 'full'" — provide content with [question_axis(displaySize='full'), rich_text], verify they render as separate blocks (no flex row)
- Test 3: "text fills remaining space in side-by-side layout" — verify the text wrapper has `flex-1` class
- **Run**: `pnpm vitest run tests/unit/ui/exercise-renderer-side-by-side.test.ts`

**Acceptance Criteria**:
- [ ] Non-full-width axis blocks paired with adjacent rich_text render side-by-side
- [ ] Text dynamically fills remaining width (flex-1)
- [ ] Full-width axis blocks render normally (no side-by-side)
- [ ] Axis blocks without adjacent text blocks still render correctly

---

## Step 5: Integration Test — Full Round-Trip

**Spec refs**: All acceptance criteria (AC-1 through AC-6)

**Files to Touch**:
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` (MODIFIED — add test cases)

**Exact Behavior**:

Add new test cases to the existing integration test file:

1. "question_axis block with displaySize validates through ContentSchema" — Create a full exercise content JSON with a question_axis block that has `displaySize: 'medium'`, validate it passes ContentSchema.parse()
2. "question_axis block without displaySize still validates (backward compat)" — Existing question_axis data (no displaySize field) still parses correctly
3. "question_axis block with all displaySize values validates" — Loop through ['small', 'medium', 'large', 'full'] and verify all parse correctly

**Tests**:
- Test location: `tests/int/contracts/exercise-content-blocks.int.spec.ts`
- **Run**: `pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts`

**Acceptance Criteria**:
- [ ] Full exercise content with displaySize validates through ContentSchema
- [ ] Backward compatibility — existing data without displaySize still works
- [ ] All predefined size values are accepted by the schema

---

## Summary

| Step | Files Changed | Est. Time | Key Test |
|------|--------------|-----------|----------|
| 1    | schemas.ts, types.ts, defaults.ts | 15 min | Schema validates displaySize values |
| 2    | AxisEditor.tsx | 15 min | Admin editor shows size selector |
| 3    | AxisRenderer/index.tsx, ExerciseRenderer/index.tsx | 20 min | Student view respects displaySize |
| 4    | ExerciseRenderer/index.tsx | 20 min | Side-by-side layout works |
| 5    | exercise-content-blocks.int.spec.ts | 10 min | Full round-trip validation |

**Total estimated time**: ~80 minutes

**Quality gates**: `pnpm vitest run` (all new + existing tests), `pnpm tsc --noEmit` (type safety)
