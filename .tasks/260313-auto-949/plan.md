# Plan: 260313-auto-949 — Graph Layout Control

## Rerun Context

This is a rerun requested via `/cody rerun`. The previous plan/implementation is being re-done from scratch. The rerun feedback was generic ("Rerun requested via /cody rerun") with no specific code issues mentioned. The approach from spec.md remains correct: add a layout field to graph blocks and update admin + frontend renderers. The clarified.md confirms there should be a minimum width threshold for side-by-side layouts on mobile.

## Research Findings

- `src/server/payload/collections/Exercises/schemas.ts` ✅ exists — Lines 401-412 (QuestionGeometryBlockSchema), Lines 417-428 (QuestionAxisBlockSchema)
- `src/server/payload/collections/Exercises/types.ts` ✅ exists — Lines 210-219 (QuestionGeometryBlock), Lines 224-233 (QuestionAxisBlock)
- `src/server/payload/collections/Exercises/defaults.ts` ✅ exists — Lines 298-324 (question_geometry factory), Lines 326-347 (question_axis factory)
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` ✅ exists — 126 lines, renders Prompt + graph editor side-by-side
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` ✅ exists — 178 lines, renders Prompt + graph editor side-by-side
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` ✅ exists — 49 lines, renders ONLY JSXGraphBoard (no prompt)
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` ✅ exists — 57 lines, renders ONLY JSXGraphBoard (no prompt)
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` ✅ exists — Lines 324-337 render geometry/axis WITHOUT prompt
- `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` ✅ exists — Used for rendering markdown+math blocks
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` ✅ exists — Has existing geometry/axis schema tests
- `src/ui/web/exerciserenderer/types.ts` ✅ exists — Exercise renderer type definitions
- `src/ui/admin/shared/CollapsibleSection.tsx` ✅ exists — Reusable collapsible panel
- `src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx` 🆕 will create — Shared layout wrapper component
- `tests/unit/collections/graph-layout.test.ts` 🆕 will create — Schema validation tests for layout field

**Patterns observed:**
- Zod schemas in schemas.ts use `.strict()` — any new field MUST be added to the schema object
- TypeScript interfaces in types.ts are manually kept in sync with Zod schemas
- Factory functions in defaults.ts produce complete block structures
- Admin editors use CSS classes like `question-editor-section`, `question-editor-label`, `graph-editor-layout`
- Frontend renderers use Tailwind utility classes
- Existing test file `exercise-content-blocks.int.spec.ts` uses `ContentBlockSchema.parse()` for validation

## Reuse Inventory

### Existing utilities/functions the plan will reuse:
- `RichTextRenderer` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/` — renders prompt markdown+math
- `GeometryRenderer` from `src/ui/web/exerciserenderer/blocks/GeometryRenderer/` — renders geometry JSXGraph
- `AxisRenderer` from `src/ui/web/exerciserenderer/blocks/AxisRenderer/` — renders axis JSXGraph
- `cn()` from `src/infra/utils/ui` — Tailwind class merging utility
- `CollapsibleSection` from `src/ui/admin/shared/CollapsibleSection` — admin panel collapsible
- `InlineRichTextEditor` from `src/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor` — admin prompt editing
- `ContentBlockSchema` from `src/server/payload/collections/Exercises/schemas` — for test validation

### Justification for NEW items:
- `GraphWithPrompt` component (NEW) — No existing component combines a graph renderer + prompt text with configurable layout. This is new presentation logic that doesn't exist anywhere in the codebase.
- `GraphLayoutType` type (NEW) — No existing layout enum type exists for graph blocks. Added to types.ts as a shared type alias.

---

## Step 1: Add Layout Field to Schemas and Types (10 min)

**Spec refs**: FR-001 (Layout Configurations), FR-002 (Default State)

**Files to touch**:
- `src/server/payload/collections/Exercises/schemas.ts` (MODIFIED — lines 401-412, 417-428)
- `src/server/payload/collections/Exercises/types.ts` (MODIFIED — lines 210-219, 224-233)

**Behavior**:
1. In `schemas.ts`, define a shared Zod enum for graph layout:
   ```
   const GraphLayoutSchema = z.enum(['textAbove', 'textBelow', 'textLeft', 'textRight']).default('textRight')
   ```
2. Add `layout: GraphLayoutSchema` to `QuestionGeometryBlockSchema` (after `prompt`, before `geometry`)
3. Add `layout: GraphLayoutSchema` to `QuestionAxisBlockSchema` (after `prompt`, before `axis`)
4. In `types.ts`, define a shared type alias:
   ```
   export type GraphLayout = 'textAbove' | 'textBelow' | 'textLeft' | 'textRight'
   ```
5. Add `layout?: GraphLayout` to the `QuestionGeometryBlock` interface (optional for backward compat — schema default handles missing)
6. Add `layout?: GraphLayout` to the `QuestionAxisBlock` interface

**IMPORTANT**: The field is optional in the TypeScript interface (for backward compatibility with existing data that doesn't have it) but the Zod schema provides `.default('textRight')` so parsed data will always have a value.

**Tests** (FAIL before, PASS after):

Test file: `tests/unit/collections/graph-layout.test.ts` (NEW)

```
Test 1: "QuestionGeometryBlockSchema accepts block with layout field"
  - Input: valid geometry block with `layout: 'textLeft'`
  - Assert: ContentBlockSchema.parse() succeeds and output.layout === 'textLeft'
  - Fails before: .strict() rejects unknown `layout` field

