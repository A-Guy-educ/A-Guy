# Phase 2: Admin UI for New Question Types — Implementation Plan

## Overview

Add full admin editing capabilities for 4 new question types that already have types and schemas defined but lack dedicated admin editors:

1. **Matching** (`question_matching`) — Left/right column matching with visual line-drawing
2. **SVG** (`svg`) — Raw SVG markup with live preview
3. **Geometry** (`question_geometry`) — Interactive Euclidean geometry canvas (JSXGraph)
4. **Axis** (`question_axis`) — Interactive Cartesian graph canvas (JSXGraph)

## Scope

- **Admin editors only** — student-facing web renderers remain "Not Supported" stubs
- **Side-by-side UX** for Geometry/Axis: form panel (left) + interactive canvas (right)
- **Matching**: visual SVG line-drawing for pair connections from day one
- **Rendering library**: JSXGraph (covers both Euclidean geometry and Cartesian graphs)
- **1 new dependency**: `jsxgraph` (+ types)

## What Already Exists (Do NOT Rebuild)

| Asset                                 | Location                                              | Status |
| ------------------------------------- | ----------------------------------------------------- | ------ |
| TypeScript interfaces for all 4 types | `src/shared/exercise-content/types.ts`                | Done   |
| Zod schemas for all 4 types           | `src/server/payload/collections/Exercises/schemas.ts` | Done   |
| GeometrySpecV1 contract               | `src/infra/contracts/graphics/geometry.v1.ts`         | Done   |
| AxisSpecV1 contract                   | `src/infra/contracts/graphics/axis.v1.ts`             | Done   |
| Example JSON data                     | `src/infra/contracts/examples/*.example.json`         | Done   |
| SVG sanitizer                         | `src/ui/admin/shared/utils.ts` -> `sanitizeSvg()`     | Done   |
| Math expression evaluator             | `src/ui/web/exerciserenderer/utils/safeMathEval.ts`   | Done   |
| Syntax highlighting                   | `prism-react-renderer` (already installed)            | Done   |
| ContentBlock union (10 types)         | `src/shared/exercise-content/types.ts`                | Done   |

---

## Stages Overview

| Stage | What                                                 | Estimated Time | Dependencies                 |
| ----- | ---------------------------------------------------- | -------------- | ---------------------------- |
| 0     | Foundation (defaults, BlockTypeSelector, routing)    | 1 day          | None                         |
| 1     | Matching Editor                                      | 2-3 days       | Stage 0                      |
| 2     | SVG Editor                                           | 1 day          | Stage 0                      |
| 3     | JSXGraph Integration + React Wrapper                 | 2-3 days       | None (can parallel with 1-2) |
| 4     | Geometry Editor (Basic: points, lines, circles)      | 3-4 days       | Stage 3                      |
| 5     | Geometry Editor (Advanced: angles, shapes, tangents) | 3-5 days       | Stage 4                      |
| 6     | Axis Editor (Basic: config, points, graphs)          | 3-4 days       | Stage 3                      |
| 7     | Axis Editor (Advanced: shading, asymptotes, loci)    | 3-4 days       | Stage 6                      |

**Total: ~18-24 working days (4-5 weeks)**

---

## Architecture Reference

### Existing Editor Pattern

Every question-type editor in this codebase follows a strict, consistent pattern. All new editors MUST follow this pattern exactly.

**Component tree:**

```
ExerciseContentEditor (root, manages localValue state)
  -> BlockList (renders blocks)
    -> renderQuestionEditor() (type-switch dispatcher)
      -> QuestionBlockWrapper (chrome: header, actions, JSON panel)
        -> [SpecificEditor] (e.g. McqEditor, MatchingEditor)
          -> InlineRichTextEditor (for prompt, option content)
          -> HintSolutionPanel (for hint/solution/fullSolution)
```

**Editor props pattern (EVERY editor uses this):**

```typescript
interface XxxEditorProps {
  block: SpecificBlockType
  onChange: (block: SpecificBlockType) => void // Always receives the FULL updated block
}
```

**Section structure pattern (EVERY section in EVERY editor uses this):**

```tsx
<div className="question-editor-section">
  <label className="question-editor-label">Label Text</label>
  {/* Section content */}
</div>
```

**HintSolutionPanel pattern (ALWAYS the last section in EVERY question editor):**

```tsx
<div className="question-editor-section">
  <HintSolutionPanel
    hint={block.hint}
    solution={block.solution}
    fullSolution={block.fullSolution}
    onChange={(field, value) => onChange({ ...block, [field]: value })}
  />
</div>
```

**onChange propagation chain:**

1. Editor calls `onChange(entireUpdatedBlock)` — always sends the full block, never a partial
2. `renderQuestionEditor` wraps this: `(updatedBlock) => onUpdateBlock(block.id, updatedBlock)`
3. `handleUpdateBlock` does a `blocks.map()` replacing the matched block by ID
4. `updateLocalValue` stores the new `{ blocks: newBlocks }` in local state

**CSS convention:**

- All styles in `src/ui/admin/ExerciseContentEditor/index.css`
- Vanilla CSS (NO Tailwind, NO CSS modules, NO SCSS)
- BEM-lite naming: `.editor-name`, `.editor-name-child`, `.editor-name-child--variant`
- Uses Payload CSS variables: `--theme-elevation-*`, `--theme-info-*`, `--theme-error-*`, `--theme-success-*`
- Lucide icons from `lucide-react` (already installed)

**File header:**

Every new editor file starts with `'use client'` (all admin editors use React state/effects).

### Key Files to Reference

