# Gap Analysis: 260313-auto-573

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Admin JSXGraphBoard Missing Axis Config Support

**Severity:** Critical
**Location:** `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`
**Issue:** The admin JSXGraphBoard component is a simple wrapper that only accepts `showAxis` as a boolean. It doesn't pass axis configuration (including tick position) to JSXGraph. The AxisCanvas in admin uses this component to render the preview. Without supporting axisConfig in admin JSXGraphBoard, authors cannot see their tick position changes in real-time.
**Fix Applied:** Added FR-006 to require updating the admin JSXGraphBoard to accept and pass axisConfig with tick position to JSXGraph.

### Gap 2: Axis Title Positioning Implementation Details Missing

**Severity:** High
**Location:** JSXGraphBoard components (both admin and web)
**Issue:** The spec requires standardizing axis title positions (Y at top-right of vertical axis, X at far right-bottom of horizontal axis) but doesn't explain:
- How to implement via JSXGraph API
- What specific JSXGraph attributes to use
- Whether this should use label position attributes or manual text elements

JSXGraph supports `label.position` attribute for axis labels which can be used to position titles.
**Fix Applied:** Added implementation guidance in spec about using JSXGraph label position attributes.

### Gap 3: JSXGraph Type Declarations Missing Tick Position Support

**Severity:** Medium
**Location:** `src/types/jsxgraph.d.ts`
**Issue:** The JSXGraph type declarations are minimal. The current types don't expose tick position properties that JSXGraph supports natively (e.g., `position` attribute on ticks). Without proper types, TypeScript will show errors when accessing these properties.
**Fix Applied:** Added NFR-002 requiring extension of JSXGraph type declarations.

### Gap 4: Schema Backward Compatibility Not Explicitly Addressed

**Severity:** Medium
**Location:** Overall spec
**Issue:** While spec mentions default behavior, it doesn't explicitly state that:
- Schema changes must be optional (tickPosition field should not be required)
- Existing graphs without tickPosition should render with default behavior
- This is critical for backward compatibility
**Fix Applied:** Added explicit backward compatibility requirement in NFR-001.

### Gap 5: Task Scope Missing Admin JSXGraphBoard

**Severity:** High
**Location:** task.json scope
**Issue:** The task.json scope doesn't include the admin JSXGraphBoard component (`src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`). This component needs to be updated to support axisConfig.
**Fix Applied:** Updated spec to explicitly list this component in implementation details.

### Gap 6: Toggle UI Implementation Details Missing

**Severity:** Low
**Location:** AxisConfigPanel
**Issue:** The spec mentions adding toggles but doesn't specify:
- What type of toggle (checkbox, switch, or radio group)
- Label text for the toggles
- How to handle the "inverted" vs "default" state display

The admin already uses checkbox pattern in AxisConfigPanel (panel-checkbox-label class).
**Fix Applied:** Added guidance about using checkbox pattern consistent with existing admin UI.

## Changes Made to Spec

- Added FR-006: Admin JSXGraphBoard Axis Configuration Support
- Added NFR-002: JSXGraph Type Declarations Extension
- Updated NFR-001: Explicit backward compatibility requirement for optional schema fields
- Added implementation details about JSXGraph label position attributes for axis titles
- Added explicit mention of admin JSXGraphBoard in implementation details
- Added UI implementation guidance (checkbox pattern)