Test 2: "QuestionAxisBlockSchema accepts block with layout field"
  - Input: valid axis block with `layout: 'textAbove'`
  - Assert: ContentBlockSchema.parse() succeeds and output.layout === 'textAbove'
  - Fails before: .strict() rejects unknown `layout` field

Test 3: "QuestionGeometryBlockSchema defaults layout to textRight when omitted"
  - Input: valid geometry block WITHOUT layout field
  - Assert: ContentBlockSchema.parse() succeeds and output.layout === 'textRight'
  - Fails before: no layout field in schema

Test 4: "QuestionAxisBlockSchema defaults layout to textRight when omitted"
  - Input: valid axis block WITHOUT layout field
  - Assert: ContentBlockSchema.parse() succeeds and output.layout === 'textRight'
  - Fails before: no layout field in schema

Test 5: "QuestionGeometryBlockSchema rejects invalid layout value"
  - Input: geometry block with `layout: 'invalidValue'`
  - Assert: ContentBlockSchema.parse() throws
  - Fails before: no layout field in schema (passes vacuously; after change, validates enum)
```

**Run**: `pnpm vitest run tests/unit/collections/graph-layout.test.ts`

**Acceptance criteria**:
- [ ] `layout` field accepted in both geometry and axis Zod schemas
- [ ] Default value `textRight` is applied when `layout` is omitted
- [ ] Invalid layout values are rejected
- [ ] TypeScript interfaces have `layout?: GraphLayout` property
- [ ] Existing tests in `exercise-content-blocks.int.spec.ts` still pass (backward compat)

---

## Step 2: Update Default Block Factories (5 min)

**Spec refs**: FR-002 (Default State — "Text right, Graph left" default for new graphs)

**Files to touch**:
- `src/server/payload/collections/Exercises/defaults.ts` (MODIFIED — lines 298-324, 326-347)

**Behavior**:
1. Add `layout: 'textRight' as const` to the `question_geometry` factory function return object (after `prompt`, before `geometry`)
2. Add `layout: 'textRight' as const` to the `question_axis` factory function return object (after `prompt`, before `axis`)

**Tests** (FAIL before, PASS after):

Test file: `tests/unit/collections/graph-layout.test.ts` (MODIFIED — add to existing file from Step 1)

```
Test 6: "question_geometry factory creates block with layout textRight"
  - Import ExerciseBlockDefaults from defaults.ts
  - Call ExerciseBlockDefaults['question_geometry']()
  - Assert: result.layout === 'textRight'
  - Fails before: result.layout is undefined

