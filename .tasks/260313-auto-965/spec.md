# Spec: 260313-auto-965

## Overview

Configure Graph Display Range (X and Y) in Admin Graph Editor. Enable content authors (admins) to manually control the visible display area (X and Y axes) of graphs within the Admin Graph Editor, ensuring students see a specifically framed portion of the graph.

## Requirements

### FR-001: Automatic Range Calculation by Default

**Priority**: MUST
**Description**: Graphs must automatically calculate and display their visible range based on the plotted content by default. The system should analyze all graph functions, points, and elements to determine an appropriate viewport that includes all content with reasonable padding.

### FR-002: Manual Range Override Mode

**Priority**: MUST
**Description**: Authors must have the ability to override the automatic behavior and switch to a manual range configuration via a toggle/button control in the AxisConfigPanel.

### FR-003: Manual Range Input Fields

**Priority**: MUST
**Description**: When manual mode is active, authors must be able to specify the minimum and maximum visible boundaries for both the X-axis and the Y-axis using input fields:
- xMin: Minimum visible X value
- xMax: Maximum visible X value
- yMin: Minimum visible Y value
- yMax: Maximum visible Y value

### FR-004: Min-Max Validation

**Priority**: MUST
**Description**: The system must enforce that the defined minimum value is always strictly less than the maximum value for each respective axis. Display validation error if xMin >= xMax or yMin >= yMax.

### FR-005: Numeric Value Validation

**Priority**: MUST
**Description**: Only numerical values (including negatives and decimals) are permitted. The input fields should accept numeric values and display an error for non-numeric input.

### FR-006: Empty Grid Warning

**Priority**: SHOULD
**Description**: If the manually configured range completely excludes the drawn graph/function (i.e., all graph y-values fall outside the visible y-range), the system must display a warning to the author. This should be a non-blocking warning that allows saving but alerts the author.

### FR-007: Frontend Rendering Integration

**Priority**: MUST
**Description**: The manually configured limits must be saved with the graph and accurately reflect the visible area when rendered for students in exercises, lessons, or exams. Students do not have access to alter these display ranges. The frontend JSXGraphBoard component must use the configured viewport values.

### FR-008: Viewport Schema Extension

**Priority**: MUST
**Description**: Extend the AxisSpecV1 schema to include a viewportMode field ('auto' | 'manual') and ensure backward compatibility with existing graphs that don't have this field (default to 'auto').

## Acceptance Criteria

- [ ] Graph range is automatic by default (viewportMode defaults to 'auto')
- [ ] Admin user can switch to manual configuration mode via toggle
- [ ] Admin user can input X-min, X-max, Y-min, Y-max values when in manual mode
- [ ] System validates that Min < Max for both axes (displays error)
- [ ] System validates that inputs are numeric (displays error)
- [ ] System displays a warning if the configured range results in an empty grid (excludes the function)
- [ ] The manually set range correctly controls the visible graph area in the admin preview
- [ ] Settings are saved and correctly rendered on the student-facing frontend

## Guardrails

- **Backward Compatibility**: Existing graphs without viewportMode should default to automatic calculation
- **Data Integrity**: The viewport values must be stored in the existing AxisSpecV1 structure under the viewport field
- **No Breaking Changes**: The frontend rendering must continue to work for graphs that don't have manual viewport settings

## Out of Scope

- Automatic viewport calculation algorithm details (the specific algorithm for calculating auto-viewport is implementation-specific)
- Real-time auto-update while editing graphs (manual refresh is acceptable)
- Zoom/pan functionality for end-users (students)
- Saving multiple viewport presets

## Open Questions

- Should the empty grid warning be a validation error (blocking save) or a warning (allowing save)? Based on the task description, it should be a warning (non-blocking).
