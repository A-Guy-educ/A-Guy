# Plan: 260313-auto-354 — Multi-Graph Support in Exercises

## Rerun Context

Previous run was requested via `/cody rerun` with no specific issue details. This plan is freshly created from the spec and full codebase exploration. The approach: add a new `question_multi_axis` block type to the exercise content schema, corresponding TypeScript types, a new `MultiAxisRenderer` React component, and integrate it into the `ExerciseRenderer`.

## Research Findings

### File paths verified
- ✅ `src/server/payload/collections/Exercises/schemas.ts` — Zod schemas, `ContentBlockSchema` discriminated union (line 525)
- ✅ `src/server/payload/collections/Exercises/types.ts` — TypeScript interfaces, `ContentBlock` union (line 256)
- ✅ `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` — Main renderer with block dispatch (line 316-523)
- ✅ `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Single axis renderer (57 lines)
- ✅ `src/ui/web/exerciserenderer/types.ts` — Renderer-specific types, `ContentBlock` union (line 166)
- ✅ `src/ui/web/shared/Layout/Grid.tsx` — Reusable responsive Grid component with CVA
- ✅ `src/infra/contracts/graphics/axis.v1.ts` — `AxisSpecV1Schema` Zod schema
- ✅ `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Schema validation tests (354 lines)
- 🆕 `src/ui/web/exerciserenderer/blocks/MultiAxisRenderer/index.tsx` — Will create
- 🆕 `tests/int/contracts/exercise-multi-axis-block.int.spec.ts` — Will create
- 🆕 `tests/unit/ui/multi-axis-renderer.test.tsx` — Will create

### Patterns observed
- Block schemas follow: `z.object({ id, type: z.literal('...'), ... }).strict()` pattern
- Each block type has a matching TypeScript interface in `types.ts`
- `ContentBlockSchema` is a `z.discriminatedUnion('type', [...])` — adding a new member is safe
- `ExerciseRenderer` dispatches block types with `if (b.type === ('question_axis' as string))` pattern (type cast needed because geometry/axis types aren't in the renderer's `ContentBlock` union)
- AxisRenderer takes `{ blockId: string; spec: AxisSpecV1 }` — simple, reusable
- Grid component from `src/ui/web/shared/Layout/Grid.tsx` supports responsive cols via `ResponsiveCols` object
- Test file `exercise-content-blocks.int.spec.ts` validates schemas with `ContentBlockSchema.parse()` pattern

### Integration points
- Must add `QuestionMultiAxisBlockSchema` to `ContentBlockSchema` union at line 525 of `schemas.ts`
- Must add `QuestionMultiAxisBlock` interface to `ContentBlock` union at line 256 of `types.ts`
- Must add `question_multi_axis` dispatch case in `ExerciseRenderer/index.tsx` around line 328
- Must import `MultiAxisRenderer` in `ExerciseRenderer/index.tsx`

## Reuse Inventory

### Existing utilities/functions the plan will reuse
- `AxisRenderer` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/` — renders individual graphs
- `AxisSpecV1Schema` from `src/infra/contracts/graphics/axis.v1` — Zod schema for axis spec data
- `AxisSpecV1` type from `@/infra/contracts` — TypeScript type for axis spec
- `InlineRichTextSchema` from `src/server/payload/collections/Exercises/schemas.ts` — for prompt/text field
- `InlineRichText` from `src/server/payload/collections/Exercises/types.ts` — prompt type
- `RichTextRenderer` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/` — renders explanatory text
- `cn` from `@/infra/utils/ui` — Tailwind class merging utility
- `ContentBlockSchema.parse()` in tests — existing validation test pattern

### Justification for NEW artifacts
- `QuestionMultiAxisBlockSchema` — NEW Zod schema because no existing block supports an array of multiple axis specs with labels, ordering, and text positioning
- `QuestionMultiAxisBlock` interface — NEW TypeScript type mirroring the new schema
- `MultiAxisRenderer` component — NEW component because existing `AxisRenderer` renders a single graph; multi-graph needs responsive grid layout, labels, and text positioning logic
- `MultiAxisGraphItem` sub-interface — NEW nested type for individual graph entries (id, label, axis, order)

---

## Steps

### Step 1: Add Zod schema for `question_multi_axis` block type

**Files to touch:**
- `src/server/payload/collections/Exercises/schemas.ts` (MODIFIED — lines 414-428 insert after, lines 525-537 add to union)

**Behavior:**
Create `MultiAxisGraphItemSchema` and `QuestionMultiAxisBlockSchema`:
- `MultiAxisGraphItemSchema`: `{ id: string, label: string, axis: AxisSpecV1Schema, order: number }`
- `QuestionMultiAxisBlockSchema`: `{ id: string, type: 'question_multi_axis', prompt: InlineRichTextSchema.optional(), textPosition: z.enum(['above', 'below']).default('above'), graphs: z.array(MultiAxisGraphItemSchema).min(1).max(4) }` with `.strict()`
- Add `superRefine` to validate unique graph IDs within the array
- Add `QuestionMultiAxisBlockSchema` to the `ContentBlockSchema` discriminated union array

