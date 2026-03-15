# Code Review: 260313-auto-965

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| FR-001: Automatic Range Calculation by Default | `src/infra/utils/graphics/viewport-utils.ts:57-138` (`calculateAutoViewport`) | NO TEST — `viewport-utils.spec.ts` missing | ⚠️ Untested |
| FR-002: Manual Range Override Mode | `src/ui/admin/.../AxisConfigPanel.tsx:57-79` (`handleModeToggle`) | NO TEST — `AxisConfigPanel.spec.tsx` missing | ⚠️ Untested |
| FR-003: Manual Range Input Fields | `src/ui/admin/.../AxisConfigPanel.tsx:188-242` (4 input fields rendered in manual mode) | NO TEST | ⚠️ Untested |
| FR-004: Min-Max Validation | `src/infra/utils/graphics/viewport-utils.ts:143-179` (`validateViewportRange`) + `AxisConfigPanel.tsx:23-33,100-104,203-216` | NO TEST | ⚠️ Untested |
| FR-005: Numeric Value Validation | `src/infra/utils/graphics/viewport-utils.ts:147-158` (isFinite check) + `AxisConfigPanel.tsx:82-86` (isNaN guard) | NO TEST | ⚠️ Untested |
| FR-006: Empty Grid Warning | `src/infra/utils/graphics/viewport-utils.ts:184-246` (`checkGraphVisibility`) + `AxisConfigPanel.tsx:37-47,244-247` | NO TEST | ⚠️ Untested |
| FR-007: Frontend Rendering Integration | `AxisCanvas.tsx:202-205` (admin) + `AxisRenderer/index.tsx:30-33` (student) — both use `resolveViewport()` | NO TEST — `AxisRenderer.spec.tsx` missing | ⚠️ Untested |
| FR-008: Viewport Schema Extension | `src/infra/contracts/graphics/axis.v1.ts:34-35,168-169,179` | `tests/int/contracts/axis-spec.int.spec.ts:124-212` (4 tests) | ✅ Met |

### Acceptance Criteria

| Criterion | Code Location | Test Coverage | Status |
|-----------|--------------|---------------|--------|
| AC-1: Graph range is automatic by default | `axis.v1.ts:35` `.default('auto').optional()` + `viewport-utils.ts:252-272` | `axis-spec.int.spec.ts:126-145` | ✅ Met |
| AC-2: Admin can switch to manual mode via toggle | `AxisConfigPanel.tsx:180-185` checkbox + `handleModeToggle` | NO TEST | ⚠️ Untested |
| AC-3: Admin can input X-min/max, Y-min/max in manual mode | `AxisConfigPanel.tsx:188-242` (4 number inputs) | NO TEST | ⚠️ Untested |
| AC-4: System validates Min < Max (displays error) | `viewport-utils.ts:165-173` + `AxisConfigPanel.tsx:100-104,203-216,226-240` | NO TEST | ⚠️ Untested |
| AC-5: System validates numeric inputs (displays error) | `viewport-utils.ts:147-158` + `AxisConfigPanel.tsx:82-86` | NO TEST | ⚠️ Untested |
| AC-6: Warning if range excludes function | `viewport-utils.ts:184-246` + `AxisConfigPanel.tsx:244-247` | NO TEST | ⚠️ Untested |
| AC-7: Manual range controls admin preview | `AxisCanvas.tsx:202-205` uses `resolveViewport()` | NO TEST | ⚠️ Untested |
| AC-8: Settings saved and rendered on frontend | `AxisRenderer/index.tsx:30-33` uses `resolveViewport()` | NO TEST | ⚠️ Untested |

**Spec Coverage**: 1/8 functional requirements fully met (12.5%). 7/8 are implemented in code but have ZERO test coverage.

---

## Code Quality Findings

### Critical

1. **[CRITICAL] No tests for 7/8 requirements** — The plan called for 4 new test files (`viewport-utils.spec.ts`, `AxisConfigPanel.spec.tsx`, `AxisRenderer.spec.tsx`, plus updates to `axis-spec.int.spec.ts`). Only the schema integration tests were written. The build agent deleted the other test files due to a missing `@testing-library/jest-dom` dependency. This leaves ALL business logic (auto-calculation, validation, visibility check, UI toggle) untested.
   - Missing: `tests/unit/infra/utils/graphics/viewport-utils.spec.ts`
   - Missing: `tests/unit/ui/admin/AxisConfigPanel.spec.tsx`
   - Missing: `tests/unit/ui/web/AxisRenderer.spec.tsx`

2. **[CRITICAL] `new Function()` code execution** — `viewport-utils.ts:44` uses `new Function('x', \`return ${jsFn}\`)` which is effectively `eval()`. While this matches the pre-existing pattern in `AxisCanvas.tsx:78`, the new utility is used in **both** admin and student-facing code paths (via `resolveViewport()` called from `AxisRenderer`). A malicious graph function expression stored in the database could execute arbitrary JavaScript on the client. 
   - **Mitigation**: This is a pre-existing pattern in the codebase and the function expressions are authored by admins (trusted users). However, the new code should at minimum sanitize or validate the expression before execution. Currently it only does `fn.replace(/\^/g, '**')` with no sanitization.
   - **Severity**: Critical (security) but pre-existing pattern — flag for future hardening.

### Major

3. **[Major] Dead code in AxisConfigPanel.tsx:191** — The className expression `!isManualMode ? 'viewport-fields-disabled' : ''` is inside a block that only renders when `isManualMode` is true (line 188: `{isManualMode && (...)})`). The disabled class can never be applied. This is harmless but indicates a logic error in the implementation.