Test 7: "question_axis factory creates block with layout textRight"
  - Call ExerciseBlockDefaults['question_axis']()
  - Assert: result.layout === 'textRight'
  - Fails before: result.layout is undefined
```

**Run**: `pnpm vitest run tests/unit/collections/graph-layout.test.ts`

**Acceptance criteria**:
- [ ] New geometry blocks created via factory have `layout: 'textRight'`
- [ ] New axis blocks created via factory have `layout: 'textRight'`

---

## Step 3: Add Layout Selector to Admin Editors (20 min)

**Spec refs**: FR-003 (Admin UI Layout Selector)

**Files to touch**:
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (MODIFIED — add layout selector after Prompt section, before graph-editor-layout div)
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` (MODIFIED — add layout selector after Prompt section, before graph-editor-layout div)

**Behavior**:
1. In both editors, add a layout selector section between the Prompt editor and the graph-editor-layout. The selector should:
   - Display a label "Layout"
   - Show 4 radio buttons or a select dropdown with the options:
     - `textAbove` — "Text Above, Graph Below"
     - `textBelow` — "Text Below, Graph Above"
     - `textLeft` — "Text Left, Graph Right"
     - `textRight` — "Text Right, Graph Left" (default/selected)
   - Use radio-button style (inline horizontal row) matching admin editor aesthetics (use existing CSS classes like `question-editor-section`, `question-editor-label`)
   - On change, call `onChange({ ...block, layout: selectedValue })`
2. Read the current layout from `block.layout || 'textRight'` (fallback for existing blocks without the field)

**Implementation pattern**: Use a simple `<select>` element styled with existing admin CSS patterns. The admin editors already use simple HTML form elements (not shadcn/ui components). Follow the same pattern as existing config panels (e.g., AxisConfigPanel uses native select/input elements).

**Tests** (FAIL before, PASS after):

Test file: `tests/unit/collections/graph-layout.test.ts` (MODIFIED — add to existing file)

```
Test 8: "AxisEditor calls onChange with updated layout when layout changes"
  - Render AxisEditor with a block that has layout 'textRight'
  - Simulate changing layout to 'textLeft'
  - Assert: onChange was called with block.layout === 'textLeft'
  - Fails before: no layout selector rendered

Test 9: "GeometryEditor calls onChange with updated layout when layout changes"
  - Render GeometryEditor with a block that has layout 'textRight'
  - Simulate changing layout to 'textAbove'
  - Assert: onChange was called with block.layout === 'textAbove'
  - Fails before: no layout selector rendered
```

**Note on test feasibility**: These are React component tests. Since the admin editors depend on many complex child components (JSXGraph canvas, etc.), these tests may need mocking. If component tests prove too complex, the build agent should use a simpler approach: test the onChange callback logic in isolation, or skip component tests and rely on E2E coverage. The schema tests from Steps 1-2 are the primary contract tests.

**Run**: `pnpm vitest run tests/unit/collections/graph-layout.test.ts`

**Acceptance criteria**:
- [ ] AxisEditor shows a layout selector with 4 options
- [ ] GeometryEditor shows a layout selector with 4 options
- [ ] Changing layout calls onChange with updated block
- [ ] Default selected value is 'textRight' for new blocks
- [ ] Existing blocks without layout field show 'textRight' as selected

---

## Step 4: Create GraphWithPrompt Layout Wrapper Component (20 min)

**Spec refs**: FR-004 (End-User Presentation), FR-005 (Strict Mobile Layout)

**Files to touch**:
- `src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx` (NEW)

**Behavior**:
Create a shared layout wrapper component that takes:
- `layout`: `'textAbove' | 'textBelow' | 'textLeft' | 'textRight'` (default: `'textRight'`)
- `prompt`: The InlineRichText data to render as a RichTextRenderer
- `children`: The graph renderer (GeometryRenderer or AxisRenderer)
- `blockId`: string for unique key generation

Layout logic using Tailwind CSS:
- `textAbove`: `flex flex-col` — prompt first, then graph
- `textBelow`: `flex flex-col` — graph first, then prompt
- `textLeft`: `flex flex-row` — prompt first (left), then graph (right)
- `textRight`: `flex flex-row` — graph first (left), then prompt (right)

