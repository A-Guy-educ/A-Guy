# Graph Layout Control Feature Specification

## Overview

Enable content authors (admins) to control the visual layout and relative positioning of a graph and its accompanying explanatory text in the admin editor to optimize content presentation for students.

## ⚠️ CRITICAL GAP: Frontend Prompt Rendering

**IMPORTANT**: The current ExerciseRenderer does NOT render the prompt for geometry/axis blocks in the frontend. Looking at `ExerciseRenderer/index.tsx` lines 324-337, only the graph is rendered without the prompt. This is a critical gap that MUST be addressed - the feature requires rendering the prompt text alongside the graph based on the selected layout.

## Requirements

### Layout Configurations
Authors must have the ability to choose from four distinct layout relationships between the text and the graph:
1. **Text above, Graph below** - Vertical stack with text on top
2. **Text below, Graph above** - Vertical stack with graph on top
3. **Text to the right, Graph to the left** - Horizontal layout with graph on left
4. **Text to the left, Graph to the right** - Horizontal layout with text on left

### Default State
When a new graph component is created, the system must automatically apply the "Text to the right, Graph to the left" layout as the default.

### Device Responsiveness & Strict Layout
The chosen layout must be strictly respected across devices. Specifically, if a side-by-side layout (Text Left or Text Right) is selected, it must remain side-by-side on mobile devices (e.g., when the device is rotated to landscape), rather than automatically collapsing into a vertical stack.

### End-User Presentation
The selected layout configuration must be saved alongside the content and accurately dictate how the graph and text are rendered to the student in lessons or exercises.

## Acceptance Criteria

- [ ] Authors can select between the 4 layout options in the admin graph editor.
- [ ] "Text right, Graph left" is the default layout for new graphs.
- [ ] Selected layout is accurately reflected on the frontend for students.
- [ ] Side-by-side layouts remain side-by-side on mobile/landscape screens and do not force-stack vertically.
- [ ] Settings persist correctly after saving and reloading.

## Technical Notes

- The graph blocks are `QuestionAxisBlock` and `QuestionGeometryBlock` in the Exercises collection
- Layout will be added as a select field with 4 enum options
- The admin UI component for layout selection is an implementation detail (selector/dropdown/radio buttons)
- Frontend renderers must apply CSS flex/grid layout based on the stored layout value
- Mobile enforcement requires preventing responsive breakpoints from stacking side-by-side layouts

## Implementation Checklist

### 1. Schema Changes (`src/server/payload/collections/Exercises/schemas.ts`)
- [ ] Add `layout` field to `QuestionGeometryBlockSchema`
- [ ] Add `layout` field to `QuestionAxisBlockSchema`
- [ ] Layout enum: `textAbove | textBelow | textLeft | textRight`
- [ ] Default value: `textRight`

### 2. TypeScript Types (`src/server/payload/collections/Exercises/types.ts`)
- [ ] Add `layout` property to `QuestionGeometryBlock` interface
- [ ] Add `layout` property to `QuestionAxisBlock` interface

### 3. Default Values (`src/server/payload/collections/Exercises/defaults.ts`)
- [ ] Add `layout: 'textRight'` to `question_geometry` factory function
- [ ] Add `layout: 'textRight'` to `question_axis` factory function

### 4. Admin Editors
- [ ] **AxisEditor.tsx**: Add layout selector component
- [ ] **GeometryEditor.tsx**: Add layout selector component

### 5. Frontend Renderers - CRITICAL GAP
- [ ] **GeometryRenderer**: Add prompt rendering with layout support
- [ ] **AxisRenderer**: Add prompt rendering with layout support
- [ ] Implement CSS flex/grid layout based on `layout` value
- [ ] Ensure mobile enforcement (no responsive stacking for side-by-side)

### 6. Run After Changes
- [ ] `pnpm generate:types` - Generate Payload types
- [ ] `pnpm generate:importmap` - Regenerate import map for admin components