4. **[Major] Fragile error matching in AxisConfigPanel.tsx:100-104** — Error messages are matched by string inclusion:
   ```tsx
   const xMinError = validation.errors.find((e) => e.includes('X-min'))
   const xMaxError = validation.errors.find((e) => e.includes('X-max') || e.includes('X-min'))
   ```
   `xMaxError` will match both "X-max must be a valid number" AND "X-min must be less than X-max", potentially duplicating the error shown on the xMin field. The guard `{xMaxError && !xMinError && ...}` prevents visual duplication, but the logic is fragile — any change to error message text will break the matching.

5. **[Major] `calculateAutoViewport` always includes [-10, 10] default bounds** — Lines 66-69 initialize min/max from DEFAULT_BOUNDS before processing content. This means for a graph with only a point at (100, 100), the auto-viewport will include -10 to 100 (x-axis) instead of just around 100. The `hasContent` flag on line 71 only controls whether padding is applied, not whether defaults are included in the bounds. The auto range should start from content bounds when content exists, not union with defaults.

6. **[Major] `ViewportMode` type manually duplicated** — `axis.v1.ts:179` exports `export type ViewportMode = 'auto' | 'manual'` as a hardcoded string union. This should be `z.infer<typeof ViewportModeSchema>` to stay in sync with the Zod schema. If someone adds a third mode to the schema, this type won't automatically update.

7. **[Major] Warning CSS uses hardcoded hex colors** — `index.css:2680-2686` uses `#fff8e1`, `#f57c00`, `#ffe082` instead of Payload's `--theme-warning-*` CSS variables. The plan specified using CSS variables with hex fallbacks (e.g., `var(--theme-warning-50, #fff8e1)`), but the implementation only uses hex. This breaks theming consistency if Payload provides warning theme variables.

### Minor

8. **[Minor] `checkGraphVisibility` false-positive on empty specs** — If a spec has no graphs, no points, and no line segments, `checkGraphVisibility` returns `{ visible: false, warning: "..." }`. This would show a warning for empty graphs in manual mode, even though there's nothing to make visible. Should return `{ visible: true, warning: null }` when there's no content to check.

9. **[Minor] Magic number: `sampleCount = 20`** — Used in both `calculateAutoViewport` (line 83) and `checkGraphVisibility` (line 188) without a named constant. Should be extracted to a module-level `const SAMPLE_COUNT = 20`.

10. **[Minor] Magic number: `sampleRange = 10`** — `calculateAutoViewport` line 84 hardcodes the sampling range. Should be a named constant.

11. **[Minor] `specRef` pattern in AxisConfigPanel.tsx:17-18** — The `specRef` is used to avoid dependency on the full spec object in useMemo (line 41), but `spec.viewport` is already a dependency. The ref pattern adds complexity without clear benefit here since `spec.viewport` changes trigger re-computation anyway.

12. **[Minor] Non-null assertions in resolveViewport** — `viewport-utils.ts:263-266` uses `spec.viewport!.xMin!` etc. While the code checks `hasCompleteViewport` before this path, the non-null assertions bypass TypeScript's safety. Could use a destructured/validated value instead.

---

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | No access control involved in this feature |
| No duplicated utilities | ✅ | `viewport-utils.ts` is new and justified — no existing viewport calculation utilities |
| No duplicated validation schemas | ✅ | Validation is domain-specific, not duplicating common schemas |
| Existing UI components used where possible | ✅ | Uses existing CSS class patterns (`panel-field`, `panel-checkbox-label`) |
| No `any` type escapes | ✅ | No `any` types found in new code |
| Functions reasonably sized (<50 lines) | ✅ | Largest function `calculateAutoViewport` is ~80 lines but well-structured with clear sections |
| No magic numbers/strings | ❌ | `sampleCount = 20`, `sampleRange = 10`, default bounds `[-10, 10]` — should be named constants |
| Error handling on all async ops | ✅ | No async operations in new code; `evaluateMathExpression` has try/catch |

---

## Guardrails Verification

| Guardrail | Status | Notes |
|-----------|--------|-------|
| Backward Compatibility | ✅ | `viewportMode` defaults to `'auto'` when omitted; existing specs parse correctly (integration test confirms) |
| Data Integrity | ✅ | Viewport values stored in existing `viewport` field; `viewportMode` added alongside |
| No Breaking Changes | ✅ | `resolveViewport` falls back to auto-calculation when `viewportMode` is missing or `'auto'` |

---

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: Partial — All 8 FR requirements have corresponding code, but only FR-008 has test coverage. 7/8 requirements are ⚠️ Untested.
- **Recommendation**: **Fix Required**

### Required Fixes (Priority Order):

1. **[CRITICAL] Write missing test files** — At minimum, `viewport-utils.spec.ts` must be created to test `calculateAutoViewport`, `validateViewportRange`, `checkGraphVisibility`, and `resolveViewport`. The plan specified 10 test cases for this file. If `@testing-library/jest-dom` is unavailable, the UI component tests can be deferred, but the pure utility tests have no such dependency.

2. **[Major] Fix `calculateAutoViewport` default bounds logic** — Content-based bounds should not be unioned with [-10, 10] defaults when content exists. Initialize xMin/xMax/yMin/yMax from first content element, not from defaults.

3. **[Major] Fix `ViewportMode` type to use `z.infer`** — Replace hardcoded string union with `z.infer<typeof ViewportModeSchema>`.

4. **[Major] Remove dead code** — Remove the `!isManualMode ? 'viewport-fields-disabled' : ''` condition from line 191 since it's inside a block that only renders when `isManualMode === true`.

5. **[Minor] Extract magic numbers** — Create named constants for `SAMPLE_COUNT`, `SAMPLE_RANGE`, and `DEFAULT_BOUNDS`.

6. **[Minor] Use CSS variables for warning banner** — Replace hardcoded hex colors with `var(--theme-warning-*, fallback)` pattern.