**CRITICAL for FR-005 (strict mobile enforcement)**:
- For side-by-side layouts (`textLeft`, `textRight`): Do NOT use responsive breakpoint classes like `md:flex-row flex-col`. Instead, ALWAYS use `flex flex-row` so it never stacks.
- Apply `min-w-0` on children to allow flex shrinking
- Apply a minimum width threshold on the graph container (e.g., `min-w-[280px]`) per clarified.md — this ensures the graph doesn't get too small
- Both the prompt and graph containers should use `flex-1` for equal space allocation in side-by-side mode
- Add `gap-4` for spacing between prompt and graph

**Prompt rendering**: Convert InlineRichText to RichTextBlock format (add synthetic `id`) and render via `RichTextRenderer`, wrapped in prose styles matching existing content block rendering:
```
<div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
  <RichTextRenderer block={promptBlock} />
</div>
```

**Tests** (FAIL before, PASS after):

Test file: `tests/unit/ui/graph-with-prompt.test.tsx` (NEW)

```
Test 10: "renders prompt above graph for textAbove layout"
  - Render GraphWithPrompt with layout='textAbove', a prompt, and a graph child
  - Assert: container has flex-col class
  - Assert: prompt element comes before graph child in DOM order

Test 11: "renders prompt below graph for textBelow layout"
  - Render GraphWithPrompt with layout='textBelow', a prompt, and a graph child
  - Assert: container has flex-col class
  - Assert: graph child comes before prompt element in DOM order

Test 12: "renders prompt left of graph for textLeft layout"
  - Render GraphWithPrompt with layout='textLeft'
  - Assert: container has flex-row class (NOT flex-col)
  - Assert: prompt element comes before graph child in DOM order

Test 13: "renders prompt right of graph for textRight layout"
  - Render GraphWithPrompt with layout='textRight'
  - Assert: container has flex-row class (NOT flex-col)
  - Assert: graph child comes before prompt element in DOM order (graph first = left)

Test 14: "defaults to textRight when no layout provided"
  - Render GraphWithPrompt without layout prop
  - Assert: container has flex-row class

Test 15: "side-by-side layouts do NOT use responsive stacking classes"
  - Render GraphWithPrompt with layout='textLeft'
  - Assert: container className does NOT contain 'md:' or 'lg:' or 'sm:' prefixed flex-direction classes
  - This validates FR-005: no responsive breakpoints that could stack
```

**Run**: `pnpm vitest run tests/unit/ui/graph-with-prompt.test.tsx`

**Acceptance criteria**:
- [ ] Component renders prompt + graph in correct order for all 4 layouts
- [ ] Side-by-side layouts use `flex-row` without responsive breakpoints
- [ ] Vertical layouts use `flex-col`
- [ ] Minimum width threshold on graph container for side-by-side
- [ ] Prompt rendered with prose styling matching other content blocks

---

## Step 5: Wire Frontend Renderers to Use GraphWithPrompt (15 min)

**Spec refs**: FR-004 (End-User Presentation), FR-005 (Strict Mobile Layout)

