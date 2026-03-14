# Plan: 260313-auto-965 — Configure Graph Display Range (X and Y) in Admin Graph Editor

## Rerun Context

This is a rerun with generic feedback ("Rerun requested via /cody rerun"). The previous run did not produce a plan, so this is effectively a first-pass plan. No approach changes needed.

## Research Findings

### File Paths Verified
- ✅ `src/infra/contracts/graphics/axis.v1.ts` — AxisSpecV1Schema with ViewportSchema (lines 35-42), currently optional with xMin/xMax/yMin/yMax but NO viewportMode field
- ✅ `src/infra/contracts/index.ts` — Re-exports AxisSpecV1Schema and AxisSpecV1 type (line 33)
- ✅ `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` — Current admin config panel with hardcoded viewport input fields (lines 93-134), no auto/manual toggle, no validation
- ✅ `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` — Admin preview canvas computing bbox from viewport (lines 201-208)
- ✅ `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx` — Parent editor wiring AxisConfigPanel (line 62)
- ✅ `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` — Student-facing renderer using viewport for boundingBox (lines 29-35)
- ✅ `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — Student-facing JSXGraphBoard component
- ✅ `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx` — Admin JSXGraphBoard component
- ✅ `src/ui/admin/ExerciseContentEditor/index.css` — CSS styles (panel-field, panel-checkbox-label classes)
- ✅ `tests/int/contracts/axis-spec.int.spec.ts` — Existing integration tests for AxisSpecV1Schema
- 🆕 `src/infra/utils/graphics/viewport-utils.ts` — New utility for auto-calculation + validation
- 🆕 `tests/unit/infra/utils/graphics/viewport-utils.spec.ts` — New unit tests for viewport utilities

### Patterns Observed
- **ViewportSchema** is already an optional object on AxisSpecV1 with xMin/xMax/yMin/yMax — all optional numbers. We need to add `viewportMode` alongside this.
- **AxisConfigPanel** uses `panel-field`, `panel-field-label`, `panel-field-input`, `panel-checkbox-label` CSS classes — follow this pattern for the toggle and validation messages.
- **AxisCanvas** and **AxisRenderer** both compute bounding boxes from viewport with `?? -10` / `?? 10` fallbacks — these become the auto-calculation targets.
- The schema uses `.strict()` so we must add `viewportMode` inside the schema object, not outside it.
- **Error styling** uses `--theme-error-50`, `--theme-error-500`, `--theme-error-200` CSS variables throughout index.css.
- **Warning styling** uses `--theme-warning-*` variables (need to confirm, but Payload exposes them).

### Integration Points
- Schema change in `axis.v1.ts` → must run `pnpm generate:types` after
- `AxisConfigPanel` is consumed by `AxisEditor.tsx` line 62 — no interface change needed (spec + onChange already passed)
- `AxisRenderer` (student-facing) reads `spec.viewport` directly — needs to respect `viewportMode`
- `AxisCanvas` (admin preview) also reads `axis.viewport` — needs to respect `viewportMode`

## Reuse Inventory

### Existing Utilities to Reuse
- `z` (Zod) from `'zod'` — for schema extension in axis.v1.ts
- `panel-field`, `panel-field-input`, `panel-field-label`, `panel-checkbox-label` CSS classes from `index.css` — for UI layout
- `--theme-error-*` and `--theme-warning-*` CSS variables — for validation/warning styling
- `AxisSpecV1Schema` patterns — follow existing `.strict()` pattern

### New Utilities Justified
- `src/infra/utils/graphics/viewport-utils.ts` — **NEW**: Needed for auto-viewport calculation from graph elements and viewport validation logic. No existing utility handles math expression sampling or viewport bounds computation. This is domain-specific logic that doesn't exist anywhere in the codebase. Placing it in `infra/utils/graphics/` follows the pattern of domain utilities (similar to how `infra/utils/validation/` holds validation utils).

---

## Steps

### Step 1: Extend AxisSpecV1 Schema with viewportMode field [FR-008]

**Files to Touch**:
- `src/infra/contracts/graphics/axis.v1.ts` (MODIFIED — lines 35-42, 158-169)

**Behavior**:
- Add a `viewportMode` field to the AxisSpecV1Schema: `z.enum(['auto', 'manual']).default('auto').optional()`
- Place it at the top level of the schema object, alongside `viewport`
- The field defaults to `'auto'` and is optional for backward compatibility
- Existing documents without `viewportMode` will parse as `'auto'` (Zod default)
- The `viewport` field itself remains unchanged — it stores the manual values but is only used when `viewportMode === 'manual'`

**Tests** (FAIL before, PASS after):
- Test file: `tests/int/contracts/axis-spec.int.spec.ts` (ADD new test cases to existing file)
- Test 1: `AxisSpecV1Schema.parse(specWithoutViewportMode)` succeeds and result has `viewportMode === 'auto'` (default)
- Test 2: `AxisSpecV1Schema.parse(specWithViewportModeManual)` succeeds with `viewportMode === 'manual'`
- Test 3: `AxisSpecV1Schema.parse(specWithInvalidViewportMode)` throws (value `'zoom'` not in enum)
- Test 4: Existing test "validates complete axis spec with all features" continues to PASS (backward compat)

**Acceptance Criteria**:
- [ ] Schema accepts `viewportMode: 'auto'` and `viewportMode: 'manual'`
- [ ] Schema defaults to `'auto'` when field omitted
- [ ] Schema rejects invalid viewportMode values
- [ ] Existing tests still pass (backward compatibility)

**Run**: `pnpm vitest run tests/int/contracts/axis-spec.int.spec.ts`

---

### Step 2: Create viewport utility functions [FR-001, FR-004, FR-005, FR-006]

**Files to Touch**:
- `src/infra/utils/graphics/viewport-utils.ts` (NEW)

**Behavior**:
Create a utility module with these pure functions:

1. **`calculateAutoViewport(spec: AxisSpecV1): { xMin: number; xMax: number; yMin: number; yMax: number }`**
   - Analyze all elements: points (x, y coords), graph functions (sample at N points in [-10,10] range), asymptotes, line segments
   - Determine the bounding box that contains all content
   - Add 10% padding on each side (minimum 1 unit)
   - If no elements exist, return default `{ xMin: -10, xMax: 10, yMin: -10, yMax: 10 }`

2. **`validateViewportRange(viewport: { xMin: number; xMax: number; yMin: number; yMax: number }): { valid: boolean; errors: string[] }`**
   - Check `xMin < xMax` — error: "X-min must be less than X-max"
   - Check `yMin < yMax` — error: "Y-min must be less than Y-max"
   - Check all values are finite numbers — error: "All values must be valid numbers"
   - Return `{ valid: boolean, errors: string[] }`

3. **`checkGraphVisibility(spec: AxisSpecV1, viewport: { xMin: number; xMax: number; yMin: number; yMax: number }): { visible: boolean; warning: string | null }`**
   - For each graph function, sample y-values at ~20 evenly spaced x-values within [viewport.xMin, viewport.xMax]
   - If ALL sampled y-values for ALL graphs fall outside [viewport.yMin, viewport.yMax], return `{ visible: false, warning: "Warning: No graph content is visible in the configured range." }`
   - Also check if all points fall outside the viewport
   - Return `{ visible: true, warning: null }` if at least some content is visible

4. **`resolveViewport(spec: AxisSpecV1): { xMin: number; xMax: number; yMin: number; yMax: number }`**
   - If `spec.viewportMode === 'manual'` and viewport has all 4 values, return the manual values
   - Otherwise, call `calculateAutoViewport(spec)` and return auto values
   - This is the single entry point used by both admin canvas and student renderer

**Tests** (FAIL before, PASS after):
- Test file: `tests/unit/infra/utils/graphics/viewport-utils.spec.ts` (NEW)
- Test 1: `calculateAutoViewport` with points returns bbox that contains all points with padding
- Test 2: `calculateAutoViewport` with no elements returns default [-10,10] range
- Test 3: `calculateAutoViewport` with graph `x^2` returns reasonable Y range including parabola values
- Test 4: `validateViewportRange({xMin:5, xMax:1, yMin:-5, yMax:5})` returns `{ valid: false, errors: ["X-min must be less than X-max"] }`
- Test 5: `validateViewportRange({xMin:-5, xMax:5, yMin:-5, yMax:5})` returns `{ valid: true, errors: [] }`
- Test 6: `validateViewportRange({xMin:NaN, ...})` returns error for non-finite
- Test 7: `checkGraphVisibility` with graph `x^2` and viewport y:[100,200] returns `{ visible: false, warning: "..." }`
- Test 8: `checkGraphVisibility` with graph `x^2` and viewport y:[-10,10] returns `{ visible: true, warning: null }`
- Test 9: `resolveViewport` with `viewportMode:'manual'` and complete viewport returns manual values
- Test 10: `resolveViewport` with `viewportMode:'auto'` returns auto-calculated values

**Acceptance Criteria**:
- [ ] Auto viewport calculation includes all points and reasonable function range
- [ ] Validation catches xMin >= xMax and yMin >= yMax
- [ ] Validation catches non-numeric (NaN, Infinity) values
- [ ] Visibility check detects when graphs are completely outside viewport
- [ ] resolveViewport correctly dispatches between auto and manual modes

**Run**: `pnpm vitest run tests/unit/infra/utils/graphics/viewport-utils.spec.ts --config vitest.config.unit.mts`

---

### Step 3: Update AxisConfigPanel with auto/manual toggle and validation [FR-002, FR-003, FR-004, FR-005, FR-006]

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` (MODIFIED — major rewrite of lines 93-134)
- `src/ui/admin/ExerciseContentEditor/index.css` (MODIFIED — add ~30 lines for validation/warning styles)

