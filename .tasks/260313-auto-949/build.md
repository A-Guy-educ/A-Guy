# Build Agent Report: 260313-auto-949

## Changes

### Backend Schema Changes

- **`src/server/payload/collections/Exercises/schemas.ts`**: Added `GraphLayoutSchema` enum (`textAbove`, `textBelow`, `textLeft`, `textRight`) with default value `textRight`. Added `layout` field to both `QuestionGeometryBlockSchema` and `QuestionAxisBlockSchema`.

- **`src/server/payload/collections/Exercises/types.ts`**: Added `GraphLayout` type alias. Added optional `layout?: GraphLayout` property to `QuestionGeometryBlock` and `QuestionAxisBlock` interfaces.

- **`src/server/payload/collections/Exercises/defaults.ts`**: Added `layout: 'textRight'` to both `question_geometry` and `question_axis` factory functions.

### Admin UI Changes

- **`src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx`**: Added layout selector dropdown after the Prompt section with 4 options (Text Above, Text Below, Text Left, Text Right).

- **`src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx`**: Added layout selector dropdown after the Prompt section with 4 options.

### Frontend Renderer Changes

- **`src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx`** (NEW): Created shared layout wrapper component that renders prompt text alongside graph renderer with configurable layout. Supports 4 layouts: textAbove (flex-col, prompt first), textBelow (flex-col, graph first), textLeft (flex-row, prompt first), textRight (flex-row, graph first). Side-by-side layouts use strict `flex-row` without responsive breakpoints to maintain layout on mobile. Includes minimum width threshold (`min-w-[280px]`) for graph container in side-by-side modes.

- **`src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`**: Updated geometry and axis block rendering to wrap with `GraphWithPrompt` component, passing `layout`, `prompt`, and `blockId` props.

### Test File Updates

- **`tests/unit/collections/graph-layout.test.ts`**: Updated to use the actual GraphWithPrompt component (previously placeholder). Fixed mock prompt to include `mediaIds` property.
- **`tests/unit/ui/graph-with-prompt.test.tsx`**: Updated to import actual implementation and fixed test selectors for new component structure.

## Tests Written

- `tests/unit/collections/graph-layout.test.ts` — Schema validation tests for layout field (existing file, updated)
- `tests/unit/ui/graph-with-prompt.test.tsx` — GraphWithPrompt component tests (existing file, updated)

## Deviations

None — plan followed exactly.

## Quality

- TypeScript: PASS (no errors in src/ files)
- Lint: PASS
- Unit Tests: 206 test files passed (3357 tests passed)
- Integration Tests: 14 existing exercise content tests passed (backward compatibility verified)

## Notes

- The layout field defaults to `textRight` (Text right, Graph left) as required by spec
- Side-by-side layouts strictly maintain horizontal layout on all screen sizes (no responsive breakpoints)
- Minimum width threshold of 280px applied to graph container in side-by-side layouts per clarified.md
- Backward compatible: existing geometry/axis blocks without layout field will use default `textRight`
- Frontend now renders prompt text alongside graph based on selected layout (previously prompt was only editable in admin, not displayed to students)
