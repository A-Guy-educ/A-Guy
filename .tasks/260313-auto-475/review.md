# Code Review: 260313-auto-475

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| AC-1: Admin graph editor includes option to select graph display size | `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx:49-70` — `<select>` with Small/Medium/Large/Full options | `tests/unit/ui/axis-editor-display-size.test.tsx` (5 tests) — renders selector, verifies onChange, checks default value | ✅ Met |
| AC-2: Default state sets graph to full available width | `src/server/payload/collections/Exercises/defaults.ts:344` — `displaySize: 'full'`; `schemas.ts:417` — `.default('full')`; `AxisRenderer/index.tsx:32` — `displaySize = 'full'` default param | `tests/unit/collections/exercise-display-size.test.ts:100-109` — backward compat test; `tests/unit/ui/axis-renderer-display-size.test.tsx:116-123` — default width test | ✅ Met |
| AC-3: Graph scales proportionally (aspect ratio maintained) | `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx:61` — `aspectRatio = 400 / 600` calculation applied to both width and height | `tests/unit/ui/axis-renderer-display-size.test.tsx:126-143` — aspect ratio preservation tests (mock validates 3:2) | ⚠️ Untested (real component) |
| AC-4: Side-by-side layouts — text fills remaining width | **NOT IMPLEMENTED** — build.md confirms "Deferred to a future implementation" | `tests/unit/ui/exercise-renderer-side-by-side.test.tsx` — tests exist but test a **mock** component, not the actual ExerciseRenderer | ❌ Missing |
| AC-5: Configured size persists after saving and reloading | `schemas.ts:417-428` — `displaySize` field in Zod schema with `.strict()` ensures field is saved/validated in JSON content field | `tests/unit/collections/exercise-display-size.test.ts:60-96` — all size values validate; `tests/unit/collections/exercise-display-size.test.ts:99-116` — backward compat | ✅ Met |
| AC-6: Configured size accurately reflects on student-facing interface | `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx:32-88` — accepts displaySize, uses ResizeObserver for responsive sizing; `ExerciseRenderer/index.tsx:332-345` — passes displaySize to AxisRenderer | `tests/unit/ui/axis-renderer-display-size.test.tsx` — tests exist but test a **mock** component, not the actual AxisRenderer with ResizeObserver | ⚠️ Untested (real component) |

**Spec Coverage**: 4/6 requirements met (67%)

## Code Quality Findings

### Critical

- **[AC-4] Side-by-side layout NOT implemented**: The spec explicitly requires "In side-by-side layouts, the text dynamically fills the remaining width not taken by the selected graph size." The build agent acknowledged this deviation but the spec marks it as an acceptance criterion. The `exercise-renderer-side-by-side.test.tsx` file exists but tests a **mock component** — it does NOT test `ExerciseRenderer/index.tsx`. The actual ExerciseRenderer has no side-by-side grouping logic.

### Major

- **[AxisRenderer:52-88] JSXGraph board does not re-initialize on dimension change**: The `useEffect` with `displaySize` dependency recalculates dimensions and calls `setDimensions()`, which triggers a re-render. However, JSXGraphBoard's `useEffect` only depends on `[id]` (line 103 in JSXGraphBoard.tsx). This means the JSXGraph canvas is initialized once with the **initial** 600x400 dimensions and then never re-initialized when `dimensions` state updates. The JSXGraph canvas container div's inline `style={{ width, height }}` will change, but the internal JSXGraph board's coordinate mapping will be stale. **The graph will appear distorted or incorrectly scaled** after the ResizeObserver fires because JSXGraph thinks the board is still 600x400.

- **[AxisRenderer:57-58] Incorrect sizing logic — percentage of container is wrong**: `container.clientWidth * percentage` computes percentage of the *full container* width. But when `displaySize` is `'small'` (0.33), the wrapper `<div>` has no width constraint — it's always `'flex justify-center w-full'` (line 91-94). So `container.clientWidth` is the full parent width, and `container.clientWidth * 0.33` gives 33% of parent. Then `Math.min(result, 600)` caps it. But the graph board itself isn't constrained to that percentage of space — it's centered in a full-width container. The visual result is a smaller graph centered in a full-width space — there's no actual width reduction of the container element. The `containerWidth` variable (line 91) is only set for `'full'` and is an empty string for other sizes, providing no actual width constraint.

