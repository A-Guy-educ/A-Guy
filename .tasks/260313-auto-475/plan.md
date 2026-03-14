# Plan: Graph Size Configuration

**Task ID**: 260313-auto-475
**Type**: implement_feature
**Spec refs**: AC-1 through AC-6 from spec.md

## Rerun Context

This is a fix rerun. The previous run was triggered but only reached `taskify` stage before being restarted via `@cody fix`. The previous run produced no code artifacts — only a `task.json` classification. This plan is written from scratch to deliver the feature end-to-end.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/collections/Exercises/schemas.ts` — Zod schemas for exercise content blocks
- ✅ `src/server/payload/collections/Exercises/types.ts` — TypeScript interfaces for exercise content blocks
- ✅ `src/server/payload/collections/Exercises/defaults.ts` — Default block factory functions
- ✅ `src/infra/contracts/graphics/axis.v1.ts` — AxisSpecV1 Zod schema (strict, 172 lines)
- ✅ `src/infra/contracts/graphics/geometry.v1.ts` — GeometrySpecV1 Zod schema (strict, 194 lines)
- ✅ `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Student-facing axis graph renderer
- ✅ `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` — Student-facing geometry renderer
- ✅ `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — JSXGraph board component (width/height props, style-based sizing)
- ✅ `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` — Main exercise renderer orchestrator
- ✅ `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — Admin axis editor
- ✅ `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` — Admin geometry editor
- ✅ `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Axis config UI
- ✅ `src/ui/admin/ExerciseContentEditor/components/geometry/CanvasConfigPanel.tsx` — Geometry canvas config UI
- ✅ `tests/int/contracts/exercise-content-blocks.int.spec.ts` — Existing content block schema tests

### Patterns Observed
- Both `AxisSpecV1Schema` and `GeometrySpecV1Schema` use `.strict()` — any new field requires adding to the Zod schema AND the TS type
- The graph blocks (`question_axis`, `question_geometry`) have their data nested inside `axis`/`geometry` spec objects
- The renderers use fixed `width`/`height` props (600×400 for axis, canvas.width×canvas.height for geometry)
- JSXGraphBoard accepts `width`/`height` as numbers and applies them via inline `style={{ width, height }}`
- The ExerciseRenderer wraps graph blocks in a plain `<div>` with no layout control
- Admin editors use a `graph-editor-layout` CSS class (2-column form+canvas)
- AxisConfigPanel already has viewport, grid, unit controls — ideal place to add display size selector

### Integration Points
- Both spec schemas are `.strict()` — new `displaySize` field must be added to the Zod schema AND the type
- `QuestionAxisBlock` and `QuestionGeometryBlock` interfaces must be updated
- Student-facing renderers read from the spec to set dimensions
- Admin editors can pass the new field to config panels

## Reuse Inventory

### Existing utilities to reuse
- `cn()` from `@/infra/utils/ui` — conditional CSS classes (used in JSXGraphBoard, renderers)
- `CollapsibleSection` from `@/ui/admin/shared/CollapsibleSection` — admin UI sections
- `AxisConfigPanel` — extend with display size selector (not create new)
- `CanvasConfigPanel` — extend with display size selector (not create new)
- `ContentBlockSchema` from schemas.ts — already used for block validation tests

### New code justification
- **`GraphSizeConfig` type/constant** — New shared type for `'small' | 'medium' | 'large' | 'full'` with width mappings. No existing utility covers display size presets. Will be placed in `src/infra/contracts/graphics/display.ts` alongside other graphics contracts.

---

## Design Decisions

### Size Options & Width Percentages
| Size   | Graph Width % | Description                     |
|--------|---------------|---------------------------------|
| `small`  | 33%         | Compact — sidebar-sized         |
| `medium` | 50%         | Half width                      |
| `large`  | 75%         | Three-quarter width             |
| `full`   | 100%        | Full container width (default)  |

### Where to Store `displaySize`
The `displaySize` field is added at the **block level** on `QuestionAxisBlock` and `QuestionGeometryBlock` (not inside the graphics spec contracts). This is because:
1. Display size is a **presentation concern**, not a mathematical specification
2. The graphics contracts (`AxisSpecV1`, `GeometrySpecV1`) define the mathematical model — keeping them pure
3. The block types already contain presentation-adjacent fields (prompt, hint, etc.)

### Aspect Ratio
The JSXGraphBoard component already renders with fixed width/height. We change the approach: instead of absolute pixels, we use a percentage-width container wrapper. The JSXGraphBoard inside uses `width: 100%` of its container, and the height is derived from the original aspect ratio (height/width × containerWidth).

---

## Steps

### Step 1: Add `displaySize` type constant and shared display utilities

**Files to Touch**:
- `src/infra/contracts/graphics/display.ts` (NEW)

**Behavior**:
- Export a `GraphDisplaySize` type: `'small' | 'medium' | 'large' | 'full'`
- Export a `GRAPH_SIZE_OPTIONS` array of `{ value, label, widthPercent }` for UI selectors
- Export a `GRAPH_SIZE_MAP` record mapping size → width percentage
- Export a `DEFAULT_GRAPH_DISPLAY_SIZE` constant = `'full'`

**Tests** (1 test file):
- `tests/unit/contracts/graph-display-size.test.ts` (NEW)
- Test: `GRAPH_SIZE_MAP` contains entries for all 4 sizes with correct percentages
- Test: `DEFAULT_GRAPH_DISPLAY_SIZE` equals `'full'`
- Test: `GRAPH_SIZE_OPTIONS` has 4 entries matching the map

**Acceptance Criteria**:
- [ ] `GraphDisplaySize` type exported
- [ ] `GRAPH_SIZE_MAP` maps small→33, medium→50, large→75, full→100
- [ ] `DEFAULT_GRAPH_DISPLAY_SIZE` = `'full'`

---

### Step 2: Add `displaySize` to block-level types and schemas

**Files to Touch**:
- `src/server/payload/collections/Exercises/types.ts` (MODIFIED — lines 210-233)
- `src/server/payload/collections/Exercises/schemas.ts` (MODIFIED — lines 401-428)

**Behavior**:
- Add optional `displaySize?: GraphDisplaySize` field to `QuestionGeometryBlock` interface (after `geometry` field)
- Add optional `displaySize?: GraphDisplaySize` field to `QuestionAxisBlock` interface (after `axis` field)
- Add `displaySize: z.enum(['small', 'medium', 'large', 'full']).optional()` to `QuestionGeometryBlockSchema`
- Add `displaySize: z.enum(['small', 'medium', 'large', 'full']).optional()` to `QuestionAxisBlockSchema`
- Note: These schemas are `.strict()` so the field MUST be in the schema for data containing it to validate

**Tests** (extend existing test file):
- `tests/int/contracts/exercise-content-blocks.int.spec.ts` (MODIFIED — add new describe block)
- Test: `QuestionAxisBlockSchema` validates block with `displaySize: 'medium'`
- Test: `QuestionAxisBlockSchema` validates block without `displaySize` (backward compat)
- Test: `QuestionAxisBlockSchema` rejects block with `displaySize: 'invalid'`
- Test: Same 3 tests for `QuestionGeometryBlockSchema`

**Acceptance Criteria**:
- [ ] Types updated with optional `displaySize` field
- [ ] Schemas accept valid displaySize values
- [ ] Schemas reject invalid displaySize values
- [ ] Schemas still accept blocks without displaySize (backward compatibility)

---

### Step 3: Update admin config panels with display size selector

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (MODIFIED)
- `src/ui/admin/ExerciseContentEditor/components/geometry/CanvasConfigPanel.tsx` (MODIFIED)
- `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` (MODIFIED — pass displaySize through)
- `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx` (MODIFIED — pass displaySize through)

**Behavior**:
- **AxisConfigPanel**: Add a "Display Size" row with a `<select>` dropdown using `GRAPH_SIZE_OPTIONS`. The `onChange` callback updates the parent block's `displaySize` field. Since `AxisConfigPanel` receives the full `AxisSpecV1` spec, but `displaySize` lives on the block, we need to add a new prop `displaySize` and `onDisplaySizeChange` to `AxisConfigPanel`.
- **CanvasConfigPanel**: Same pattern — add `displaySize` and `onDisplaySizeChange` props, render a `<select>` dropdown.
- **AxisEditor**: Pass `block.displaySize` and an `onDisplaySizeChange` handler to `AxisConfigPanel`. The handler calls `onChange({ ...block, displaySize: newSize })`.
- **GeometryEditor**: Same pattern — pass displaySize props through to `CanvasConfigPanel`.

**Tests**:
- `tests/unit/admin/graph-size-selector.test.tsx` (NEW)
- Test: AxisConfigPanel renders display size dropdown with 4 options
- Test: Selecting a different size triggers onDisplaySizeChange callback with correct value
- Test: Default selection shows 'full' when displaySize is undefined

**Acceptance Criteria**:
- [ ] AC-1: Admin graph editor includes display size selector [spec AC-1]
- [ ] AC-5: Size persists via block data model (config panels read/write it) [spec AC-5]
- [ ] Dropdown defaults to "Full" when no displaySize set [spec AC-2]

---

### Step 4: Update student-facing renderers to respect displaySize

**Files to Touch**:
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED)
- `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx` (MODIFIED)
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — lines 322-337)
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` (MODIFIED — support responsive sizing)