**Spec refs:** FR-001 (up to 4 graphs), FR-002 (label field), FR-003 (textPosition), FR-007 (order field), FR-008 (saved data)

**Tests (FAIL before, PASS after):**
- File: `tests/int/contracts/exercise-multi-axis-block.int.spec.ts`
- Test 1: `ContentBlockSchema.parse()` with valid `question_multi_axis` block containing 2 graphs → PASSES
- Test 2: `ContentBlockSchema.parse()` with 5 graphs → THROWS (max 4)
- Test 3: `ContentBlockSchema.parse()` with 0 graphs → THROWS (min 1)
- Test 4: `ContentBlockSchema.parse()` with duplicate graph IDs → THROWS
- Test 5: `ContentBlockSchema.parse()` with missing label → THROWS
- Test 6: `ContentBlockSchema.parse()` with textPosition='below' → PASSES
- Test 7: `ContentBlockSchema.parse()` with single graph (no prompt) → PASSES
- Test 8: Existing `question_axis` block still validates → PASSES (no breaking change)

**Acceptance criteria:**
- [ ] `QuestionMultiAxisBlockSchema` exported from schemas.ts
- [ ] Schema enforces min 1, max 4 graphs
- [ ] Schema validates graph id uniqueness
- [ ] Schema includes label (string), axis (AxisSpecV1), order (number) per graph
- [ ] Schema includes optional prompt (InlineRichText) and textPosition enum
- [ ] Added to `ContentBlockSchema` discriminated union
- [ ] All 8 schema tests pass
- [ ] Existing `question_axis` tests still pass (non-breaking)

**Run:** `pnpm vitest run tests/int/contracts/exercise-multi-axis-block.int.spec.ts`

---

### Step 2: Add TypeScript interface for `QuestionMultiAxisBlock`

**Files to touch:**
- `src/server/payload/collections/Exercises/types.ts` (MODIFIED — insert after line 233, update union at line 256-268)

**Behavior:**
Add:
```
interface MultiAxisGraphItem {
  id: string
  label: string
  axis: AxisSpecV1
  order: number
}

interface QuestionMultiAxisBlock {
  id: string
  type: 'question_multi_axis'
  prompt?: InlineRichText
  textPosition: 'above' | 'below'
  graphs: MultiAxisGraphItem[]
}
```
- Add `QuestionMultiAxisBlock` to the `ContentBlock` union type
- Export both interfaces

**Spec refs:** FR-001, FR-002, FR-003, FR-007

**Tests (FAIL before, PASS after):**
- File: `tests/unit/types/multi-axis-types.test.ts`
- Test 1: Type assertion test — a valid `QuestionMultiAxisBlock` object satisfies the type (compile-time check via `satisfies`)
- Test 2: Verify `QuestionMultiAxisBlock` is in `ContentBlock` union — create a `ContentBlock` variable with `type: 'question_multi_axis'` and assert it compiles

**Acceptance criteria:**
- [ ] `MultiAxisGraphItem` interface exported
- [ ] `QuestionMultiAxisBlock` interface exported
- [ ] `QuestionMultiAxisBlock` is a member of `ContentBlock` union
- [ ] TypeScript compiles with `pnpm tsc --noEmit`

**Run:** `pnpm tsc --noEmit`

---

### Step 3: Create `MultiAxisRenderer` component

**Files to touch:**
- `src/ui/web/exerciserenderer/blocks/MultiAxisRenderer/index.tsx` (NEW)

**Behavior:**
Create a `'use client'` React component `MultiAxisRenderer` with props:
```
interface MultiAxisRendererProps {
  blockId: string
  graphs: Array<{ id: string; label: string; axis: AxisSpecV1; order: number }>
  prompt?: { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds?: string[] }
  textPosition: 'above' | 'below'
}
```

Component logic:
1. Sort `graphs` by `order` field (ascending)
2. If `prompt` exists and `textPosition === 'above'`, render `RichTextRenderer` above the grid
3. Render a responsive grid container:
   - 1 graph: `grid-cols-1` (full width) — FR-006
   - 2 graphs: `grid-cols-1 sm:grid-cols-2` — FR-004/FR-005
   - 3 graphs: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — FR-004/FR-005
   - 4 graphs: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — FR-004/FR-005
4. Each grid item: render graph label as `<h4>` above the `AxisRenderer` component
5. If `prompt` exists and `textPosition === 'below'`, render `RichTextRenderer` below the grid

Key implementation details:
- Use `cn()` for conditional Tailwind classes
- Reuse `AxisRenderer` for each individual graph — pass `blockId={graph.id}` and `spec={graph.axis}`
- Use Tailwind `gap-4` between grid items
- Each graph label should be centered above its graph: `<p className="text-center text-sm font-medium text-muted-foreground mb-2">`