**Files to touch**:
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — lines 322-337)
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` (MODIFIED — no structural change, keep as-is)
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED — no structural change, keep as-is)

**Behavior**:
1. In `ExerciseRenderer/index.tsx`, update the geometry/axis rendering block (lines 322-337):

   **Before** (current code):
   ```tsx
   if (b.type === ('question_geometry' as string)) {
     return (
       <div key={b.id}>
         <GeometryRenderer blockId={b.id} spec={b.geometry as GeometrySpecV1} />
       </div>
     )
   }
   ```

   **After** (updated):
   ```tsx
   if (b.type === ('question_geometry' as string)) {
     return (
       <GraphWithPrompt
         key={b.id}
         blockId={b.id}
         layout={(b as any).layout || 'textRight'}
         prompt={(b as any).prompt}
       >
         <GeometryRenderer blockId={b.id} spec={b.geometry as GeometrySpecV1} />
       </GraphWithPrompt>
     )
   }
   ```

   Apply the same pattern for `question_axis` block.

2. Import `GraphWithPrompt` at the top of ExerciseRenderer.
3. The `GeometryRenderer` and `AxisRenderer` components themselves remain unchanged — they still render only the JSXGraph board. The `GraphWithPrompt` wrapper handles the prompt rendering and layout.

**Note**: The existing code uses type casts (`b.type === ('question_geometry' as string)` and `b.geometry as GeometrySpecV1`) because these block types exist in the content data but aren't in the ExerciseRenderer's own type union. We follow the same pattern for `layout` and `prompt` access.

**Tests** (FAIL before, PASS after):

Test file: `tests/unit/ui/graph-with-prompt.test.tsx` (MODIFIED — add integration-style test)

```
Test 16: "ExerciseRenderer renders geometry block with prompt text"
  - Create content with a question_geometry block that has prompt text "Find angle ABC" and layout 'textRight'
  - Assert: rendered output contains the prompt text "Find angle ABC"
  - Fails before: prompt text is not rendered at all (current code only renders graph)

Test 17: "ExerciseRenderer renders axis block with prompt text"
  - Create content with a question_axis block that has prompt text "Plot the function" and layout 'textLeft'
  - Assert: rendered output contains the prompt text "Plot the function"
  - Fails before: prompt text is not rendered at all
```

**Note**: These tests may require mocking JSXGraph/dynamic imports since GeometryRenderer and AxisRenderer use `dynamic(() => import(...))`. The build agent should mock `next/dynamic` or the JSXGraphBoard component to avoid DOM issues in vitest. If full component tests are too complex, rely on the GraphWithPrompt unit tests from Step 4 and E2E tests.

**Run**: `pnpm vitest run tests/unit/ui/graph-with-prompt.test.tsx`

**Acceptance criteria**:
- [ ] Geometry blocks in ExerciseRenderer now show prompt text
- [ ] Axis blocks in ExerciseRenderer now show prompt text
- [ ] Layout configuration from block data is passed to GraphWithPrompt
- [ ] Fallback to 'textRight' layout when no layout field exists in data
- [ ] Existing non-graph blocks render unchanged (no regression)

---

## Step 6: Type Check, Lint, and Verify Backward Compatibility (10 min)

**Files to touch**: None (verification only)

**Behavior**:
1. Run `pnpm -s tsc --noEmit` — ensure no TypeScript errors
2. Run `pnpm -s lint` — ensure no lint errors
3. Run `pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts` — ensure existing geometry/axis tests still pass (backward compatibility: blocks without `layout` field should still parse with default)
4. Run `pnpm vitest run tests/unit/collections/graph-layout.test.ts` — all new tests pass
5. Run `pnpm vitest run tests/unit/ui/graph-with-prompt.test.tsx` — all UI tests pass

**Acceptance criteria**:
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `lint` passes with 0 errors
- [ ] All existing exercise content block tests pass
- [ ] All new graph-layout tests pass
- [ ] All new graph-with-prompt UI tests pass

---

## Summary of All Files Changed

| File | Status | Step |
|------|--------|------|
| `src/server/payload/collections/Exercises/schemas.ts` | MODIFIED | 1 |
| `src/server/payload/collections/Exercises/types.ts` | MODIFIED | 1 |
| `src/server/payload/collections/Exercises/defaults.ts` | MODIFIED | 2 |
| `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` | MODIFIED | 3 |
| `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` | MODIFIED | 3 |
| `src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx` | NEW | 4 |
| `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` | MODIFIED | 5 |
| `tests/unit/collections/graph-layout.test.ts` | NEW | 1, 2, 3 |
| `tests/unit/ui/graph-with-prompt.test.tsx` | NEW | 4, 5 |

## Test Commands

```bash
# Run all new tests
pnpm vitest run tests/unit/collections/graph-layout.test.ts tests/unit/ui/graph-with-prompt.test.tsx

# Verify backward compatibility
pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts

# Full quality gate
pnpm -s tsc --noEmit && pnpm -s lint
```