**Behavior**:

**JSXGraphBoard changes**:
- Add optional `aspectRatio?: number` prop (height/width)
- Add optional `responsive?: boolean` prop  
- When `responsive` is true, render with `style={{ width: '100%', aspectRatio: `${width}/${height}` }}` instead of fixed pixel width/height. This leverages the CSS `aspect-ratio` property to maintain proportions.
- When `responsive` is false (default), keep current fixed-pixel behavior for admin canvas

**AxisRenderer changes**:
- Accept new optional `displaySize` prop of type `GraphDisplaySize`
- Import `GRAPH_SIZE_MAP` and `DEFAULT_GRAPH_DISPLAY_SIZE`
- Wrap the JSXGraphBoard in a container `<div>` with a width style from the size map
- Pass `responsive={true}` to JSXGraphBoard
- The aspect ratio is derived from the fixed 600×400 default (3:2)

**GeometryRenderer changes**:
- Same pattern as AxisRenderer — accept `displaySize` prop
- Width from size map, aspect ratio from `canvas.height / canvas.width`
- Pass `responsive={true}` to JSXGraphBoard

**ExerciseRenderer changes**:
- When rendering `question_axis` blocks, pass `displaySize={b.displaySize}` to `AxisRenderer`
- When rendering `question_geometry` blocks, pass `displaySize={b.displaySize}` to `GeometryRenderer`
- Both renderers already wrapped in `<div key={b.id}>` — no layout changes needed for full-width default