**Spec refs:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008

**Tests (FAIL before, PASS after):**
- File: `tests/unit/ui/multi-axis-renderer.test.tsx`
- Test 1: Renders correct number of AxisRenderer instances (mock AxisRenderer, assert 3 rendered for 3 graphs)
- Test 2: Renders graphs sorted by order (graph with order=2 appears before order=3)
- Test 3: Renders labels for each graph (assert "גרף 1" and "גרף 2" visible)
- Test 4: Renders prompt text above graphs when `textPosition='above'`
- Test 5: Renders prompt text below graphs when `textPosition='below'`
- Test 6: Single graph gets full-width class (`grid-cols-1`)
- Test 7: Four graphs get responsive grid classes (`sm:grid-cols-2 lg:grid-cols-4`)

**Acceptance criteria:**
- [ ] Component renders correct number of graphs
- [ ] Graphs sorted by order field
- [ ] Each graph has its label rendered
- [ ] Prompt text positioned correctly (above/below)
- [ ] Responsive grid classes applied correctly per graph count
- [ ] Single graph occupies full width
- [ ] Component reuses existing AxisRenderer

**Run:** `pnpm vitest run tests/unit/ui/multi-axis-renderer.test.tsx`

---

### Step 4: Integrate `MultiAxisRenderer` into `ExerciseRenderer`

**Files to touch:**
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — import at top, add dispatch ~line 328)

**Behavior:**
1. In `ExerciseRenderer/index.tsx`:
   - Add import: `import { MultiAxisRenderer } from '../blocks/MultiAxisRenderer'`
   - Add type import for the multi-axis block type
   - Add dispatch case after `question_axis` block (around line 333):
     ```
     if (b.type === ('question_multi_axis' as string)) {
       return (
         <div key={b.id}>
           <MultiAxisRenderer
             blockId={b.id}
             graphs={(b as any).graphs}
             prompt={(b as any).prompt}
             textPosition={(b as any).textPosition ?? 'above'}
           />
         </div>
       )
     }
     ```
   - Note: follows same cast pattern as `question_axis` and `question_geometry` blocks (line 320-334)

2. In `exerciserenderer/types.ts`:
   - No changes needed — the renderer types use type assertions for geometry/axis blocks (they aren't in the renderer's `ContentBlock` union either). The same pattern applies to `question_multi_axis`.

**Spec refs:** FR-008 (end-user presentation)

**Tests (FAIL before, PASS after):**
- File: `tests/unit/ui/exercise-renderer-multi-axis.test.tsx`
- Test 1: `ExerciseRenderer` renders `MultiAxisRenderer` when content contains a `question_multi_axis` block
- Test 2: `ExerciseRenderer` still renders `AxisRenderer` for regular `question_axis` blocks (non-breaking)
- Test 3: `ExerciseRenderer` renders mixed content (rich_text + question_multi_axis + question_select) without errors

**Acceptance criteria:**
- [ ] `MultiAxisRenderer` is imported and dispatched in ExerciseRenderer
- [ ] `question_multi_axis` blocks render correctly in the exercise view
- [ ] Existing `question_axis` blocks still render correctly
- [ ] Mixed content blocks render without errors
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

**Run:** `pnpm vitest run tests/unit/ui/exercise-renderer-multi-axis.test.tsx`

---

### Step 5: Full integration test and quality gates

**Files to touch:**
- No new files — runs existing + new tests together

**Behavior:**
1. Run all exercise-related tests to ensure no regressions
2. Run TypeScript type check
3. Run lint check

**Spec refs:** All FRs (regression check)

**Tests:**
- `pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts` — existing tests pass
- `pnpm vitest run tests/int/contracts/exercise-multi-axis-block.int.spec.ts` — new schema tests pass
- `pnpm vitest run tests/unit/ui/multi-axis-renderer.test.tsx` — component tests pass
- `pnpm vitest run tests/unit/ui/exercise-renderer-multi-axis.test.tsx` — integration tests pass
- `pnpm tsc --noEmit` — no type errors
- `pnpm lint` — no lint errors

**Acceptance criteria:**
- [ ] All existing exercise schema tests still pass (no regressions)
- [ ] All new multi-axis tests pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] AC from spec: Admins can add up to 4 graph coordinate systems in a single block
- [ ] AC from spec: Each graph gets a default label which can be edited (data model supports it)
- [ ] AC from spec: Graphs render side-by-side on desktop at equal widths
- [ ] AC from spec: Mobile wraps to max 2-per-row grid
- [ ] AC from spec: Single graph is full width
- [ ] AC from spec: Authors can define graph order (order field)
- [ ] AC from spec: Text positioning above/below
- [ ] AC from spec: Config saved and presented to end users

**Run:** `pnpm vitest run tests/int/contracts/ tests/unit/ui/ && pnpm tsc --noEmit && pnpm lint`