**Behavior**:

**AxisConfigPanel changes**:
1. Add a checkbox toggle at the top of the viewport section: "Manual Range" (using existing `panel-checkbox-label` pattern)
   - When unchecked (`viewportMode === 'auto'` or undefined): viewport fields are hidden/disabled, graph uses auto-calculated viewport
   - When checked (`viewportMode === 'manual'`): viewport fields are shown and editable
2. The toggle updates `spec.viewportMode` via `onChange`
3. When switching to manual mode, pre-populate the input fields with the current auto-calculated values (call `calculateAutoViewport`)
4. When switching back to auto mode, clear the viewport values (set `viewportMode: 'auto'`)
5. Each input field validates on blur:
   - Non-numeric → show inline error "Must be a number" (red text below field)
   - xMin >= xMax → show inline error "Min must be less than Max" on xMin field
   - yMin >= yMax → show inline error "Min must be less than Max" on yMin field
6. Call `checkGraphVisibility` after viewport changes — if content not visible, show a warning banner below the viewport fields: "⚠ Warning: No graph content is visible in the configured range."
7. Warning is non-blocking (does not prevent saving)

**CSS additions** (in index.css):
- `.viewport-validation-error` — small red text: `font-size: 0.6875rem; color: var(--theme-error-500); margin-top: 2px;`
- `.viewport-warning-banner` — warning banner: `background: var(--theme-warning-50, #fff8e1); color: var(--theme-warning-700, #f57c00); border: 1px solid var(--theme-warning-200, #ffe082); border-radius: 4px; padding: 0.5rem; font-size: 0.8125rem; margin-top: 0.5rem;`
- `.viewport-fields-disabled` — opacity: 0.5, pointer-events: none for auto mode

