# Code Review: 260313-auto-573

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| FR-001: Standardized Axis Title Positioning (Y-axis top-right, X-axis far-right-below) | `src/ui/web/.../JSXGraphBoard.tsx:67,81` + `src/ui/admin/.../JSXGraphBoard.tsx:82,99` | `tests/unit/ui/web/JSXGraphBoard.spec.ts:109-123` (both X and Y label position+offset) | ✅ Met |
| FR-002: X-Axis Tick Position Configuration (toggle in admin editor, saved with spec) | `src/ui/admin/.../AxisConfigPanel.tsx:73-87` (checkbox), `axis.v1.ts:32-37` (schema field) | `tests/unit/ui/admin/AxisConfigPanel.spec.tsx:72-87,89-106` (check/uncheck X toggle) | ✅ Met |
| FR-003: Y-Axis Tick Position Configuration (toggle in admin editor, saved with spec) | `src/ui/admin/.../AxisConfigPanel.tsx:88-102` (checkbox), `axis.v1.ts:32-37` (schema field) | `tests/unit/ui/admin/AxisConfigPanel.spec.tsx:108-142` (check/uncheck Y toggle) | ✅ Met |
| FR-004: Default Tick Placement Behavior (backward compat, optional field, defaults to standard) | `axis.v1.ts:37` (`.optional()`), `AxisRenderer/index.tsx:51` (`?? { x: 'default', y: 'default' }`), `AxisCanvas.tsx:224` (same fallback) | `tests/int/contracts/axis-spec.int.spec.ts:188-207` (backward compat), `tests/unit/ui/web/JSXGraphBoard.spec.ts:93-107` (default offsets) | ✅ Met |
| FR-005: Student View Rendering (tick placement rendered in web JSXGraphBoard) | `src/ui/web/.../JSXGraphBoard.tsx:51-84` (defaultAxes with tick offsets), `src/ui/web/.../AxisRenderer/index.tsx:46-52` (passes tickPosition to board) | `tests/unit/ui/web/JSXGraphBoard.spec.ts:61-91` (inverted X, inverted Y, both inverted) | ✅ Met |
| FR-006: Admin JSXGraphBoard Axis Configuration Support (axisConfig prop, AxisCanvas passes config) | `src/ui/admin/.../JSXGraphBoard.tsx:14-19` (axisConfig interface), `src/ui/admin/.../AxisCanvas.tsx:219-225` (passes axisConfig) | `tests/unit/ui/admin/AxisConfigPanel.spec.tsx` (indirectly via spec → onChange flow) | ✅ Met |
| NFR-001: Schema Extension with Backward Compatibility (optional tickPosition in AxisSpecV1) | `src/infra/contracts/graphics/axis.v1.ts:32-37` (exact schema structure from spec) | `tests/int/contracts/axis-spec.int.spec.ts:119-291` (valid, invalid, backward compat, both inverted) | ⚠️ Partial (see Critical #1) |
| NFR-002: JSXGraph Type Declarations Extension (defaultAxes, ticks, label position) | `src/types/jsxgraph.d.ts:17-38` (defaultAxes with x/y ticks/label typing) | No dedicated test (type declarations, validated by `tsc --noEmit`) | ✅ Met |

**Spec Coverage**: 7/8 requirements fully met, 1 partial (92%)

## Code Quality Findings

### Critical

1. **[tests/int/contracts/axis-spec.int.spec.ts:251-291] Two schema tests will FAIL at runtime** — The tests "rejects tickPosition with missing x value" (line 251) and "rejects tickPosition with missing y value" (line 272) expect `AxisSpecV1Schema.parse()` to throw when one of x/y is missing from the tickPosition object. However, the Zod schema uses `.default('default')` on both `x` and `y` fields (axis.v1.ts:34-35), which means Zod will automatically fill in the missing field with `'default'` rather than throwing. These tests assert incorrect behavior and **will fail when run**. The schema design itself is correct (defaulting missing fields is the right behavior for backward compatibility); the tests need to be corrected to expect success instead of failure, or removed.

### Major

- None

### Minor

1. **[tests/unit/ui/web/JSXGraphBoard.spec.ts:8] Unused import** — `renderHook` from `@testing-library/react` is imported but never used. Should be removed to keep the test file clean.

2. **[src/ui/web/.../JSXGraphBoard.tsx:116] Pre-existing: useEffect depends only on `[id]`** — The web JSXGraphBoard `useEffect` dependency array includes only `[id]`, meaning changes to `axisConfig` or `tickPosition` after initial mount won't cause the board to re-initialize. This is a pre-existing limitation (not introduced by this task), but it means that if the component were ever used in a context where tickPosition changes dynamically (e.g., live preview), it would not update. The admin JSXGraphBoard correctly depends on `[loaded, boundingBox, showAxis, showGrid, showNavigation, axisConfig]` (line 121).

3. **[src/ui/web/.../JSXGraphBoard.tsx:61,75 + admin JSXGraphBoard.tsx:73,90] Magic numbers `-10` and `10`** — The tick offset values `-10` and `10` are used as magic numbers. Consider extracting them as named constants (e.g., `const DEFAULT_TICK_OFFSET = -10; const INVERTED_TICK_OFFSET = 10;`) for readability and maintainability. Same applies to the label offsets `[0, 12]` and `[15, 0]`.

4. **[src/ui/web/.../JSXGraphBoard.tsx + admin JSXGraphBoard.tsx] Duplicated axis config construction logic** — The logic for building `defaultAxes` (tick offsets, label positioning) is duplicated nearly identically between the web and admin JSXGraphBoard components. Consider extracting this into a shared utility function (e.g., `buildDefaultAxes(axisConfig)`) to reduce duplication and ensure consistency.

5. **[src/ui/admin/.../AxisConfigPanel.tsx:72] Inline style** — `style={{ marginTop: 8 }}` is used instead of a Tailwind utility class (e.g., `className="mt-2"`). The project convention is Tailwind-only for styling.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | N/A — no access control in this feature |
| No duplicated utilities | ❌ | `defaultAxes` construction logic duplicated between web and admin JSXGraphBoard |
| No duplicated validation schemas | ✅ | Single schema in `axis.v1.ts` used everywhere |
| Existing UI components used where possible | ✅ | Uses existing `panel-checkbox-label` pattern |
| No `any` type escapes | ✅ | Only pre-existing `any` (JSXGraph dynamic import, line 44 web) |
| Functions reasonably sized (<50 lines) | ✅ | All functions well within limits |
| No magic numbers/strings | ❌ | Tick offset values `-10`, `10`, `12`, `15` used without named constants |
| Error handling on all async ops | ✅ | JSXGraph import has proper cleanup/cancelled guard |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: Partial — 7/8 requirements met; NFR-001 partially met due to 2 incorrect test assertions that will fail
- **Recommendation**: Fix Required
  - **Critical**: Fix or remove the 2 failing integration tests in `axis-spec.int.spec.ts:251-291` (tests expect throw but Zod `.default()` prevents it)
  - **Minor**: Remove unused `renderHook` import, extract magic numbers to constants, consider extracting shared `buildDefaultAxes` utility
