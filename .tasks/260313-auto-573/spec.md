# Axis Label/Tick Position Configuration - Specification

## Overview

Enable content authors (admins) to control the placement of axis numbering (ticks) while standardizing the precise location of the axis titles (X/Y labels) within the Graph Editor.

## Requirements

### FR-001: Standardized Axis Title Positioning

**Priority**: MUST
**Description**: 
- Y-Axis title must always be displayed near the top (positive end) of the vertical axis, positioned slightly to the right.
- X-Axis title must always be displayed near the far right (positive end) of the horizontal axis, positioned slightly below it.
- Implementation: Use JSXGraph axis label position attributes (e.g., `label.position: 'l'` for left-side Y labels shifted up, `label.position: 'b'` for bottom-side X labels shifted right).
- These positions should be the default and cannot be modified by authors (standardized layout).

### FR-002: X-Axis Tick Position Configuration

**Priority**: MUST
**Description**: 
- Admin graph editor must include a toggle to invert X-axis numbering (tick) position.
- X-axis numbers can appear either above (default) or below the horizontal axis line.
- Implementation: JSXGraph supports `position` attribute on axis ticks - use 'bottom' (default) or 'top' (inverted).
- This configuration must be saved with the graph spec.

### FR-003: Y-Axis Tick Position Configuration

**Priority**: MUST
**Description**: 
- Admin graph editor must include a toggle to invert Y-axis numbering (tick) position.
- Y-axis numbers can appear either to the left (default) or to the right of the vertical axis line.
- Implementation: JSXGraph supports `position` attribute on axis ticks - use 'left' (default) or 'right' (inverted).
- This configuration must be saved with the graph spec.

### FR-004: Default Tick Placement Behavior

**Priority**: MUST
**Description**: 
- Existing and new graphs must default to standard numbering placement (X above/bottom, Y left) unless explicitly modified by author.
- Current graphs should continue to render as before when no tick position is specified.
- The tickPosition field must be optional in the schema to maintain backward compatibility.

### FR-005: Student View Rendering

**Priority**: MUST
**Description**: 
- Tick placement configurations must be accurately rendered when displayed to students.
- Students cannot interact with or change these settings - they only view the configured axis.
- Web JSXGraphBoard (`src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`) must pass tick position to JSXGraph axis options.

### FR-006: Admin JSXGraphBoard Axis Configuration Support

**Priority**: MUST
**Description**: 
- Admin JSXGraphBoard (`src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`) must be extended to accept axisConfig prop.
- AxisCanvas (`src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx`) must pass axisConfig including tick position to JSXGraphBoard.
- This enables real-time preview of tick position changes in the admin editor.

### NFR-001: Schema Extension with Backward Compatibility

**Priority**: MUST
**Description**: 
- The AxisSpecV1 schema in `src/infra/contracts/graphics/axis.v1.ts` must be extended with optional tickPosition fields.
- Schema must maintain backward compatibility: tickPosition field must be optional with defaults.
- Existing graphs without tickPosition should render with default behavior.
- Schema structure:
```typescript
tickPosition: z.object({
  x: z.enum(['default', 'inverted']).default('default'),
  y: z.enum(['default', 'inverted']).default('default'),
}).optional()
```

### NFR-002: JSXGraph Type Declarations Extension

**Priority**: MUST
**Description**: 
- The JSXGraph type declarations (`src/types/jsxgraph.d.ts`) must be extended to support tick position properties.
- Add support for axis ticks `position` attribute.
- Add support for axis label `position` attribute.

## Acceptance Criteria

- [ ] Y-Axis title is permanently positioned near the top (positive end) of the vertical axis, slightly to the right.
- [ ] X-Axis title is permanently positioned near the far right (positive end) of the horizontal axis, slightly below it.
- [ ] Admin graph editor includes a toggle to invert X-axis numbering (above/below).
- [ ] Admin graph editor includes a toggle to invert Y-axis numbering (left/right).
- [ ] Existing and new graphs default to standard numbering placement unless modified.
- [ ] Tick placement configurations are saved correctly and reflect on the student's end accurately.

## Technical Implementation

### Files to Modify

1. **Schema** (`src/infra/contracts/graphics/axis.v1.ts`)
   - Extend `AxesSchema` with optional tick position configuration

2. **Type Declarations** (`src/types/jsxgraph.d.ts`)
   - Add tick position and label position properties to support JSXGraph attributes

3. **Admin JSXGraphBoard** (`src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`)
   - Add axisConfig prop to support tick position rendering in admin

4. **Admin AxisCanvas** (`src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx`)
   - Pass axisConfig including tick position to JSXGraphBoard

5. **Admin AxisConfigPanel** (`src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`)
   - Add toggle controls for X and Y tick position (use checkbox pattern: `panel-checkbox-label`)

6. **Web JSXGraphBoard** (`src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`)
   - Pass tick position configuration to JSXGraph axis options

7. **Web AxisRenderer** (`src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`)
   - Pass saved tick position config to JSXGraphBoard

### JSXGraph Implementation Details

**Axis Title Positioning:**
- Y-axis: Use `defaultAxes.y.label.position: 'l'` (left side) with offset to shift up
- X-axis: Use `defaultAxes.x.label.position: 'b'` (bottom) with offset to shift right

**Tick Position:**
- X-axis: `defaultAxes.x.ticks.position: 'bottom'` (default) or `'top'` (inverted)
- Y-axis: `defaultAxes.y.ticks.position: 'left'` (default) or `'right'` (inverted)