**Tests**:
- `tests/unit/renderers/graph-display-size.test.tsx` (NEW)
- Test: AxisRenderer with `displaySize='medium'` renders container with `width: 50%`
- Test: AxisRenderer with no displaySize renders container with `width: 100%` (default full)
- Test: GeometryRenderer with `displaySize='small'` renders container with `width: 33%`
- Test: JSXGraphBoard with `responsive={true}` uses aspect-ratio CSS instead of fixed pixels

**Acceptance Criteria**:
- [ ] AC-2: Default graph occupies full width [spec AC-2]
- [ ] AC-3: Aspect ratio maintained via CSS aspect-ratio property [spec AC-3]
- [ ] AC-6: Student-facing display respects configured size [spec AC-6]
- [ ] AC-4: In side-by-side layout, graph width determined by displaySize, text fills remaining space [spec AC-4]

---

### Step 5: Update defaults for new blocks to include displaySize

**Files to Touch**:
- `src/server/payload/collections/Exercises/defaults.ts` (MODIFIED — lines 298-347)

**Behavior**:
- Do NOT add `displaySize` to the defaults — it's optional and the default behavior (full width) is achieved by the absence of the field
- This maintains backward compatibility — existing data without `displaySize` renders at full width

**Tests**:
- No new tests needed — existing default factory tests (if any) continue to pass
- The schema tests in Step 2 already verify that blocks without `displaySize` are valid

**Acceptance Criteria**:
- [ ] Existing defaults remain valid (no breaking changes)
- [ ] New blocks default to full-width display

---

### Step 6: Export from contracts barrel file

**Files to Touch**:
- `src/infra/contracts/index.ts` (MODIFIED — add display export) OR `src/infra/contracts/graphics/index.ts` if it exists

**Behavior**:
- Re-export `GraphDisplaySize`, `GRAPH_SIZE_MAP`, `GRAPH_SIZE_OPTIONS`, `DEFAULT_GRAPH_DISPLAY_SIZE` from `./graphics/display`

**Tests**:
- Covered by import tests in other steps (if the barrel doesn't re-export, the imports in renderers will fail during typecheck)

**Acceptance Criteria**:
- [ ] All display size exports accessible from `@/infra/contracts`

---

## Test Commands

```bash
# Unit tests for display size constants
pnpm vitest run tests/unit/contracts/graph-display-size.test.ts

# Schema validation tests  
pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts

# Admin component tests
pnpm vitest run tests/unit/admin/graph-size-selector.test.tsx

# Student renderer tests
pnpm vitest run tests/unit/renderers/graph-display-size.test.tsx

# Type check (critical — strict schemas)
pnpm tsc --noEmit

# Full quality gate
pnpm lint && pnpm tsc --noEmit && pnpm vitest run
```

## Risk Assessment

- **Low risk**: Adding optional field to strict Zod schemas — backward compatible
- **Medium risk**: Changing JSXGraphBoard to support responsive mode — existing admin canvas uses fixed-pixel mode, which is preserved via `responsive` flag defaulting to false
- **Low risk**: No database migration needed — field is optional, existing data renders at full width by default
