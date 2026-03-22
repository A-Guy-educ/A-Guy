# Multi-Graph Support in Exercises - Specification

## Overview

Enable content authors (admins) to display multiple distinct graph coordinate systems (up to 4) side-by-side within a single exercise block to support complex comparisons and multi-step math problems.

## Requirements

### FR-001: Multi-Graph Support

**Priority**: MUST
**Description**: Authors must be able to add and configure up to 4 separate graphs within the same exercise block.

### FR-002: Graph Labels (Individual Titles)

**Priority**: MUST
**Description**: Each individual graph must have a default label (e.g., "גרף 1", "גרף 2", etc.). Authors must have the ability to explicitly edit and customize the label for each graph.

### FR-003: Global Explanatory Text Positioning

**Priority**: MUST
**Description**: Any global explanatory text associated with this multi-graph block must be positioned either entirely *above* or entirely *below* the group of graphs.

### FR-004: Desktop Layout - Side-by-Side Horizontal

**Priority**: MUST
**Description**: All graphs within the group must be displayed side-by-side horizontally on desktop. Each graph must automatically render at an exactly equal width to maintain visual consistency.

### FR-005: Mobile Layout - 2-per-row Grid

**Priority**: MUST
**Description**: On smaller screens (mobile devices), the system must constrain the display to a maximum of 2 graphs side-by-side per row. If 3 or 4 graphs are configured, they must wrap to a second row (e.g., a 2x2 grid).

### FR-006: Single Graph Full Width

**Priority**: MUST
**Description**: If only 1 graph is configured in the group, it must occupy the full available width.

### FR-007: Graph Ordering

**Priority**: MUST
**Description**: Authors must have the ability to explicitly define and reorder the display sequence of the graphs.

### FR-008: End-User Presentation

**Priority**: MUST
**Description**: The configured graphs, their custom labels, their specific order, and the shared text layout must be saved and accurately presented to the student.

## Acceptance Criteria

- [ ] Admins can add up to 4 separate graph coordinate systems in a single exercise block.
- [ ] Each graph receives a default label ("גרף 1", "גרף 2", etc.) which can be edited.
- [ ] Graphs render side-by-side horizontally on desktop at equal widths.
- [ ] On mobile devices, graphs wrap into a maximum 2-per-row grid (e.g., a 2x2 layout for 4 graphs).
- [ ] A single graph configuration occupies the full available width.
- [ ] Admins can reorder the display sequence of the graphs.
- [ ] Global explanatory text can be positioned entirely above or entirely below the graph group.
- [ ] Layout, labels, order, and text configurations are saved and correctly presented to end users.

## Guardrails

- **Existing axis block compatibility**: The existing `question_axis` block type must continue to work as before (no breaking changes).
- **Reuse existing JSXGraphBoard**: The multi-graph renderer must reuse the existing `JSXGraphBoard` component and AxisRenderer logic from `src/ui/web/exerciserenderer/blocks/AxisRenderer/`.
- **TypeScript safety**: All new types must be properly defined and inferred from Zod schemas in `src/server/payload/collections/Exercises/schemas.ts`.
- **No breaking changes to ContentBlockSchema**: New block type must be added as an additional union member, not replacing existing ones.
- **Zod schema validation**: New block schema must follow the same patterns as existing block schemas (e.g., QuestionAxisBlockSchema, QuestionGeometryBlockSchema).

## Out of Scope

- **Admin UI implementation**: The admin editor component for configuring multi-graph blocks is not covered in this spec (handled in later implementation stage).
- **Backend collection changes**: No changes to the Exercises collection config itself (only schema changes to the content field).
- **AI/LLM integration**: No changes to AI-assisted graph generation.
- **PDF export**: Multi-graph layout in PDF exports is not covered.
- **Print styles**: Special print styles for multi-graph blocks are not covered.

## Technical Implementation Notes

Based on codebase analysis at `src/server/payload/collections/Exercises/schemas.ts` and `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`:

1. **New block type**: Create `QuestionMultiAxisBlockSchema` as a new discriminated union member in `ContentBlockSchema` (line 525-537)

2. **Data structure**: Store graphs as an array with:
   - `id`: string (unique identifier)
   - `label`: string (default: "גרף 1", "גרף 2", etc.)
   - `axis`: AxisSpecV1 (the graph specification)
   - `order`: number (display order)

3. **Text positioning**: Add `textPosition` enum field with values 'above' | 'below'

4. **Renderer**: Create `MultiAxisRenderer` component in `src/ui/web/exerciserenderer/blocks/MultiAxisRenderer/` that:
   - Maps through the graphs array (sorted by order)
   - Renders each graph using existing AxisRenderer
   - Applies responsive grid layout classes using Tailwind CSS

5. **ExerciseRenderer update**: Add dispatch case for new `question_multi_axis` block type in the switch statement (around line 328)

6. **Use Grid component**: Prefer using the existing `Grid` component from `src/ui/web/shared/Layout/Grid.tsx` for responsive columns, or use Tailwind grid classes: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. For single graph, use `grid-cols-1` for full width.

7. **Type updates in two places**: Update both:
   - `src/server/payload/collections/Exercises/schemas.ts` — Add Zod schema
   - `src/server/payload/collections/Exercises/types.ts` — Add TypeScript interface (exported as `QuestionMultiAxisBlock`)

8. **Sorting by order**: Ensure graphs are sorted by the `order` field before rendering:
   ```typescript
   {graphs.sort((a, b) => a.order - b.order).map(g => <AxisRenderer ... />)}
   ```