**Tests** (FAIL before, PASS after):
- Test file: `tests/unit/ui/admin/AxisConfigPanel.spec.tsx` (NEW)
- Test 1: Renders without crashing when viewportMode is undefined (backward compat)
- Test 2: Manual Range checkbox is unchecked by default when viewportMode is 'auto'
- Test 3: Checking Manual Range checkbox calls onChange with viewportMode: 'manual'
- Test 4: Viewport input fields are visible/enabled only when viewportMode is 'manual'
- Test 5: Entering xMin=10, xMax=5 and blurring shows "Min must be less than Max" error
- Test 6: Entering valid values calls onChange with correct viewport values

**Acceptance Criteria**:
- [ ] Auto/manual toggle checkbox renders and functions
- [ ] Viewport fields hidden/disabled in auto mode, shown in manual mode
- [ ] Inline validation errors display for invalid min/max
- [ ] Inline validation errors display for non-numeric input
- [ ] Empty grid warning banner displays when graphs not visible
- [ ] Warning is non-blocking (no save prevention)

**Run**: `pnpm vitest run tests/unit/ui/admin/AxisConfigPanel.spec.tsx --config vitest.config.unit.mts`

---

### Step 4: Update AxisCanvas (admin preview) to use resolveViewport [FR-001, FR-007]

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` (MODIFIED — lines 201-209)

**Behavior**:
- Import `resolveViewport` from `@/infra/utils/graphics/viewport-utils`
- Replace the hardcoded `bbox` computation (lines 201-209) with:
  ```
  const resolved = resolveViewport(axis)
  const bbox: [number,number,number,number] = [resolved.xMin, resolved.yMax, resolved.xMax, resolved.yMin]
  ```
- This ensures admin preview shows auto-calculated viewport in auto mode, and manual viewport in manual mode
- When viewportMode is 'auto', the preview updates dynamically as the author adds/removes graph elements

**Tests** (FAIL before, PASS after):
- No separate unit test needed for AxisCanvas (it's a thin component). The integration behavior is covered by:
  - Step 2's `resolveViewport` unit tests (logic correctness)
  - Step 3's AxisConfigPanel tests (toggle flow)
  - E2E test in Step 6 (visual verification)

**Acceptance Criteria**:
- [ ] Admin preview shows auto-calculated viewport when viewportMode is 'auto'
- [ ] Admin preview shows manual viewport when viewportMode is 'manual'
- [ ] Viewport updates when switching between modes

---

### Step 5: Update AxisRenderer (student-facing) to use resolveViewport [FR-007]

**Files to Touch**:
- `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx` (MODIFIED — lines 29-35)

**Behavior**:
- Import `resolveViewport` from `@/infra/utils/graphics/viewport-utils`
- Replace the hardcoded `boundingBox` computation (lines 29-35) with:
  ```
  const resolved = resolveViewport(spec)
  const boundingBox: [number,number,number,number] = [resolved.xMin, resolved.yMax, resolved.xMax, resolved.yMin]
  ```
- This ensures students see the admin-configured range (manual) or a properly calculated range (auto)
- Students cannot modify these display ranges (already the case — no controls exposed)

**Tests** (FAIL before, PASS after):
- Test file: `tests/unit/ui/web/AxisRenderer.spec.tsx` (NEW)
- Test 1: AxisRenderer passes correct boundingBox to JSXGraphBoard when spec has `viewportMode: 'manual'` with explicit viewport values
- Test 2: AxisRenderer passes auto-calculated boundingBox when spec has `viewportMode: 'auto'`
- Test 3: AxisRenderer passes auto-calculated boundingBox when spec has no viewportMode (backward compat)

**Acceptance Criteria**:
- [ ] Student-facing renderer uses manual viewport when configured
- [ ] Student-facing renderer uses auto viewport when not configured
- [ ] Backward compatible with existing specs (no viewportMode field)

**Run**: `pnpm vitest run tests/unit/ui/web/AxisRenderer.spec.tsx --config vitest.config.unit.mts`

---

### Step 6: Run all quality gates and generate types

**Files to Touch**:
- No code files — commands only

**Behavior**:
1. Run `pnpm generate:types` to regenerate Payload types after schema change
2. Run `pnpm generate:importmap` to regenerate import map
3. Run `pnpm -s tsc --noEmit` to verify TypeScript correctness
4. Run `pnpm -s lint` to verify linting passes
5. Run all tests: `pnpm vitest run tests/int/contracts/axis-spec.int.spec.ts && pnpm vitest run tests/unit/infra/utils/graphics/viewport-utils.spec.ts --config vitest.config.unit.mts && pnpm vitest run tests/unit/ui/admin/AxisConfigPanel.spec.tsx --config vitest.config.unit.mts && pnpm vitest run tests/unit/ui/web/AxisRenderer.spec.tsx --config vitest.config.unit.mts`

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] All new and existing tests pass
- [ ] Generated types include viewportMode field
