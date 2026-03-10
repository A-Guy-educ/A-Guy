# Phase 2: Admin UI Support for New Question Types

## Overview

Add full admin editing capabilities for 4 new question types that integrate capabilities from the old project (`/Users/aguy/projects/aguy/Backend/handlers/exercises/exercises.model.mjs`):

1. **Matching** (`question_matching`) - Left/right column matching
2. **SVG** (`svg`) - Raw SVG markup with preview
3. **Geometry** (`question_geometry`) - Interactive geometry constructions
4. **Axis System** (`question_axis`) - Coordinate graphs with functions

## Architecture Reference

### Existing Editor Pattern

The current editor architecture follows a consistent pattern:

```
src/ui/admin/ExerciseContentEditor/
├── index.tsx              # Main editor container (block list, add/move/delete)
├── BlockTypeSelector.tsx  # Block type picker
├── RichTextEditor.tsx     # Markdown with LaTeX
├── editors/
│   ├── QuestionBlockWrapper.tsx    # Shared wrapper (header, actions)
│   ├── HintSolutionPanel.tsx       # Optional hint/solution/fullSolution
│   ├── InlineRichTextEditor.tsx    # Inline rich text editing
│   ├── McqEditor.tsx              # MCQ with options + correct answer
│   ├── TrueFalseEditor.tsx         # True/False selection
│   ├── FreeResponseEditor.tsx       # Free text/numeric/algebraic
│   └── TableEditor.tsx              # Table with solutionFill
└── utils.ts               # ID regeneration, deepClone, etc.
```

### New Block Types to Add

| Type     | Block Name          | Editor Component     |
| -------- | ------------------- | -------------------- |
| Matching | `question_matching` | `MatchingEditor.tsx` |
| SVG      | `svg`               | `SvgEditor.tsx`      |
| Geometry | `question_geometry` | `GeometryEditor.tsx` |
| Axis     | `question_axis`     | `AxisEditor.tsx`     |

---

## 1. Matching Editor (`question_matching`)

### Type Definition

```typescript
interface QuestionMatchingBlock {
  id: string
  type: 'question_matching'
  prompt: InlineRichText
  leftColumn: MatchingOption[] // Items to match FROM
  rightColumn: MatchingOption[] // Items to match TO
  correctPairs: MatchingPair[] // Answer key
  shuffleRightColumn?: boolean // UI can shuffle for display
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

interface MatchingOption {
  id: string
  content: InlineRichText
}

interface MatchingPair {
  optionId: string // ID from leftColumn
  matchId: string // ID from rightColumn that matches
}
```

### Editor Requirements

#### Left Column Editor

- Add/remove options
- Edit option content (InlineRichText)
- Drag-to-reorder (optional, Stage 2)
- Minimum: 2 options

#### Right Column Editor

- Add/remove options
- Edit option content (InlineRichText)
- Drag-to-reorder (optional, Stage 2)
- Minimum: 2 options

#### Matching Interface

- Visual line drawing between matched pairs (drag or click-to-connect)
- Visual feedback for unmatched items
- Bulk "Auto-generate pairs" button (alphabetical or index-based)
- Reset matching button

#### Correct Answer Normalization

When options are added/removed/reordered:

- Remove `correctPairs` entries with orphaned IDs
- When right column is shuffled for display, maintain correct pairs internally

#### Shuffle Toggle

- Toggle to shuffle right column for student view
- Store original order, shuffle only at render time

### Integration Points

- `BlockTypeSelector.tsx`: Add `question_matching` option
- `index.tsx`: Add case in `renderQuestionEditor` for `question_matching`
- `defaults.ts`: Add factory function for default matching block

---

## 2. SVG Editor (`svg`)

### Type Definition

```typescript
interface SvgBlock {
  id: string
  type: 'svg'
  value: string // Raw SVG markup
  altText?: string // Accessibility description
  caption?: InlineRichText
}
```

### Editor Requirements

#### SVG Input Area

- Code editor for raw SVG markup (monaco or simple textarea)
- Syntax highlighting (ideal, but textarea fallback)
- Character count / validation status

#### Live Preview

- Real-time SVG rendering below input
- Responsive canvas size (max-width: 100%)
- Error boundary for malformed SVG

#### SVG Validation

