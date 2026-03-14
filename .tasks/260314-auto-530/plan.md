# Plan: 260314-auto-530 — Add Display Size Control to Axis/Graph Block Editor

## Rerun Context

This is a rerun. The previous run timed out at the `fix` stage. The rerun feedback is minimal ("Rerun requested via /cody rerun"). The root issue: the graph display size feature (originally from task 260313-auto-475 on PR #813) was not present on the current fix branch because this branch diverged from `dev` without including the feature commit `4f94bf02`. The fix branch needs the `displaySize` field added to the Axis block schema, types, defaults, admin editor, and student-facing renderer.

## Research Findings

- `src/server/payload/collections/Exercises/schemas.ts` ✅ exists — `QuestionAxisBlockSchema` at line 417-428, uses `.strict()` so new fields must be added explicitly
- `src/server/payload/collections/Exercises/types.ts` ✅ exists — `QuestionAxisBlock` interface at line 224-233, no `displaySize` field
- `src/server/payload/collections/Exercises/defaults.ts` ✅ exists — `question_axis` default at line 325-347, no `displaySize`
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` ✅ exists — admin editor component, no display size dropdown
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` ✅ exists — renders axis with hardcoded 600x400
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` ✅ exists — renders question_axis blocks, line 331-336
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` ✅ exists — schema validation test pattern
- `tests/int/contracts/axis-spec.int.spec.ts` ✅ exists — axis spec test pattern
- Patterns observed: schemas use `.strict()` requiring explicit field additions; admin editors use `panel-field` CSS classes; AxisConfigPanel shows existing select/input pattern
- Integration points: schema → types → defaults → admin editor → student renderer

## Reuse Inventory

- **Existing utilities reused:**
  - `CollapsibleSection` from `@/ui/admin/shared/CollapsibleSection` — already used in AxisEditor
  - `panel-field`, `panel-field-label`, `panel-field-select` CSS classes — already used in AxisConfigPanel and other config panels
  - `ContentBlockSchema` from `@/server/payload/collections/Exercises/schemas` — for validation tests
- **No new utilities needed** — all existing patterns apply directly

---

## Step 1: Add `displaySize` to Schema, Types, and Defaults

**Root Cause**: The `QuestionAxisBlockSchema` uses `.strict()`, which rejects unknown properties. The `displaySize` field is not defined in the schema, type interface, or defaults, so even if it were set in the admin UI, it would be stripped/rejected on save.

**Files to Touch**:

- `src/server/payload/collections/Exercises/schemas.ts` (MODIFIED - lines 414-428) — Add `DisplaySizeSchema` and add `displaySize` field to `QuestionAxisBlockSchema`
- `src/server/payload/collections/Exercises/types.ts` (MODIFIED - lines 224-233) — Add `displaySize?: 'small' | 'medium' | 'large' | 'full'` to `QuestionAxisBlock` interface
- `src/server/payload/collections/Exercises/defaults.ts` (MODIFIED - line 343) — Add `displaySize: 'full'` to `question_axis` defaults

**Exact Behavior**:
- `DisplaySizeSchema` = `z.enum(['small', 'medium', 'large', 'full']).default('full').optional()`
- Added to `QuestionAxisBlockSchema` between `axis` and `answer` fields
- Type: `displaySize?: 'small' | 'medium' | 'large' | 'full'`
- Default: `'full'`

**Reproduction Test** (MUST FAIL before fix):

- Test location: `tests/unit/collections/exercise-display-size.test.ts`
- Test 1: `QuestionAxisBlockSchema.parse()` with a valid axis block that includes `displaySize: 'medium'` → currently FAILS because `.strict()` rejects `displaySize` as an unrecognized key
- Test 2: `QuestionAxisBlockSchema.parse()` with a valid axis block WITHOUT `displaySize` → currently PASSES (this is the baseline — ensures no regression)
- Test 3: `QuestionAxisBlockSchema.parse()` with `displaySize: 'invalid'` → should FAIL (validation)

**Fix**: Add `DisplaySizeSchema` to schemas.ts, add `displaySize` field to `QuestionAxisBlockSchema`, add type to interface, add default value.

**Verification**:
- Run `pnpm vitest run tests/unit/collections/exercise-display-size.test.ts` → Test 1 FAILS before, PASSES after
- Run `pnpm -s tsc --noEmit` → confirms type correctness

**Acceptance Criteria**:
- [ ] `displaySize` field accepted in QuestionAxisBlockSchema validation
- [ ] `displaySize` defaults to `'full'` when omitted
- [ ] Invalid values like `'invalid'` are rejected
- [ ] TypeScript interface includes `displaySize?` property
- [ ] Defaults include `displaySize: 'full'`

---

## Step 2: Add Display Size Dropdown to Admin AxisEditor

**Root Cause**: The AxisEditor component has no UI control for setting `displaySize`. Content authors cannot select the graph display width in the admin block editor.

**Files to Touch**:

- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (MODIFIED - lines 47-56) — Add a "Display Size" `<select>` dropdown above the Prompt section

**Exact Behavior**:
- A `<select>` dropdown with label "Display Size" using existing `panel-field` / `panel-field-select` CSS classes
- Options: `Small (33%)`, `Medium (50%)`, `Large (75%)`, `Full Width (100%)`
- Value reads from `block.displaySize || 'full'`
- On change, calls `onChange({ ...block, displaySize: e.target.value as DisplaySize })`
- Positioned as the first `question-editor-section` inside the axis-editor div, before the Prompt section

**Reproduction Test** (MUST FAIL before fix):

- Test location: `tests/unit/ui/axis-editor-display-size.test.ts`
- Test: Render `AxisEditor` with a block that has `displaySize: 'medium'`, verify a `<select>` element exists with value `'medium'`, change it to `'large'`, verify `onChange` was called with `displaySize: 'large'`
- Why it fails: No `<select>` for display size exists currently

**Fix**: Add the Display Size dropdown JSX before the Prompt section in AxisEditor.

**Verification**:
- Run `pnpm vitest run tests/unit/ui/axis-editor-display-size.test.ts` → FAILS before, PASSES after
- Visual check in admin panel confirms dropdown is present

**Acceptance Criteria**:
- [ ] Display Size dropdown visible in admin Axis block editor
- [ ] Dropdown shows 4 options (small, medium, large, full)
- [ ] Selecting a value calls onChange with the correct displaySize
- [ ] Existing AxisEditor functionality is not broken

---

## Step 3: Wire Display Size Through Student Renderer

**Root Cause**: The student-facing `AxisRenderer` uses hardcoded dimensions (600×400). The `ExerciseRenderer` doesn't pass `displaySize` to `AxisRenderer`. Even after the schema/type changes, the student view would ignore the display size setting.

**Files to Touch**:

- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED - entire file) — Add `displaySize` prop and responsive sizing logic
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED - lines 331-336) — Pass `displaySize` from the block data to `AxisRenderer`