| File                                           | What It Shows                                         |
| ---------------------------------------------- | ----------------------------------------------------- |
| `editors/FreeResponseEditor.tsx` (86 lines)    | Simplest editor — copy this as your starting template |
| `editors/McqEditor.tsx` (179 lines)            | List CRUD pattern (add/remove/reorder options)        |
| `editors/TableEditor.tsx` (304 lines)          | Most complex editor — nested data, answer keys        |
| `editors/normalizers.ts` (295 lines)           | Business logic normalization pattern                  |
| `editors/InlineRichTextEditor.tsx` (189 lines) | Reusable rich text sub-editor                         |
| `editors/HintSolutionPanel.tsx` (101 lines)    | Optional field add/remove pattern                     |
| `editors/QuestionBlockWrapper.tsx` (92 lines)  | Chrome wrapper with header and JSON panel             |
| `utils.ts` (52 lines)                          | `generateId()` and `deepCloneBlock()`                 |

---

## Stage 0: Foundation

**Goal**: Wire up the 4 new block types into the existing admin editor infrastructure so they appear in the block picker and route to placeholder editors.

### Task 0.1: Add Default Factory Functions

**File**: `src/shared/exercise-content/defaults.ts`

Add 4 new entries to the `ExerciseBlockDefaults` record. Each factory must return a complete, valid block with a fresh `generateId()` and sensible defaults.

**`question_matching` factory:**

```typescript
question_matching: (): QuestionMatchingBlock => ({
  id: generateId(),
  type: 'question_matching',
  prompt: createDefaultInlineRichText(),
  leftColumn: [
    { id: generateId(), content: createDefaultInlineRichText() },
    { id: generateId(), content: createDefaultInlineRichText() },
  ],
  rightColumn: [
    { id: generateId(), content: createDefaultInlineRichText() },
    { id: generateId(), content: createDefaultInlineRichText() },
  ],
  correctPairs: [],
  shuffleRightColumn: false,
}),
```

**Why**: Starts with 2 empty options per column (minimum required). No pairs yet — admin draws them.

**`svg` factory:**

```typescript
svg: (): SvgBlock => ({
  id: generateId(),
  type: 'svg',
  value: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n  <circle cx="100" cy="100" r="50" fill="none" stroke="black" />\n</svg>',
  altText: '',
}),
```

**Why**: Starts with a simple circle so the preview renders immediately instead of being empty.

**`question_geometry` factory:**

```typescript
question_geometry: (): QuestionGeometryBlock => ({
  id: generateId(),
  type: 'question_geometry',
  prompt: createDefaultInlineRichText(),
  geometry: {
    kind: 'euclidean',
    canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
    elements: {
      points: [
        { name: 'A', x: 150, y: 100, position: 'tl' as const, visible: true },
        { name: 'B', x: 350, y: 100, position: 'tr' as const, visible: true },
        { name: 'C', x: 250, y: 300, position: 'b' as const, visible: true },
      ],
      lines: [],
      circles: [],
      angles: [],
    },
    interactionSpec: {
      enabled: false,
      toolsAllowed: [],
      evaluation: { mode: 'none' as const },
    },
  },
}),
```

**Why**: Starts with a triangle (3 points) so the canvas isn't empty. Grid enabled by default.

**`question_axis` factory:**

```typescript
question_axis: (): QuestionAxisBlock => ({
  id: generateId(),
  type: 'question_axis',
  prompt: createDefaultInlineRichText(),
  axis: {
    kind: 'cartesian',
    units: 1,
    grid: { enabled: true, color: '#e0e0e0' },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: { x: 'x', y: 'y' },
      origin: { x: 0, y: 0 },
    },
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    elements: { points: [], graphs: [] },
  },
}),
```

**Why**: Standard -10..10 coordinate plane with grid. Empty elements — admin adds functions/points.

**Import the types** at the top of `defaults.ts`:

```typescript
import type {
  QuestionMatchingBlock,
  SvgBlock,
  QuestionGeometryBlock,
  QuestionAxisBlock,
} from './types'
```

> **Note**: `createDefaultInlineRichText()` already exists as a helper in this file. Find it and reuse it. It returns `{ type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] }`.

---

### Task 0.2: Add Block Types to BlockTypeSelector

**File**: `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx`

Add 4 entries to the `blockTypes` array (after the existing 5 entries):

```typescript
{
  type: 'question_matching',
  label: 'Matching',
  description: 'Match items between two columns',
  icon: ArrowRightLeft,
},
{
  type: 'svg',
  label: 'SVG Image',
  description: 'Raw SVG markup with live preview',
  icon: Image,
},
{
  type: 'question_geometry',
  label: 'Geometry',
  description: 'Interactive geometry diagram',
  icon: Triangle,
},
{
  type: 'question_axis',
  label: 'Axis Graph',
  description: 'Coordinate graph with functions',
  icon: LineChart,
},
```

**Add to the import statement** at the top of the file:

```typescript
import {
  CheckSquare,
  Edit3,
  FileText,
  List,
  Table as TableIcon,
  X,
  ArrowRightLeft,
  Image,
  Triangle,
  LineChart, // <-- add these
} from 'lucide-react'
```

> **Note**: The `type` string must EXACTLY match the key in `ExerciseBlockDefaults`. This is how the block type selector creates new blocks.

---

### Task 0.3: Add Labels to `getBlockTypeLabel`

**File**: `src/ui/admin/ExerciseContentEditor/index.tsx` (line ~446)

Current code:

```typescript
function getBlockTypeLabel(block: ContentBlock): string {
  if (block.type === 'question_select' && block.variant === 'true_false') return 'True / False'
  if (block.type === 'question_select' && block.variant === 'mcq') return 'Multiple Choice'
  if (block.type === 'question_free_response') return 'Free Response'
  if (block.type === 'question_table') return 'Table Question'
  return block.type
}
```

