# Gap Analysis: 260313-auto-965

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Viewport Mode Field in Schema

**Severity:** Critical
**Location:** `/src/infra/contracts/graphics/axis.v1.ts`
**Issue:** The AxisSpecV1 schema has a `viewport` field with xMin, xMax, yMin, yMax, but lacks a `viewportMode` field to switch between 'auto' and 'manual' modes. This is required for FR-002 (Manual Range Override Mode) and FR-001 (Automatic Range Calculation by Default).
**Fix Applied:** Added FR-008 to spec: "Extend the AxisSpecV1 schema to include a viewportMode field ('auto' | 'manual') and ensure backward compatibility with existing graphs that don't have this field (default to 'auto')."

### Gap 2: No Auto/Manual Toggle in Admin UI

**Severity:** Critical
**Location:** `/src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`
**Issue:** The AxisConfigPanel has hardcoded input fields for X-min, X-max, Y-min, Y-max with default values of -10 to 10. There's no toggle to switch between automatic calculation and manual input mode. This violates FR-001 and FR-002.
**Fix Applied:** Added FR-002 to spec: "Authors must have the ability to override the automatic behavior and switch to a manual range configuration via a toggle/button control in the AxisConfigPanel."

### Gap 3: No Min < Max Validation

**Severity:** High
**Location:** `/src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`
**Issue:** The current code uses `Number(e.target.value) || 0` which doesn't validate that min is strictly less than max. Users could enter xMin=10 and xMax=5 which would be invalid.
**Fix Applied:** Added FR-004 to spec: "The system must enforce that the defined minimum value is always strictly less than the maximum value for each respective axis."

### Gap 4: No Numeric Validation

**Severity:** High
**Location:** `/src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`
**Issue:** The current code converts any non-numeric input to 0 using `Number(e.target.value) || 0`, which silently fails without showing an error to the user. FR-005 requires validation that only numerical values are permitted.
**Fix Applied:** Added FR-005 to spec: "Only numerical values (including negatives and decimals) are permitted."

### Gap 5: No Empty Grid Warning

**Severity:** Medium
**Location:** `/src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx` and `/src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
**Issue:** There's no logic to check if the configured viewport range excludes all graph functions. FR-006 requires displaying a warning if the range results in an empty grid.
**Fix Applied:** Added FR-006 to spec: "If the manually configured range completely excludes the drawn graph/function, the system must display a warning to the author."

### Gap 6: No Automatic Viewport Calculation

**Severity:** High
**Location:** `/src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx` and `/src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
**Issue:** The default viewport values are hardcoded as -10 to 10 in both admin and frontend rendering. There's no automatic calculation based on the graph content (functions, points, etc.). FR-001 requires automatic calculation by default.
**Fix Applied:** Added FR-001 to spec: "Graphs must automatically calculate and display their visible range based on the plotted content by default."

## Changes Made to Spec

- Added FR-001: Automatic Range Calculation by Default
- Added FR-002: Manual Range Override Mode
- Added FR-003: Manual Range Input Fields (was partially in original spec)
- Added FR-004: Min-Max Validation
- Added FR-005: Numeric Value Validation
- Added FR-006: Empty Grid Warning
- Added FR-007: Frontend Rendering Integration (consolidated from original requirements)
- Added FR-008: Viewport Schema Extension
- Updated Acceptance Criteria to include all 8 criteria from the task
- Added Guardrails section with backward compatibility requirements
- Added Open Questions section about empty grid warning behavior

## No Gaps Found

No - gaps were identified and spec was revised accordingly.