- **[AxisRenderer:88] ResizeObserver reads stale closure**: The ResizeObserver callback captures `percentage` from the closure at effect creation time. If `displaySize` changes, the entire effect re-runs (cleanup + new observer), so this is actually okay. However, the initial dimensions calculation (lines 57-71) and the ResizeObserver callback (lines 74-83) duplicate the same logic — this should be extracted into a helper function to avoid drift.

- **[Tests] UI tests test mock components, not real ones**: `axis-renderer-display-size.test.tsx` defines `MockAxisRenderer` (line 27-51) and tests that mock. `axis-editor-display-size.test.tsx` defines `MockAxisEditor` (line 16-48) and tests that mock. `exercise-renderer-side-by-side.test.tsx` defines `MockExerciseRenderer` (line 59-121) and tests that mock. **None of these tests import or test the actual source components.** This means the tests prove the mock behavior is correct, not that the actual implementation works. Schema tests (`exercise-display-size.test.ts`) are real and valid.

### Minor

- **[AxisRenderer:61] Misleading comment**: Comment says `// 2:3` but the ratio is actually `2/3` (400/600 = 0.667). The comment should say `// 2/3 (height/width)` or simply remove the confusing annotation.

- **[AxisRenderer:91] Unused `containerWidth` for non-full sizes**: When `displaySize !== 'full'`, `containerWidth` is `''`, which means the container div only has `my-4 flex justify-center` — no width constraint is applied. This means the container is always full-width regardless of `displaySize`, which contradicts the feature's purpose.

- **[schemas.ts:417] `.default('full').optional()` chaining order**: While this works correctly (verified: undefined → 'full'), the conventional Zod pattern is `.optional().default('full')`. The current order `.default().optional()` creates `ZodOptional<ZodDefault<ZodEnum>>` which is subtly different in type inference. Both work at runtime, but the `optional()` wrapper means the TypeScript inferred type is `"small" | "medium" | "large" | "full" | undefined` rather than always `"small" | "medium" | "large" | "full"`. This is acceptable since the TypeScript type in types.ts already uses `?` (optional).

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | No access control changes |
| No duplicated utilities | ✅ | SIZE_MAP is new and justified |
| No duplicated validation schemas | ✅ | DisplaySizeSchema is new and appropriate |
| Existing UI components used where possible | ✅ | Uses existing `panel-field`, `panel-field-select` CSS classes |
| No `any` type escapes | ✅ | No `any` introduced in source files |
| Functions reasonably sized (<50 lines) | ⚠️ | AxisRenderer's useEffect is 36 lines with duplicated logic |
| No magic numbers/strings | ⚠️ | 200 and 133 minimum dimensions are magic numbers (lines 69-70) |
| Error handling on all async ops | ✅ | No new async operations added |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: Partial (4/6 criteria met)
- **Recommendation**: Fix Required

### Required Fixes (ordered by severity):

1. **Critical — AC-4 Missing**: Side-by-side layout is not implemented. Either implement it or update the spec to explicitly defer it (requires product agreement). Since this is an acceptance criterion, the pipeline should treat it as a gap.

2. **Major — JSXGraph stale board dimensions**: The JSXGraphBoard only initializes on `[id]` change. When `dimensions` state updates (from ResizeObserver), the board's internal coordinate system doesn't update. The board needs to be re-initialized or resized when dimensions change. Options: (a) add `width`+`height` to JSXGraphBoard's `useEffect` deps, or (b) call `board.resizeContainer()` on dimension change, or (c) use a key prop `key={\`${blockId}-${dimensions.width}\`}` to force remount.

3. **Major — Container has no width constraint for non-full sizes**: The wrapper div needs `style={{ width: SIZE_MAP_PCT[displaySize] }}` (where SIZE_MAP_PCT maps to CSS percentage strings like '33%', '50%', '75%', '100%') to actually constrain the visual width. Currently the graph is computed smaller but centered in a full-width container, which doesn't achieve the visual effect of a narrower graph area.

4. **Major — UI tests test mocks, not real components**: The 3 `.test.tsx` files should either (a) import and test the real components with appropriate mocking of JSXGraph/dynamic imports, or (b) be renamed/documented as "behavioral specification tests" that validate the expected pattern but not the actual implementation.