Add these 4 lines **before** the `return block.type` fallback:

```typescript
if (block.type === 'question_matching') return 'Matching'
if (block.type === 'svg') return 'SVG Image'
if (block.type === 'question_geometry') return 'Geometry'
if (block.type === 'question_axis') return 'Axis Graph'
```

---

### Task 0.4: Add Routes in `renderQuestionEditor`

**File**: `src/ui/admin/ExerciseContentEditor/index.tsx` (line ~547, before the fallback `return <JSONInspector ...>`)

Add 4 new `if` blocks. For now, each renders a `<div>TODO</div>` inside `QuestionBlockWrapper`. This verifies the wiring works before building actual editors.

**Copy this pattern exactly** (it's identical to the existing blocks like `question_table` at lines 527-546):

```typescript
if (block.type === 'question_matching') {
  return (
    <QuestionBlockWrapper
      blockType={getBlockTypeLabel(block)}
      block={block}
      onBlockChange={onChange}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      canMoveUp={blockIndex > 0}
      canMoveDown={blockIndex < blockCount - 1}
      canDelete={blockCount > 1}
    >
      <div style={{ padding: 16, color: '#999' }}>TODO: MatchingEditor</div>
    </QuestionBlockWrapper>
  )
}
if (block.type === 'svg') {
  return (
    <QuestionBlockWrapper
      blockType={getBlockTypeLabel(block)}
      block={block}
      onBlockChange={onChange}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      canMoveUp={blockIndex > 0}
      canMoveDown={blockIndex < blockCount - 1}
      canDelete={blockCount > 1}
    >
      <div style={{ padding: 16, color: '#999' }}>TODO: SvgEditor</div>
    </QuestionBlockWrapper>
  )
}
if (block.type === 'question_geometry') {
  return (
    <QuestionBlockWrapper
      blockType={getBlockTypeLabel(block)}
      block={block}
      onBlockChange={onChange}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      canMoveUp={blockIndex > 0}
      canMoveDown={blockIndex < blockCount - 1}
      canDelete={blockCount > 1}
    >
      <div style={{ padding: 16, color: '#999' }}>TODO: GeometryEditor</div>
    </QuestionBlockWrapper>
  )
}
if (block.type === 'question_axis') {
  return (
    <QuestionBlockWrapper
      blockType={getBlockTypeLabel(block)}
      block={block}
      onBlockChange={onChange}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      canMoveUp={blockIndex > 0}
      canMoveDown={blockIndex < blockCount - 1}
      canDelete={blockCount > 1}
    >
      <div style={{ padding: 16, color: '#999' }}>TODO: AxisEditor</div>
    </QuestionBlockWrapper>
  )
}
```

---

### Task 0.5: Update `deepCloneBlock`

**File**: `src/ui/admin/ExerciseContentEditor/utils.ts`

The `deepCloneBlock` function regenerates IDs when duplicating blocks. Currently it handles MCQ (remaps option IDs and correctOptionIds) and table (no-op). Add a case for `question_matching` which also has nested objects with IDs.

Add this `else if` block after the existing `question_table` case (line ~44):

```typescript
} else if (cloned.type === 'question_matching') {
  // Regenerate left/right column option IDs and remap correctPairs
  const oldToNewLeft = new Map<string, string>()
  const oldToNewRight = new Map<string, string>()

  cloned.leftColumn = cloned.leftColumn.map((opt) => {
    const newId = generateId()
    oldToNewLeft.set(opt.id, newId)
    return { ...opt, id: newId }
  })
  cloned.rightColumn = cloned.rightColumn.map((opt) => {
    const newId = generateId()
    oldToNewRight.set(opt.id, newId)
    return { ...opt, id: newId }
  })
  cloned.correctPairs = cloned.correctPairs.map((pair) => ({
    optionId: oldToNewLeft.get(pair.optionId) || pair.optionId,
    matchId: oldToNewRight.get(pair.matchId) || pair.matchId,
  }))
}
// SVG, geometry, and axis blocks have no nested IDs to regenerate — JSON.parse deep copy is sufficient
```

---

### Task 0.6: Verify Stage 0

Run these checks:

1. `pnpm tsc --noEmit` — must pass with no type errors
2. `pnpm generate:importmap` — regenerate admin import maps
3. Open admin UI, navigate to an exercise, click "Add Block"
4. Verify all 4 new types appear in the block picker grid
5. Add one of each type — verify each shows "TODO: XxxEditor" inside a `QuestionBlockWrapper` with the correct label
6. Verify move up/down, duplicate, and delete buttons work on the new blocks
7. Click the JSON toggle in the wrapper — verify the JSON inspector shows correct default data
8. Save the exercise — verify no server validation errors (check Network tab for 200 response)

---

## Stage 1: Matching Editor

**Goal**: Full matching question editor with left/right column CRUD and visual SVG line-drawing for pair connections.

### File Structure

```
src/ui/admin/ExerciseContentEditor/
  editors/
    MatchingEditor.tsx              # Main editor component
  components/
    matching/
      ColumnEditor.tsx              # Reusable left/right column editor
      MatchingLines.tsx             # SVG line-drawing between columns
```

---

### Task 1.1: Create `ColumnEditor.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/components/matching/ColumnEditor.tsx`

This is a reusable component for editing either the left or right column. It manages a list of `MatchingOption` items with add/remove/edit.

**Props:**

```typescript
interface ColumnEditorProps {
  label: string // "Left Column" or "Right Column"
  options: MatchingOption[] // The column's options array
  onChange: (options: MatchingOption[]) => void // Callback with full new array
  minOptions?: number // Default: 2
}
```

**What it renders:**

- A `question-editor-label` with the `label` text
- A vertical list of option rows
- Each row contains:
  - A drag handle icon (`GripVertical` from lucide — just visual for now, no drag logic)
  - A number badge (1, 2, 3...)
  - An `InlineRichTextEditor` for the option content
  - A remove button (`Trash2` icon, disabled when at `minOptions`)
- An "Add Option" button at the bottom (`Plus` icon + "Add Option" text)

**Handlers:**

- `handleAddOption`: Creates `{ id: generateId(), content: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] } }`, appends to array, calls `onChange`
- `handleRemoveOption(optionId)`: Filters out option (if `options.length > minOptions`), calls `onChange`
- `handleOptionContentChange(optionId, newContent)`: Maps over options, replaces matching option's content, calls `onChange`

**Pattern reference**: This is very similar to how `McqEditor.tsx` handles its options list (lines 85-138). Follow that exact structure.

---

### Task 1.2: Create `MatchingLines.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/components/matching/MatchingLines.tsx`

This is the visual matching interface. It renders two columns of items with an SVG overlay between them for drawing connection lines.

**Props:**

```typescript
interface MatchingLinesProps {
  leftColumn: MatchingOption[]
  rightColumn: MatchingOption[]
  correctPairs: MatchingPair[]
  onChange: (pairs: MatchingPair[]) => void
}
```

**Layout:**

```
+------------------+     SVG layer     +------------------+
| Left Item 1    (o)---bezier-curve---(o) Right Item 1    |
| Left Item 2    (o)                  (o) Right Item 2    |
| Left Item 3    (o)---bezier-curve---(o) Right Item 3    |
+------------------+                   +------------------+
```

**How the layout works:**

1. A container div (`matching-lines-container`) with `position: relative` and `display: flex`
2. Left column div (`matching-lines-column`) — renders left items
3. Gap space (60px) — where lines are drawn
4. Right column div (`matching-lines-column`) — renders right items
5. An SVG element (`matching-lines-svg`) with `position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none` — overlays the entire container

Each item is a div (`matching-lines-item`) with a connector dot (`matching-connector-dot`) positioned on the edge:

- Left items: dot on the right edge (`right: -6px`)
- Right items: dot on the left edge (`left: -6px`)

**Interaction model:**

1. **State**: `pendingLeft: string | null` — the left option ID that was clicked but not yet paired
2. **Click left dot**: Set `pendingLeft = optionId`. If this left item already has a pair, remove it first.
3. **Click right dot** while `pendingLeft` is set: Create pair `{ optionId: pendingLeft, matchId: rightOptionId }`. If this right item already has a pair, replace it. Call `onChange`. Clear `pendingLeft`.
4. **Click existing line**: Remove that pair. Call `onChange`.
5. **Click anywhere else / press Escape**: Clear `pendingLeft`.

**Position measurement:**

To draw SVG lines between the correct dot positions, you need to measure where each dot is in the container. Use `useRef` + `useLayoutEffect` + `ResizeObserver`.

**Visual states for connector dots:**

- Default: white fill, gray border
- Matched (has a pair): blue fill, blue border (`.matching-connector-dot--paired`)
- Pending selection (clicked, waiting for match): pulsing animation (`.matching-connector-dot--pending`)
- Hovering a line: line turns red (CSS `:hover` on `.matching-line`)

> **Implementation tip**: Start with just the layout (two columns, connector dots) and hard-coded positions. Then add the click interaction. Then add dynamic positioning with refs. Then add the SVG lines. Test each step incrementally.

---

### Task 1.3: Add Matching Normalizer

**File**: `src/ui/admin/ExerciseContentEditor/editors/normalizers.ts`

Add this at the bottom of the file, after the existing table normalizers:

```typescript
import type { QuestionMatchingBlock } from '@/shared/exercise-content/types'

// ---- Matching normalizers ----

/**
 * Remove correctPairs that reference non-existent option IDs.
 * Called whenever left or right column options change (add/remove).
 */
export function normalizeMatchingPairs(block: QuestionMatchingBlock): QuestionMatchingBlock {
  const leftIds = new Set(block.leftColumn.map((o) => o.id))
  const rightIds = new Set(block.rightColumn.map((o) => o.id))

  const validPairs = block.correctPairs.filter(
    (pair) => leftIds.has(pair.optionId) && rightIds.has(pair.matchId),
  )

  // Only create new object if pairs actually changed
  if (validPairs.length === block.correctPairs.length) return block
  return { ...block, correctPairs: validPairs }
}
```

**When to call it**: Every time `handleLeftColumnChange` or `handleRightColumnChange` fires in `MatchingEditor`. If someone removes an option that has a pair, the orphaned pair is automatically cleaned up.

---

### Task 1.4: Create `MatchingEditor.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/editors/MatchingEditor.tsx`

This is the main editor component. Follow the same structure as `FreeResponseEditor.tsx`:

```typescript
'use client'

import React from 'react'
import type {
  QuestionMatchingBlock,
  MatchingOption,
  MatchingPair,
} from '@/shared/exercise-content/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'
import { ColumnEditor } from '../components/matching/ColumnEditor'
import { MatchingLines } from '../components/matching/MatchingLines'
import { normalizeMatchingPairs } from './normalizers'

interface MatchingEditorProps {
  block: QuestionMatchingBlock
  onChange: (block: QuestionMatchingBlock) => void
}

export const MatchingEditor: React.FC<MatchingEditorProps> = ({ block, onChange }) => {
  // When columns change, normalize pairs to remove orphans
  const handleLeftColumnChange = (leftColumn: MatchingOption[]) => {
    onChange(normalizeMatchingPairs({ ...block, leftColumn }))
  }

  const handleRightColumnChange = (rightColumn: MatchingOption[]) => {
    onChange(normalizeMatchingPairs({ ...block, rightColumn }))
  }

  const handlePairsChange = (correctPairs: MatchingPair[]) => {
    onChange({ ...block, correctPairs })
  }

  const handleShuffleToggle = () => {
    onChange({ ...block, shuffleRightColumn: !block.shuffleRightColumn })
  }

  return (
    <div className="matching-editor">
      {/* Section 1: Prompt */}
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(prompt) => onChange({ ...block, prompt })}
          placeholder="Enter your matching question..."
        />
      </div>

      {/* Section 2: Left/Right Columns (side by side) */}
      <div className="question-editor-section">
        <div className="matching-columns">
          <ColumnEditor
            label="Left Column"
            options={block.leftColumn}
            onChange={handleLeftColumnChange}
          />
          <ColumnEditor
            label="Right Column"
            options={block.rightColumn}
            onChange={handleRightColumnChange}
          />
        </div>
      </div>

      {/* Section 3: Correct Pairs (visual line-drawing) */}
      <div className="question-editor-section">
        <label className="question-editor-label">Correct Pairs</label>
        <p className="matching-instruction">
          Click a left item, then click a right item to create a pair. Click a line to remove it.
        </p>
        <MatchingLines
          leftColumn={block.leftColumn}
          rightColumn={block.rightColumn}
          correctPairs={block.correctPairs}
          onChange={handlePairsChange}
        />
      </div>

      {/* Section 4: Options */}
      <div className="question-editor-section">
        <label className="matching-shuffle-toggle">
          <input
            type="checkbox"
            checked={block.shuffleRightColumn ?? false}
            onChange={handleShuffleToggle}
          />
          <span>Shuffle right column for students</span>
        </label>
      </div>

      {/* Section 5: Hint/Solution (ALWAYS last) */}
      <div className="question-editor-section">
        <HintSolutionPanel
          hint={block.hint}
          solution={block.solution}
          fullSolution={block.fullSolution}
          onChange={(field, value) => onChange({ ...block, [field]: value })}
        />
      </div>
    </div>
  )
}
```

---

### Task 1.5: Add CSS for Matching Editor

**File**: `src/ui/admin/ExerciseContentEditor/index.css`

Add at the END of the file (after the existing Table Editor styles, around line 2241+). See the plan text above for full CSS.

---

### Task 1.6: Wire MatchingEditor into renderQuestionEditor

**File**: `src/ui/admin/ExerciseContentEditor/index.tsx`

Replace the `<div>TODO: MatchingEditor</div>` placeholder from Task 0.4 with:

```typescript
<MatchingEditor
  block={block as import('@/shared/exercise-content/types').QuestionMatchingBlock}
  onChange={onChange}
/>
```

Add the import at the top of the file:

```typescript
import { MatchingEditor } from './editors/MatchingEditor'
```

---

### Task 1.7: Verify Stage 1

1. `pnpm tsc --noEmit` -- passes
2. Create an exercise, add a Matching block
3. Verify 2 empty options per column by default
4. Edit option content using InlineRichTextEditor
5. Add more options (click "Add Option" in each column)
6. Remove an option (verify minimum 2 enforced)
7. **Test line-drawing**: Click a left dot, then a right dot -> line appears
8. Click the line -> line is removed
9. Remove an option that has a pair -> verify the pair auto-removes (normalizer)
10. Toggle shuffle checkbox
11. Edit the prompt text
12. Add hint, solution, fullSolution via HintSolutionPanel
13. Duplicate the matching block -> verify all IDs are regenerated, pairs remap correctly
14. Save the exercise -> check network tab for 200, no validation errors
15. Reload the page -> verify all data persists (lines re-render from saved correctPairs)

---

## Stage 2: SVG Editor

**Goal**: Code editor for SVG markup with live preview, validation, accessibility fields, and file upload.

### File Structure

```
src/ui/admin/ExerciseContentEditor/
  editors/
    SvgEditor.tsx                  # Main SVG editor
```

No sub-components needed — this editor is simple enough for a single file.

---

### Task 2.1: Create `SvgEditor.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/editors/SvgEditor.tsx`

Uses a plain `<textarea>` (no Monaco — we're not adding a new dependency) with a live SVG preview below it.

**Key features:**

1. **SVG code textarea** with monospace font
2. **Validation status** indicator (green checkmark or red warning)
3. **Live preview** using `dangerouslySetInnerHTML` on sanitized SVG
4. **File upload** button that reads .svg files
5. **Alt text** input for accessibility
6. **Optional caption** with InlineRichTextEditor

**SVG validation function (inline helper):**

```typescript
function validateSvg(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) return { valid: false, error: 'SVG content is empty' }
  if (!value.includes('<svg')) return { valid: false, error: 'Missing <svg> element' }
  if (!value.includes('</svg>') && !value.includes('/>'))
    return { valid: false, error: 'SVG element is not closed' }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(value, 'image/svg+xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      return { valid: false, error: 'Malformed XML: ' + errorNode.textContent?.slice(0, 80) }
    }
    if (!doc.querySelector('svg')) return { valid: false, error: 'No root <svg> element found' }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Failed to parse SVG' }
  }
}
```

> **Note**: `sanitizeSvg` is imported from `src/ui/admin/shared/utils.ts`. It already exists and handles XSS prevention (removes `<script>` tags, `on*` handlers, `<foreignObject>`, and external hrefs). `DOMParser` is available in client-side code.

---

### Task 2.2: Add CSS for SVG Editor

Add to `index.css`. See plan text above for full CSS.

---

### Task 2.3: Wire and Verify

Same wiring pattern: import `SvgEditor`, replace TODO placeholder in `renderQuestionEditor`, add the import.

**Verification checklist:**

1. Add SVG block -> textarea shows default circle SVG, preview renders the circle
2. Edit SVG code -> preview updates in real time
3. Break SVG syntax (delete a closing tag) -> validation error shows, preview shows error state
4. Fix the syntax -> validation goes green, preview returns
5. Upload a `.svg` file -> textarea populates with sanitized content, preview renders
6. Edit alt text
7. Save exercise -> server validation passes (200 response)
8. Reload -> all data persists

---

## Stage 3: JSXGraph Integration + React Wrapper

**Goal**: Install JSXGraph and create a reusable React wrapper component that manages board lifecycle and provides hooks for both Geometry and Axis editors.

### Task 3.1: Install JSXGraph

```bash
pnpm add jsxgraph
pnpm add -D @types/jsxgraph
```

> **If `@types/jsxgraph` doesn't exist on npm**, create a minimal type declaration file instead.

**File** (create only if types package unavailable): `src/types/jsxgraph.d.ts`

---

### Task 3.2: Create `JSXGraphBoard.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`

This is the foundational React wrapper. Both GeometryCanvas and AxisCanvas will use it.

**What it does:**

1. Dynamically imports JSXGraph (client-only library)
2. Creates a JSXGraph board on mount with the specified configuration
3. Exposes the board instance via `onBoardReady` callback
4. Destroys the board on unmount (prevents memory leaks)
5. Provides pan/zoom controls

**Critical: Why `useEffect` depends only on `loaded`:**

The board is initialized ONCE when JSXGraph loads. Subsequent changes to geometry/axis data are pushed to the board imperatively by the parent component (GeometryCanvas/AxisCanvas) — NOT by re-creating the board. Re-creating the board on every prop change would cause flickering and lose pan/zoom state.

---

### Task 3.3: Add Base CSS for JSXGraph

Add to `index.css`. See plan text above for CSS.

---

### Task 3.4: Verify Stage 3

1. `pnpm tsc --noEmit` — passes (or fix type issues with the jsxgraph declaration)
2. Temporarily render a `<JSXGraphBoard>` somewhere in the admin UI with `showAxis={true}` and `boundingBox={[-10, 10, 10, -10]}`
3. Verify: a coordinate plane renders, pan/zoom works, no console errors
4. Verify: on unmount (navigate away), no memory leak errors
5. Remove the temporary rendering after verification

---

## Stage 4: Geometry Editor (Basic)

**Goal**: Side-by-side geometry editor with form panel (left) and interactive JSXGraph canvas (right). Supports points, lines, and circles.

### File Structure

```
src/ui/admin/ExerciseContentEditor/
  editors/
    GeometryEditor.tsx              # Main editor
  components/
    geometry/
      GeometryCanvas.tsx            # JSXGraph canvas with geometry-specific rendering
      CanvasConfigPanel.tsx         # Width/height/background/grid controls
      PointsPanel.tsx               # CRUD for points
      LinesPanel.tsx                # CRUD for lines
      CirclesPanel.tsx              # CRUD for circles
```

---

### Task 4.1-4.4: Create Panel Components

Create `CanvasConfigPanel.tsx`, `PointsPanel.tsx`, `LinesPanel.tsx`, `CirclesPanel.tsx` following the patterns in the plan text.

---

### Task 4.5: Create `GeometryCanvas.tsx`

**File**: `src/ui/admin/ExerciseContentEditor/components/geometry/GeometryCanvas.tsx`

This wraps `JSXGraphBoard` and manages bidirectional sync between the GeometrySpecV1 data and JSXGraph elements.

**The `syncToBoard()` function:**

The most complex part. It diffs current JSXGraph elements against geometry spec, add/remove/update as needed.

**Why `isSyncingRef`**: When we programmatically move a point (spec -> canvas), JSXGraph fires a `drag` event. Without this flag, that event would call `onPointMoved`, which would update the spec, which would trigger `syncToBoard` again — infinite loop.

---

### Task 4.6: Create `GeometryEditor.tsx`

The main orchestrator component with side-by-side layout. See plan text for full code.

---

### Task 4.7: Add CSS for Geometry Editor

Add to `index.css`. See plan text for CSS.

---

### Task 4.8: Wire GeometryEditor and Verify

Replace the TODO placeholder in `renderQuestionEditor` with `<GeometryEditor>`. Add the import.

**Verification checklist:**

1. Add Geometry block -> canvas shows 3 default points (A, B, C)
2. Points are visible on the JSXGraph canvas
3. Edit point coordinates in the form -> canvas updates (point moves)
4. Drag a point on the canvas -> form X/Y values update
5. Add a new point -> appears on canvas with the next letter name
6. Remove a point -> disappears from canvas
7. Click a point row in the form -> it highlights (selected state)
8. Add a line between two points -> line segment appears on canvas
9. Change line style to dashed -> canvas reflects the change
10. Add a circle (through point mode) -> circle appears on canvas
11. Add a circle (radius mode) -> circle appears on canvas
12. Change canvas width/height -> canvas resizes
13. Toggle grid -> grid shows/hides
14. Responsive: narrow viewport -> switches to stacked layout
15. Save exercise -> passes server validation

---

## Stage 5: Geometry Editor (Advanced)

**Goal**: Add all remaining geometry element types: angles, triangles, rectangles, vectors, texts, and advanced elements.

### Additional Panel Components

Create in `src/ui/admin/ExerciseContentEditor/components/geometry/`:

| File                | What it Edits                                 | Key Fields                                                                                       |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `AnglesPanel.tsx`   | Angle arcs                                    | center (dropdown), ray1 (dropdown), ray2 (dropdown), arcRadius, style (arc/square), color, label |
| `ShapesPanel.tsx`   | Triangles + Rectangles                        | points (3 or 4 dropdowns), style, thickness, color, fill                                         |
| `VectorsPanel.tsx`  | Arrow vectors                                 | from (dropdown), to (dropdown), style, thickness, color                                          |
| `TextsPanel.tsx`    | Positioned text                               | value (text), mode toggle (on segment / at coordinates), position, fontSize                      |
| `AdvancedPanel.tsx` | Equal segments, equal angles, tangents, areas | Each in a sub-section, wrapped in CollapsibleSection                                             |

### Task 5.1-5.5: Create Panel Components

Create all 5 panel components following the patterns from Stage 4.

---

### Task 5.6: Update GeometryCanvas for Advanced Elements

Add rendering in `syncToBoard()` for the new element types:

- **Angles**: `board.create('angle', [ray1Point, centerPoint, ray2Point], { radius: arcRadius, type: style })`
- **Vectors**: `board.create('arrow', [fromPoint, toPoint], { strokeColor, strokeWidth })`
- **Triangles**: `board.create('polygon', [p1, p2, p3], { borders: { strokeColor }, fillColor })`
- **Rectangles**: `board.create('polygon', [p1, p2, p3, p4], { ... })`
- **Texts**: `board.create('text', [x, y, value], { fontSize })`
- **Areas**: `board.create('polygon', pointElements, { fillColor, fillOpacity: 0.3 })`

> **Note**: JSXGraph has built-in element types for most of these. Check docs at https://jsxgraph.org/docs/ for the exact API.

---

### Task 5.7: Integrate All Panels into GeometryEditor

Add the new panels to the form panel, each wrapped in `CollapsibleSection`.

---

## Stage 6: Axis Editor (Basic)

**Goal**: Side-by-side axis/graph editor with configuration panel, point editor, and function graph editor.

### File Structure

```
src/ui/admin/ExerciseContentEditor/
  editors/
    AxisEditor.tsx                  # Main editor
  components/
    axis/
      AxisCanvas.tsx                # JSXGraph canvas for cartesian system
      AxisConfigPanel.tsx           # Units, grid, axes, viewport
      AxisPointsPanel.tsx           # Points with type (point/hole/floating_text)
      GraphsPanel.tsx               # Function graph editor
```

---

### Task 6.1-6.3: Create Panel Components

Create `AxisConfigPanel.tsx`, `AxisPointsPanel.tsx`, `GraphsPanel.tsx`.

**GraphsPanel key feature**: Function validation using `parseMathExpression` from `src/ui/web/exerciserenderer/utils/safeMathEval.ts`.

---

### Task 6.4: Create `AxisCanvas.tsx`

Similar to `GeometryCanvas.tsx` but for Cartesian coordinates.

**JSXGraph initialization:**

```typescript
const bbox: [number, number, number, number] = [
  spec.viewport?.xMin ?? -10,
  spec.viewport?.yMax ?? 10,
  spec.viewport?.xMax ?? 10,
  spec.viewport?.yMin ?? -10,
]
```

**Rendering elements:**

- **Points**: Different rendering based on `type` ('point', 'hole', 'floating_text')
- **Graphs**: Use `parseMathExpression` to convert `fn` string to a JS function, then `board.create('functiongraph', ...)`

---

### Task 6.5: Create `AxisEditor.tsx`

Same structure as `GeometryEditor.tsx` — side-by-side layout.

---

### Task 6.6: Wire and Verify

**Verification checklist:**

1. Add Axis block -> shows default coordinate plane (-10 to 10)
2. Add a graph (`x^2`) -> parabola appears on canvas
3. Add another graph (`2*x+1`) -> line appears
4. Invalid function (`x^^2`) -> validation error shows, no crash
5. Add a point -> appears on canvas, is draggable
6. Change point type to `hole` -> renders with white fill
7. Change viewport bounds -> canvas rescales
8. Toggle grid on/off
9. Edit axis labels
10. Change graph color/style -> canvas reflects changes
11. Save exercise -> passes server validation

---

## Stage 7: Axis Editor (Advanced)

**Goal**: Add shading (paint), asymptotes, lines between points, and geometric loci.

### Additional Components

Create in `src/ui/admin/ExerciseContentEditor/components/axis/`:

| File                         | What it Edits                     | Key Fields                                                           |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `PaintPanel.tsx`             | Graph shading/painting            | Per-graph integral/underGraph/aboveGraph ranges + paintBetweenGraphs |
| `AsymptotesPanel.tsx`        | Vertical + horizontal asymptotes  | Lists of x-values and y-values                                       |
| `LineBetweenPointsPanel.tsx` | Line segments between coordinates | Point A (x,y), Point B (x,y), style, thickness, color                |
| `LociPanel.tsx`              | Geometric loci (implicit curves)  | Equation string, style, thickness, color                             |

---

### Task 7.1-7.3: Create Panel Components

Create all 4 panel components.

> **Note on loci rendering**: JSXGraph supports implicit curves via `board.create('implicitcurve', ...)`. However, parsing a two-variable equation string into a JS function is complex. For the initial implementation, show a "preview not available for loci" message on the canvas and just store the equation string.

---

### Task 7.4: Update AxisCanvas for Advanced Elements

Add to `syncToBoard()`:

- **Asymptotes**: Dashed vertical/horizontal lines
- **Lines between points**: `board.create('segment', [[ax, ay], [bx, by]], ...)`

---

### Task 7.5-7.6: Integrate into AxisEditor

Add the new panels wrapped in `CollapsibleSection`.

---

## Files Summary

### Modified (Existing Files)

| File                                                        | Stage         | Changes                                 |
| ----------------------------------------------------------- | ------------- | --------------------------------------- |
| `src/shared/exercise-content/defaults.ts`                   | 0             | Add 4 factory functions + imports       |
| `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx`  | 0             | Add 4 block type entries + icon imports |
| `src/ui/admin/ExerciseContentEditor/index.tsx`              | 0, 1, 2, 4, 6 | Add labels, routes, and editor imports  |
| `src/ui/admin/ExerciseContentEditor/utils.ts`               | 0             | Add matching case to `deepCloneBlock`   |
| `src/ui/admin/ExerciseContentEditor/editors/normalizers.ts` | 1             | Add `normalizeMatchingPairs`            |
| `src/ui/admin/ExerciseContentEditor/index.css`              | 1, 2, 3, 4    | Add CSS for all editor types            |

### Created (New Files)

| File                                                                            | Stage |
| ------------------------------------------------------------------------------- | ----- |
| `src/ui/admin/ExerciseContentEditor/editors/MatchingEditor.tsx`                 | 1     |
| `src/ui/admin/ExerciseContentEditor/components/matching/ColumnEditor.tsx`       | 1     |
| `src/ui/admin/ExerciseContentEditor/components/matching/MatchingLines.tsx`      | 1     |
| `src/ui/admin/ExerciseContentEditor/editors/SvgEditor.tsx`                      | 2     |
| `src/ui/admin/ExerciseContentEditor/components/shared/JSXGraphBoard.tsx`        | 3     |
| `src/types/jsxgraph.d.ts` (if needed)                                           | 3     |
| `src/ui/admin/ExerciseContentEditor/editors/GeometryEditor.tsx`                 | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/GeometryCanvas.tsx`     | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/CanvasConfigPanel.tsx`  | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/PointsPanel.tsx`        | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/LinesPanel.tsx`         | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/CirclesPanel.tsx`       | 4     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/AnglesPanel.tsx`        | 5     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/ShapesPanel.tsx`        | 5     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/VectorsPanel.tsx`       | 5     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/TextsPanel.tsx`         | 5     |
| `src/ui/admin/ExerciseContentEditor/components/geometry/AdvancedPanel.tsx`      | 5     |
| `src/ui/admin/ExerciseContentEditor/editors/AxisEditor.tsx`                     | 6     |
| `src/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas.tsx`             | 6     |
| `src/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel.tsx`        | 6     |
| `src/ui/admin/ExerciseContentEditor/components/axis/AxisPointsPanel.tsx`        | 6     |
| `src/ui/admin/ExerciseContentEditor/components/axis/GraphsPanel.tsx`            | 6     |
| `src/ui/admin/ExerciseContentEditor/components/axis/PaintPanel.tsx`             | 7     |
| `src/ui/admin/ExerciseContentEditor/components/axis/AsymptotesPanel.tsx`        | 7     |
| `src/ui/admin/ExerciseContentEditor/components/axis/LineBetweenPointsPanel.tsx` | 7     |
| `src/ui/admin/ExerciseContentEditor/components/axis/LociPanel.tsx`              | 7     |

**Total: ~27 new files, 6 modified files**

---

## Dependency Summary

| Package                               | Purpose                                | Stage |
| ------------------------------------- | -------------------------------------- | ----- |
| `jsxgraph`                            | Interactive geometry + graph rendering | 3     |
| `@types/jsxgraph` (or custom `.d.ts`) | TypeScript types for JSXGraph          | 3     |

No other new dependencies. Everything else uses existing packages.

---

## Verification Checklist (Run After Every Stage)

```bash
# 1. Type check
pnpm tsc --noEmit

# 2. Regenerate import map
pnpm generate:importmap

# 3. Lint check
pnpm lint

# 4. Manual browser test
#    - Create exercise
#    - Add each new block type
#    - Edit content
#    - Save and reload
#    - Verify data persists
```

---

## Key Patterns Cheat Sheet

### The onChange Pattern

Every editor receives `block` and `onChange`. When changing anything, ALWAYS spread the full block and override the changed property:

```typescript
// Simple field
onChange({ ...block, prompt: newPrompt })

// Nested field
onChange({ ...block, geometry: { ...block.geometry, canvas: newCanvas } })

// Deeply nested array item
const newPoints = block.geometry.elements.points.map((p) => (p.name === 'A' ? { ...p, x: 100 } : p))
onChange({
  ...block,
  geometry: {
    ...block.geometry,
    elements: { ...block.geometry.elements, points: newPoints },
  },
})
```

### The JSXGraph Sync Pattern (Prevent Infinite Loops)

```typescript
const isSyncingRef = useRef(false)

// When updating canvas from form data:
isSyncingRef.current = true
// ... move JSXGraph elements ...
isSyncingRef.current = false

// In drag event handler:
el.on('drag', () => {
  if (isSyncingRef.current) return // Skip if we're syncing from form
  onPointMoved(name, el.X(), el.Y())
})
```

### The Section Pattern

```tsx
<div className="question-editor-section">
  <label className="question-editor-label">Label</label>
  {/* Content */}
</div>
```

### The HintSolutionPanel Pattern (ALWAYS Last)

```tsx
<div className="question-editor-section">
  <HintSolutionPanel
    hint={block.hint}
    solution={block.solution}
    fullSolution={block.fullSolution}
    onChange={(field, value) => onChange({ ...block, [field]: value })}
  />
</div>
```