**Exact Behavior**:

In `AxisRenderer`:
- Export `DisplaySize` type = `'small' | 'medium' | 'large' | 'full'`
- Add `SIZE_MAP` constant: `{ small: 0.33, medium: 0.5, large: 0.75, full: 1 }`
- Add `displaySize?: DisplaySize` prop (default `'full'`)
- Use a `containerRef` + `ResizeObserver` to calculate responsive width based on `displaySize` percentage
- Maintain 3:2 aspect ratio (600:400), with min width 200 and min height 133
- Cap at max 600x400

In `ExerciseRenderer`:
- Cast the block to include `displaySize` (alongside existing `axis` cast)
- Pass `displaySize` to `<AxisRenderer displaySize={axisBlock.displaySize} />`

**Reproduction Test** (MUST FAIL before fix):

- Test location: `tests/unit/ui/axis-renderer-display-size.test.ts`
- Test: Render `AxisRenderer` with `displaySize="medium"`, verify the container element has a ref and the component accepts the prop without error
- Why it fails: `AxisRenderer` doesn't accept `displaySize` prop currently

**Fix**: Add responsive sizing logic with SIZE_MAP and ResizeObserver to AxisRenderer, update ExerciseRenderer to pass the prop.

**Verification**:
- Run `pnpm vitest run tests/unit/ui/axis-renderer-display-size.test.ts` → FAILS before, PASSES after
- Run `pnpm -s tsc --noEmit` → confirms types compile

**Acceptance Criteria**:
- [ ] `AxisRenderer` accepts `displaySize` prop
- [ ] Container resizes based on percentage from `SIZE_MAP`
- [ ] Aspect ratio 3:2 is maintained
- [ ] `ExerciseRenderer` passes `displaySize` to `AxisRenderer`
- [ ] TypeScript compiles without errors