- Basic SVG structure check (root `<svg>` element)
- Allowed elements whitelist (for security):
  - `svg`, `g`, `defs`
  - Basic shapes: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`
  - `text`, `tspan`
  - `style`, `title`, `desc`
  - Transforms: `transform` attribute
- Sanitize on save (XSS prevention)

#### Accessibility

- Alt text input field
- Caption rich text editor (optional)

#### Import from File

- Upload SVG file button
- Drag-and-drop support

### Integration Points

- `BlockTypeSelector.tsx`: Add `svg` option
- `index.tsx`: Add rendering for `svg` blocks (just preview, no edit UI needed in block list)
- `defaults.ts`: Add factory function for default SVG block

---

## 3. Geometry Editor (`question_geometry`)

### Type Definition

Leverages existing `GeometrySpecV1` from [`src/infra/contracts/graphics/geometry.v1`](src/infra/contracts/graphics/geometry.v1:1):

```typescript
interface QuestionGeometryBlock {
  id: string
  type: 'question_geometry'
  prompt: InlineRichText
  geometry: GeometrySpecV1 // From contracts
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}
```

### Editor Requirements (from Old Project)

The old project's `GeometrySchema` provides comprehensive element support. The editor must support:

#### Canvas Configuration

- Width/height inputs (pixels)
- Background color picker
- Grid toggle with snap-to-grid option

#### Point Editor

- Add/remove points
- Edit coordinates (x, y)
- Position label placement (tr, tl, br, bl, etc.)
- Font size
- Visibility toggle

#### Line Editor

- Add/remove lines
- Select endpoints (point dropdown)
- Style: solid/dashed
- Thickness slider
- Color picker
- Label: value, position, font size

#### Circle Editor

- Add/remove circles
- Center point selection
- Radius input OR "through point" mode
- Style: solid/dashed
- Color picker

#### Angle Editor

- Add/remove angles
- Vertex point selection
- Ray 1 and Ray 2 point selections
- Arc radius
- Label: value, position (inside/outside), font size
- Style: arc/square

#### Triangle/Rectangle Editor

- Add/remove shapes
- Point selection (3 for triangle, 4 for rectangle)
- Style: solid/dashed
- Fill color picker
- Border color/thickness

#### Vector Editor

- Add/remove vectors
- From/to point selection
- Style/color/thickness

#### Text Element Editor

- Text value input
- Position: at point OR at coordinates
- Position label placement
- Font size

#### Advanced Elements (from Old Project)

##### Equal Segments

- Group segments that are equal
- Visual marker (hash marks) on matched segments

##### Equal Angles

- Group angles that are equal
- Visual marker (arcs) on matched angles

##### Tangents

- External point tangents
- Tangents at a point
- Common tangents between circles

##### Areas (Polygon Shading)

- Polygon vertex selection
- Style: hatch/solid
- Fill color

### Visual Canvas

- Real-time rendering of all elements
- Pan/zoom controls
- Element selection and editing via click
- Delete key to remove selected element

### Integration Points

- `BlockTypeSelector.tsx`: Add `question_geometry` option
- `index.tsx`: Add case in `renderQuestionEditor` for `question_geometry`
- `defaults.ts`: Add factory function for default geometry block

---

## 4. Axis Editor (`question_axis`)

### Type Definition

Leverages existing `AxisSpecV1` from [`src/infra/contracts/graphics/axis.v1`](src/infra/contracts/graphics/axis.v1:1):

```typescript
interface QuestionAxisBlock {
  id: string
  type: 'question_axis'
  prompt: InlineRichText
  axis: AxisSpecV1 // From contracts
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}
```

### Editor Requirements (from Old Project)

The old project's `AxisSystemSchema` provides comprehensive graphing support:

#### Axis Configuration

- Units per division (number)
- Grid toggle with color picker
- Axis color, number color, label color
- Show/hide numbers, labels
- Tick interval
- X/Y axis labels
- Origin position (x, y)

#### Viewport (Zoom/Focus)

- X min/max bounds
- Y min/max bounds
- "Reset to default" button
- Interactive pan/zoom

#### Point Editor

- Add/remove points
- Coordinates (x, y)
- Label text
- Point type: point/hole/floating_text
- Color picker
- Label position

#### Function Graph Editor

- Add/remove graphs
- Function input (e.g., `x^2`, `sin(x)`, `2*x+1`)
- Style: solid/dashed/dotted
- Thickness slider
- Color picker
- Range: from_x, to_x (optional)

#### Graph Painting/Shading

- Integral shading under graph
- Above/below graph shading
- Paint between two graphs
- Color picker for each shaded region

#### Asymptotes

- Vertical asymptotes (x = value)
- Horizontal asymptotes (y = value)

#### Geometric Loci

- Equation input (e.g., `x^2 + y^2 = 25`)
- Style: solid/dashed/dotted
- Thickness, color

#### Line Between Points

- Style, thickness, color
- Point A (x, y)
- Point B (x, y)

### Interactive Canvas

- Real-time graph rendering
- Pan/zoom controls
- Click to add points
- Hover to see coordinates

### Integration Points

- `BlockTypeSelector.tsx`: Add `question_axis` option
- `index.tsx`: Add case in `renderQuestionEditor` for `question_axis`
- `defaults.ts`: Add factory function for default axis block

---

## Implementation Stages

### Stage 1: Matching Editor

**Timebox: 1-2 days**

Deliverables:

- [ ] `MatchingEditor.tsx` component
- [ ] Left/right column CRUD
- [ ] Visual matching interface
- [ ] Normalization on option changes
- [ ] Integration with `BlockTypeSelector`
- [ ] Unit tests

### Stage 2: SVG Editor

**Timebox: 0.5-1 day**

Deliverables:

- [ ] `SvgEditor.tsx` component
- [ ] Code editor with syntax highlighting
- [ ] Live preview
- [ ] Basic SVG validation
- [ ] File upload/import
- [ ] Unit tests

### Stage 3: Geometry Editor (Basic)

**Timebox: 2-3 days**

Deliverables:

- [ ] `GeometryEditor.tsx` component
- [ ] Canvas configuration
- [ ] Point/Line/Circle editors
- [ ] Basic shape rendering
- [ ] Unit tests

### Stage 4: Geometry Editor (Advanced)

**Timebox: 2-3 days**

Deliverables:

- [ ] Angle editor with visual feedback
- [ ] Triangle/Rectangle editors
- [ ] Vector editor
- [ ] Text element editor
- [ ] Equal segments/angles markers
- [ ] Tangents support
- [ ] Areas/shading

### Stage 5: Axis Editor (Basic)

**Timebox: 2 days**

Deliverables:

- [ ] `AxisEditor.tsx` component
- [ ] Axis configuration UI
- [ ] Point editor
- [ ] Basic function graphing
- [ ] Unit tests

### Stage 6: Axis Editor (Advanced)

**Timebox: 2-3 days**

Deliverables:

- [ ] Graph painting/shading
- [ ] Asymptotes
- [ ] Geometric loci
- [ ] Line between points
- [ ] Interactive pan/zoom

---

## File Structure

```
src/ui/admin/ExerciseContentEditor/
├── editors/
│   ├── MatchingEditor.tsx       # NEW
│   ├── SvgEditor.tsx          # NEW
│   ├── GeometryEditor.tsx      # NEW
│   └── AxisEditor.tsx          # NEW
├── components/
│   ├── geometry/               # NEW - Geometry sub-components
│   │   ├── Canvas.tsx
│   │   ├── PointEditor.tsx
│   │   ├── LineEditor.tsx
│   │   ├── CircleEditor.tsx
│   │   ├── AngleEditor.tsx
│   │   ├── ShapeEditor.tsx
│   │   └── ElementsList.tsx
│   ├── axis/                   # NEW - Axis sub-components
│   │   ├── GraphEditor.tsx
│   │   ├── PointList.tsx
│   │   ├── AsymptoteEditor.tsx
│   │   └── LocusEditor.tsx
│   ├── matching/               # NEW - Matching sub-components
│   │   ├── ColumnEditor.tsx
│   │   ├── MatchingLines.tsx
│   │   └── PairManager.tsx
│   └── svg/                    # NEW - SVG sub-components
│       ├── CodeEditor.tsx
│       ├── Preview.tsx
│       └── Validator.tsx
├── utils/
│   ├── geometry.ts             # NEW - Geometry helpers
│   └── axis.ts                # NEW - Axis helpers
└── defaults.ts                 # UPDATE - Add factory functions
```

---

## Testing Strategy

### Unit Tests

- Normalization functions (matching pairs, geometry constraints)
- SVG validation logic
- Geometry element validation
- Axis function parsing

### Component Tests

- Render each editor without errors
- Simulate edits and verify output shape
- Test error states

### Integration Tests

- Create exercise with each new block type
- Edit via admin UI
- Save and verify server-side validation passes

---

## Dependencies

1. **SVG Syntax Highlighting** - Consider `prismjs` or `monaco-editor` for SVG code editor
2. **Math Expression Parsing** - For function input validation in Axis editor
3. **Canvas Rendering** - Can reuse existing rendering logic from web exercise renderer

---

## Backward Compatibility

- All new editors are additive
- Existing exercises remain editable
- Unknown block types fall back to JSON inspector
- No schema migrations required

---

## Security Considerations

1. **SVG Sanitization** - Never render unsanitized SVG (XSS risk)
2. **Function Input Validation** - Prevent code injection through function strings
3. **Coordinate Bounds** - Validate all coordinate inputs are within reasonable bounds
