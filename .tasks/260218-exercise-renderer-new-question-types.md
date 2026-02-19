# Low-Level Plan: Exercise Renderer — 4 New Question Types

**Task ID**: 260218-exercise-renderer-new-question-types
**Date**: 2026-02-18
**Estimated effort**: ~26 hours across 8 phases, 34 steps

---

## Decisions Log

| Decision                 | Choice                         | Rationale                                      |
| ------------------------ | ------------------------------ | ---------------------------------------------- |
| Matching interaction     | Tap-to-connect                 | Simpler, accessible, mobile-friendly           |
| Matching visual feedback | SVG overlay lines              | Bezier curves between paired items             |
| Geometry/Axis scope      | Full with answer schemas       | Generic discriminated union on `kind`          |
| SVG scope                | Static + hotspot system        | Schema metadata + SVG element annotations      |
| Rendering library        | JSXGraph (~960KB, lazy-loaded) | Mature, handles coord systems + function plots |
| Function validation      | Exact string match             | CAS deferred; normalize whitespace only        |
| Hint/solution UI         | Basic reveal buttons           | Progressive: hint → solution → full solution   |

---

## New Dependencies

| Package                | Purpose                 | Size                                                      | Notes                                             |
| ---------------------- | ----------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `jsxgraph`             | Geometry/axis rendering | ~960KB (must lazy-load via `next/dynamic` + `ssr: false`) | Ships own TS types, client-only, MIT/LGPL         |
| `isomorphic-dompurify` | SVG sanitization        | ~20KB                                                     | Replaces regex-based `sanitizeSvg` in admin utils |

---

## File Map

```
src/shared/exercise-content/
├── types.ts                                    # MODIFY — extend SvgBlock, add QuestionAnswer, extend Geo/Axis blocks
├── defaults.ts                                 # MODIFY — add 4 factory functions

src/server/payload/collections/Exercises/
├── schemas.ts                                  # MODIFY — extend schemas to match types

src/ui/web/exerciserenderer/
├── types.ts                                    # MODIFY — extend UserAnswer, QuestionBlock, ContentBlock
├── ExerciseRenderer/index.tsx                  # MODIFY — add 4 question types + hint/solution pass-through
├── questions/
│   ├── MatchingQuestion/index.tsx              # NEW — tap-to-connect matching UI
│   ├── GeometryQuestion/index.tsx              # NEW — geometry diagram + answer input
│   └── AxisQuestion/index.tsx                  # NEW — axis diagram + answer input
├── blocks/
│   ├── SvgRenderer/index.tsx                   # NEW — static + interactive SVG
│   ├── GeometryRenderer/index.tsx              # MODIFY — replace placeholder with JSXGraph
│   └── AxisRenderer/index.tsx                  # MODIFY — replace placeholder with JSXGraph
├── graphics/
│   ├── JSXGraphBoard.tsx                       # NEW — React wrapper for JSXGraph
│   ├── geometryElements.ts                     # NEW — GeometrySpecV1 → JSXGraph element builders
│   └── axisElements.ts                         # NEW — AxisSpecV1 → JSXGraph element builders
├── components/
│   ├── QuestionCard/index.tsx                  # MODIFY — accept hint/solution props
│   ├── HintSolutionPanel/index.tsx             # NEW — collapsible hint/solution/fullSolution
│   └── FeedbackDisplay/index.tsx               # MODIFY — partial score message for matching
├── utils/
│   ├── answerChecking.ts                       # MODIFY — add 4 new cases + shared validateGenericAnswer
│   ├── svgSanitize.ts                          # NEW — DOMPurify-based SVG sanitization
│   └── extractMediaIds.ts                      # MODIFY — handle matching + SVG media

src/i18n/
├── en.json                                     # MODIFY — add ~20 new keys
├── he.json                                     # MODIFY — add ~20 new keys

tests/
├── unit/exercise-renderer/
│   ├── matchingChecking.test.ts                # NEW
│   ├── svgChecking.test.ts                     # NEW
│   ├── geometryChecking.test.ts                # NEW
│   ├── axisChecking.test.ts                    # NEW
│   └── svgSanitize.test.ts                     # NEW
├── int/contracts/
│   └── exercise-content-blocks.int.spec.ts     # MODIFY — extend with hotspot + answer schema tests
```

---

## Phase 1: Schema & Type Extensions (~2 hours)

### Step 1.1: Add `SvgHotspot` and extend `SvgBlock` in shared types

**File**: `src/shared/exercise-content/types.ts`
**Action**: MODIFY — add new interface before `SvgBlock`, extend `SvgBlock`

**What to add** (insert after line 170, before the existing `SvgBlock`):

```typescript
// ---------------------------------
// SVG Hotspot (clickable region within an SVG)
// ---------------------------------
export interface SvgHotspot {
  id: string
  selector: string // CSS selector or element ID to match in SVG DOM
  label?: string // Accessible label for the hotspot
}
```

**What to modify** — extend the existing `SvgBlock` interface (currently lines 174-180):

Add these fields before the closing brace:

```typescript
  interactive?: boolean       // If true, hotspots are clickable
  hotspots?: SvgHotspot[]     // Clickable regions (only when interactive=true)
  correctHotspotIds?: string[] // Answer key: which hotspot IDs are correct
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
```

**Why**: The hotspot model uses both schema metadata (this `hotspots` array) and SVG element annotations (`data-hotspot-id` attributes in the SVG markup). The schema is the source of truth for answers; SVG annotations aid the renderer in locating elements.

**Acceptance criteria**:

- [ ] `SvgHotspot` interface exists with `id`, `selector`, optional `label`
- [ ] `SvgBlock` has all new optional fields
- [ ] File compiles (`tsc --noEmit`)

---

### Step 1.2: Add `QuestionAnswer` discriminated union in shared types

**File**: `src/shared/exercise-content/types.ts`
**Action**: MODIFY — add new type after `QuestionMatchingBlock`, before `SvgBlock`

**What to add**:

```typescript
// ---------------------------------
// Generic Question Answer (used by Geometry + Axis)
// ---------------------------------
export type QuestionAnswer =
  | { kind: 'numeric'; value: number; tolerance?: number }
  | { kind: 'mcq'; options: McqOption[]; correctOptionIds: string[] }
  | { kind: 'free_response'; acceptedAnswers: string[] }
  | { kind: 'point'; x: number; y: number; tolerance?: number }
  | { kind: 'function'; acceptedExpressions: string[] }
```

**Why**: This is a generic answer type that works for both geometry and axis questions. The `kind` discriminator tells the renderer which answer UI to show (number input, MCQ radio buttons, text area, coordinate inputs, or function expression input).

**Acceptance criteria**:

- [ ] `QuestionAnswer` is a discriminated union with 5 variants
- [ ] Uses existing `McqOption` type for the MCQ variant (which has `id` + `content: InlineRichText`)

---

### Step 1.3: Add `answer` field to Geometry and Axis blocks

**File**: `src/shared/exercise-content/types.ts`
**Action**: MODIFY — add one line to each block interface

**QuestionGeometryBlock** (currently line ~188, add before closing brace):

```typescript
  answer?: QuestionAnswer     // Optional — if absent, question is display-only
```

**QuestionAxisBlock** (currently line ~203, add before closing brace):

```typescript
  answer?: QuestionAnswer     // Optional — if absent, question is display-only
```

**Why**: Making `answer` optional means existing geometry/axis blocks (which have no answer) remain valid. When `answer` is present, the renderer shows an answer input and enables grading. When absent, the block renders as diagram-only.

**Acceptance criteria**:

- [ ] Both block interfaces have optional `answer?: QuestionAnswer`
- [ ] Existing test data (which has no `answer` field) still type-checks

---

### Step 1.4: Add Zod schemas matching the new types

**File**: `src/server/payload/collections/Exercises/schemas.ts`
**Action**: MODIFY — add new schemas, extend existing schemas

**1. Add `SvgHotspotSchema`** (insert above `SvgBlockSchema`, around line 308):

```typescript
const SvgHotspotSchema = z
  .object({
    id: z.string().min(1),
    selector: z.string().min(1),
    label: z.string().optional(),
  })
  .strict()
```

**2. Extend `SvgBlockSchema`** (currently lines 310-318) — replace with:

```typescript
const SvgBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('svg'),
    value: z.string().min(1),
    altText: z.string().optional(),
    caption: InlineRichTextSchema.optional(),
    interactive: z.boolean().optional(),
    hotspots: z.array(SvgHotspotSchema).optional(),
    correctHotspotIds: z.array(z.string().min(1)).optional(),
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.correctHotspotIds && data.hotspots) {
      const hotspotIds = new Set(data.hotspots.map((h) => h.id))
      for (const id of data.correctHotspotIds) {
        if (!hotspotIds.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `correctHotspotIds contains unknown hotspot id: ${id}`,
            path: ['correctHotspotIds'],
          })
        }
      }
    }
    if (data.interactive && (!data.hotspots || data.hotspots.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interactive SVG must have at least one hotspot',
        path: ['hotspots'],
      })
    }
  })
```

**3. Add `QuestionAnswerSchema`** (insert above `QuestionGeometryBlockSchema`):

First add a helper:

```typescript
const AnswerMcqOptionSchema = z
  .object({
    id: z.string().min(1),
    content: InlineRichTextSchema,
  })
  .strict()
```

Then the main schema:

```typescript
const QuestionAnswerSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('numeric'),
      value: z.number(),
      tolerance: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('mcq'),
      options: z.array(AnswerMcqOptionSchema).min(2),
      correctOptionIds: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('free_response'),
      acceptedAnswers: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('point'),
      x: z.number(),
      y: z.number(),
      tolerance: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('function'),
      acceptedExpressions: z.array(z.string().min(1)).min(1),
    })
    .strict(),
])
```

**4. Extend `QuestionGeometryBlockSchema`** — add `answer` field:

```typescript
answer: QuestionAnswerSchema.optional(),
```

**5. Extend `QuestionAxisBlockSchema`** — same change.

**Acceptance criteria**:

- [ ] `SvgHotspotSchema` validates `id` + `selector`
- [ ] `SvgBlockSchema` validates hotspot cross-references via `superRefine`
- [ ] `QuestionAnswerSchema` is a 5-variant discriminated union on `kind`
- [ ] Both geometry/axis schemas accept optional `answer`
- [ ] Existing tests still pass: `pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts`

---

### Step 1.5: Extend renderer types

**File**: `src/ui/web/exerciserenderer/types.ts`
**Action**: MODIFY — import shared types, extend unions

**1. Add imports** at the top of the file:

```typescript
import type {
  QuestionMatchingBlock,
  SvgBlock,
  QuestionGeometryBlock,
  QuestionAxisBlock,
  QuestionAnswer,
  MatchingOption,
  MatchingPair,
  SvgHotspot,
} from '@/shared/exercise-content/types'
```

**2. Re-export** so other renderer files can import from `../types`:

```typescript
export type {
  QuestionMatchingBlock,
  SvgBlock,
  QuestionGeometryBlock,
  QuestionAxisBlock,
  QuestionAnswer,
  MatchingOption,
  MatchingPair,
  SvgHotspot,
}
```

**3. Extend `UserAnswer` union** (currently line ~9, add 4 new variants):

```typescript
export type UserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; value: boolean | null }
  | { type: 'free_response'; value: string }
  | { type: 'table'; cellValues: Record<string, string> }
  // NEW:
  | { type: 'matching'; connections: Array<{ leftId: string; rightId: string }> }
  | { type: 'svg'; selectedHotspotIds: string[] }
  | {
      type: 'geometry'
      kind: string
      numericValue?: number
      selectedOptionIds?: string[]
      textValue?: string
      point?: { x: number; y: number }
      functionExpression?: string
    }
  | {
      type: 'axis'
      kind: string
      numericValue?: number
      selectedOptionIds?: string[]
      textValue?: string
      point?: { x: number; y: number }
      functionExpression?: string
    }
```

**4. Extend `QuestionBlock` union** (currently line ~138):

```typescript
export type QuestionBlock =
  | QuestionSelectBlock
  | QuestionFreeResponseBlock
  | QuestionTableBlock
  | QuestionMatchingBlock // NEW
  | QuestionGeometryBlock // NEW (only rendered as question when answer field is present)
  | QuestionAxisBlock // NEW (only rendered as question when answer field is present)
```

**5. Extend `ContentBlock` union** (currently line ~140):

```typescript
export type ContentBlock = RichTextBlock | QuestionBlock | SvgBlock // NEW — non-interactive SVG is a content block
```

**Acceptance criteria**:

- [ ] All 4 new `UserAnswer` variants exist
- [ ] `QuestionBlock` includes matching, geometry, axis
- [ ] `ContentBlock` includes `SvgBlock`
- [ ] File compiles with `tsc --noEmit`

---

### Step 1.6: Add factory defaults for new block types

**File**: `src/shared/exercise-content/defaults.ts`
**Action**: MODIFY — add 4 entries to `ExerciseBlockDefaults` + add imports

**Add imports** at top (extend existing import):

```typescript
import type {
  // ... existing imports ...
  QuestionMatchingBlock,
  SvgBlock,
  QuestionGeometryBlock,
  QuestionAxisBlock,
} from './types'
```

**Add 4 factory functions** to `ExerciseBlockDefaults` object (after the `latex` entry):

```typescript
question_matching: (): QuestionMatchingBlock => ({
  id: generateId(),
  type: 'question_matching',
  prompt: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  leftColumn: [
    { id: 'l1', content: { type: 'rich_text', format: 'md-math-v1', value: 'Item 1', mediaIds: [] } },
    { id: 'l2', content: { type: 'rich_text', format: 'md-math-v1', value: 'Item 2', mediaIds: [] } },
  ],
  rightColumn: [
    { id: 'r1', content: { type: 'rich_text', format: 'md-math-v1', value: 'Match A', mediaIds: [] } },
    { id: 'r2', content: { type: 'rich_text', format: 'md-math-v1', value: 'Match B', mediaIds: [] } },
  ],
  correctPairs: [{ optionId: 'l1', matchId: 'r1' }, { optionId: 'l2', matchId: 'r2' }],
  shuffleRightColumn: true,
  hint: DEFAULT_HINT_SOLUTION(),
  solution: DEFAULT_HINT_SOLUTION(),
  fullSolution: DEFAULT_HINT_SOLUTION(),
}),

svg: (): SvgBlock => ({
  id: generateId(),
  type: 'svg',
  value: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f0f0f0"/></svg>',
  altText: 'Diagram',
}),

question_geometry: (): QuestionGeometryBlock => ({
  id: generateId(),
  type: 'question_geometry',
  prompt: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  geometry: {
    kind: 'euclidean',
    canvas: { width: 600, height: 400 },
    elements: { points: [], lines: [], circles: [], angles: [] },
  },
  hint: DEFAULT_HINT_SOLUTION(),
  solution: DEFAULT_HINT_SOLUTION(),
  fullSolution: DEFAULT_HINT_SOLUTION(),
}),

question_axis: (): QuestionAxisBlock => ({
  id: generateId(),
  type: 'question_axis',
  prompt: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  axis: {
    kind: 'cartesian',
    units: 1,
    grid: { enabled: true },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: { x: 'x', y: 'y' },
      origin: { x: 0, y: 0 },
    },
    elements: { points: [], graphs: [] },
  },
  hint: DEFAULT_HINT_SOLUTION(),
  solution: DEFAULT_HINT_SOLUTION(),
  fullSolution: DEFAULT_HINT_SOLUTION(),
}),
```

**Acceptance criteria**:

- [ ] 4 new factory functions in `ExerciseBlockDefaults`
- [ ] Each produces valid data that passes its Zod schema
- [ ] File compiles

---

### Step 1.7: Update media extraction utility

**File**: `src/ui/web/exerciserenderer/utils/extractMediaIds.ts`
**Action**: MODIFY — extend `LooseBlock` interface + collection logic

**Extend `LooseBlock`** (currently line ~15) — add these properties:

```typescript
  leftColumn?: Array<{ content?: LooseRichText }>   // NEW: for matching
  rightColumn?: Array<{ content?: LooseRichText }>   // NEW: for matching
  caption?: LooseRichText                             // NEW: for SVG
```

**Extend collection loop** in `extractMediaIds()` — add after the `answer.options` block (around line 53):

```typescript
// Matching columns
if (block.leftColumn) {
  for (const opt of block.leftColumn) {
    collect(opt.content)
  }
}
if (block.rightColumn) {
  for (const opt of block.rightColumn) {
    collect(opt.content)
  }
}
// SVG caption
collect(block.caption)
```

**Acceptance criteria**:

- [ ] `extractMediaIds` handles matching block media in leftColumn/rightColumn
- [ ] `extractMediaIds` handles SVG caption media

---

### Step 1.8: Phase 1 quality gate

Run these commands in order:

```bash
pnpm -s tsc --noEmit
pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts
pnpm -s lint
```

**All three must pass** before moving to Phase 2.

---

## Phase 2: Matching Question (~4 hours)

### Step 2.1: Add i18n keys for matching

**File**: `src/i18n/en.json`
**Action**: MODIFY — add these keys under the `"courses"` object:

```json
"matchingBadge": "Matching",
"matchingInstruction": "Click an item on the left, then click its match on the right",
"matchingClear": "Clear all",
"matchingPartialCorrect": "{{correct}} of {{total}} pairs correct",
"matchingRemoveConnection": "Remove connection"
```

**File**: `src/i18n/he.json`
**Action**: MODIFY — add Hebrew translations under `"courses"`:

```json
"matchingBadge": "התאמה",
"matchingInstruction": "לחץ על פריט בצד שמאל, ואז לחץ על ההתאמה בצד ימין",
"matchingClear": "נקה הכל",
"matchingPartialCorrect": "{{correct}} מתוך {{total}} זוגות נכונים",
"matchingRemoveConnection": "הסר חיבור"
```

---

### Step 2.2: Create `MatchingQuestion` component

**File**: `src/ui/web/exerciserenderer/questions/MatchingQuestion/index.tsx`
**Action**: NEW file — `'use client'` component

**Props interface**:

```typescript
interface MatchingQuestionProps {
  question: QuestionMatchingBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}
```

**Implementation — build in this order**:

1. **Extract state from answer prop**: `const connections = answer.type === 'matching' ? answer.connections : []`

2. **Local state**: `const [selectedLeft, setSelectedLeft] = useState<string | null>(null)`

3. **Shuffle right column**: Use `useMemo` with a stable seed (based on `question.id`) to create a shuffled copy of `question.rightColumn` when `question.shuffleRightColumn !== false`. Use a seeded shuffle so the order is stable across re-renders but different per question.

4. **Click handlers**:
   - `handleLeftClick(leftId: string)`:
     - If disabled, return early
     - If same leftId already selected, deselect: `setSelectedLeft(null)`
     - Otherwise set `selectedLeft = leftId`
   - `handleRightClick(rightId: string)`:
     - If disabled or no `selectedLeft`, return early
     - Remove any existing connection with this rightId (one right can only match one left)
     - Remove any existing connection with the current selectedLeft (one left can only match one right)
     - Add new connection `{ leftId: selectedLeft, rightId }`
     - Call `onChange({ type: 'matching', connections: updatedConnections })`
     - Clear `setSelectedLeft(null)`
   - `handleClearAll()`:
     - Call `onChange({ type: 'matching', connections: [] })`
     - Clear `setSelectedLeft(null)`

5. **SVG overlay for connection lines** — refs and positioning:
   - Create `containerRef = useRef<HTMLDivElement>(null)` for the outer wrapper
   - Create `leftRefs = useRef<Map<string, HTMLButtonElement>>(new Map())` for left items
   - Create `rightRefs = useRef<Map<string, HTMLButtonElement>>(new Map())` for right items
   - Create `const [linePositions, setLinePositions] = useState<Array<{x1,y1,x2,y2,leftId,rightId}>>([])`
   - In a `useEffect` (deps: `[connections]`), calculate line positions:
     ```typescript
     const containerRect = containerRef.current?.getBoundingClientRect()
     const positions = connections
       .map((conn) => {
         const leftEl = leftRefs.current.get(conn.leftId)
         const rightEl = rightRefs.current.get(conn.rightId)
         if (!leftEl || !rightEl || !containerRect) return null
         const leftRect = leftEl.getBoundingClientRect()
         const rightRect = rightEl.getBoundingClientRect()
         return {
           x1: leftRect.right - containerRect.left,
           y1: leftRect.top + leftRect.height / 2 - containerRect.top,
           x2: rightRect.left - containerRect.left,
           y2: rightRect.top + rightRect.height / 2 - containerRect.top,
           leftId: conn.leftId,
           rightId: conn.rightId,
         }
       })
       .filter(Boolean)
     setLinePositions(positions)
     ```
   - Also attach a `ResizeObserver` on `containerRef` to recalculate on layout changes.

6. **Render the SVG overlay**:

   ```tsx
   <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
     {linePositions.map((pos, i) => {
       const midX = (pos.x1 + pos.x2) / 2
       const isCorrectPair = checkResult ? isConnectionCorrect(pos.leftId, pos.rightId) : null
       const strokeColor =
         isCorrectPair === true
           ? 'hsl(var(--success))'
           : isCorrectPair === false
             ? 'hsl(var(--destructive))'
             : COLORS[i % COLORS.length]
       return (
         <path
           key={`${pos.leftId}-${pos.rightId}`}
           d={`M ${pos.x1} ${pos.y1} C ${midX} ${pos.y1}, ${midX} ${pos.y2}, ${pos.x2} ${pos.y2}`}
           stroke={strokeColor}
           strokeWidth={2.5}
           fill="none"
         />
       )
     })}
   </svg>
   ```

7. **Layout** (using Tailwind):

   ```
   <div className="flex flex-col gap-4">
     {/* Prompt */}
     <RichTextRenderer block={promptBlock} />

     {/* Instruction */}
     <p className="text-sm text-muted-foreground flex items-center gap-1.5">
       <AlertCircle className="w-4 h-4" />
       {t('matchingInstruction')}
     </p>

     {/* Columns container (position: relative for SVG overlay) */}
     <div ref={containerRef} className="relative flex gap-6">
       {/* SVG overlay */}
       <svg ...>...</svg>

       {/* Left column */}
       <div className="flex-1 flex flex-col gap-2" role="listbox" aria-label="Items to match">
         {question.leftColumn.map(item => (
           <button key={item.id} ref={el => leftRefs.current.set(item.id, el)}
             onClick={() => handleLeftClick(item.id)}
             className={cn(
               'p-3 rounded-lg border-2 text-left transition-all',
               'border-border bg-card',
               !disabled && 'hover:border-muted-foreground cursor-pointer',
               selectedLeft === item.id && 'border-primary bg-primary/10 ring-2 ring-primary shadow-sm',
               isConnected(item.id) && 'border-primary/50 bg-primary/5',
               disabled && 'opacity-60 cursor-not-allowed',
               // After check:
               isItemCorrect(item.id) === true && 'border-success bg-success/10',
               isItemCorrect(item.id) === false && 'border-destructive bg-destructive/10',
             )}
             role="option"
             aria-selected={selectedLeft === item.id}
           >
             <RichTextRenderer block={{ ...item.content, id: `${question.id}-left-${item.id}` }} />
           </button>
         ))}
       </div>

       {/* Right column */}
       <div className="flex-1 flex flex-col gap-2" role="listbox" aria-label="Matching targets">
         {shuffledRight.map(item => ( /* same pattern as left */ ))}
       </div>
     </div>

     {/* Clear button */}
     {connections.length > 0 && !disabled && (
       <button onClick={handleClearAll} className="text-sm text-muted-foreground hover:text-foreground">
         {t('matchingClear')}
       </button>
     )}
   </div>
   ```

8. **RTL support**: The two columns use `flex`. In RTL contexts, add `flex-row-reverse` on the columns container. Connection lines always draw from the physically-left column to the physically-right column.

9. **Keyboard accessibility**:
   - Each item is a `<button>` with `role="option"`
   - `aria-selected` for the selected left item
   - Focus visible ring (already in Tailwind via `focus-visible:ring-2`)
   - Tab order: left items first, then right items

10. **Color palette** for connection lines (8 cycling colors):
    ```typescript
    const COLORS = [
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#f97316',
      '#14b8a6',
      '#f59e0b',
      '#6366f1',
      '#06b6d4',
    ]
    ```

**Acceptance criteria**:

- [ ] Component renders two columns of items
- [ ] Tap left then tap right creates a connection
- [ ] SVG bezier line draws between connected pairs
- [ ] "Clear All" removes all connections
- [ ] Disabled state prevents interaction
- [ ] Correct/incorrect styling shows after check
- [ ] Keyboard navigable
- [ ] Lines recalculate on resize

---

### Step 2.3: Add matching answer checking logic

**File**: `src/ui/web/exerciserenderer/utils/answerChecking.ts`
**Action**: MODIFY — add import, new case, helper function, and initial answer

**1. Add import** at top:

```typescript
import type { QuestionMatchingBlock } from '../types'
```

**2. Add to `checkQuestionAnswer` switch** (after the `question_table` case):

```typescript
    case 'question_matching': {
      if (answer.type !== 'matching') {
        return { isCorrect: false, message: messages.invalidAnswerType }
      }
      if (answer.connections.length === 0) {
        return { isCorrect: false, message: messages.selectAnAnswer }
      }
      return validateMatchingAnswer(question as QuestionMatchingBlock, answer.connections)
    }
```

**3. Add helper function** (above or below `validateFreeResponseOnServer`):

```typescript
function validateMatchingAnswer(
  question: QuestionMatchingBlock,
  connections: Array<{ leftId: string; rightId: string }>,
): CheckResult {
  const correctPairs = question.correctPairs
  const userPairSet = new Set(connections.map((c) => `${c.leftId}:${c.rightId}`))
  const correctPairSet = new Set(correctPairs.map((p) => `${p.optionId}:${p.matchId}`))

  if (userPairSet.size === correctPairSet.size) {
    let allMatch = true
    for (const pair of userPairSet) {
      if (!correctPairSet.has(pair)) {
        allMatch = false
        break
      }
    }
    if (allMatch) return { isCorrect: true }
  }

  let correctCount = 0
  for (const pair of userPairSet) {
    if (correctPairSet.has(pair)) correctCount++
  }

  return {
    isCorrect: false,
    message: `${correctCount}/${correctPairs.length}`,
  }
}
```

**4. Add to `getInitialAnswer`**:

```typescript
    case 'question_matching':
      return { type: 'matching', connections: [] }
```

**Acceptance criteria**:

- [ ] Exact match → `{ isCorrect: true }`
- [ ] Partial match → `{ isCorrect: false, message: "2/3" }`
- [ ] Empty answer → error message
- [ ] Type mismatch → error message

---

### Step 2.4: Integrate matching into ExerciseRenderer

**File**: `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`
**Action**: MODIFY — 4 changes

**1. Add import** (with the other question imports):

```typescript
import { MatchingQuestion } from '../questions/MatchingQuestion'
```

And add type import:

```typescript
import type { QuestionMatchingBlock } from '../types'
```

**2. Extend `questionBlocks` filter** (currently line ~91) — add condition:

```typescript
      block.type === 'question_matching' ||
```

**3. Add rendering branch** (after the `question_table` `{...}` block, around line ~240):

```typescript
                {question.type === 'question_matching' && (
                  <MatchingQuestion
                    question={question as QuestionMatchingBlock}
                    answer={answer}
                    onChange={(ans) => handleAnswerChange(question.id, ans)}
                    disabled={!!disabled}
                    checkResult={checkResult}
                    t={t}
                  />
                )}
```

**4. Add to `formatStudentAnswer`** function (around line ~45):

```typescript
if (answer.type === 'matching') {
  return answer.connections.map((c) => `${c.leftId} → ${c.rightId}`).join(', ')
}
```

**Acceptance criteria**:

- [ ] Matching blocks appear in the exercise renderer
- [ ] Check button works
- [ ] Incorrect answer triggers AI chat event
- [ ] `formatStudentAnswer` returns readable text

---

### Step 2.5: Phase 2 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 3: SVG Renderer (~3 hours)

### Step 3.1: Install DOMPurify

```bash
pnpm add isomorphic-dompurify
```

**Why**: The existing `sanitizeSvg` in `src/ui/admin/shared/utils.ts` uses regex, which is fragile and bypassable. `isomorphic-dompurify` provides proper DOM-based sanitization for both SSR and browser.

---

### Step 3.2: Create SVG sanitization utility

**File**: `src/ui/web/exerciserenderer/utils/svgSanitize.ts`
**Action**: NEW file

```typescript
import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize SVG markup for safe rendering via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, external references, and dangerous elements.
 * Preserves data-hotspot-id attributes for interactive SVGs.
 */
export function sanitizeSvg(svgMarkup: string): string {
  return DOMPurify.sanitize(svgMarkup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['data-hotspot-id'],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover'],
  })
}
```

**Acceptance criteria**:

- [ ] Strips `<script>` tags
- [ ] Strips `on*` event handler attributes
- [ ] Preserves `data-hotspot-id` attributes
- [ ] Returns clean SVG string

---

### Step 3.3: Create `SvgRenderer` component

**File**: `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx`
**Action**: NEW file — `'use client'` component

**Props**:

```typescript
interface SvgRendererProps {
  block: SvgBlock
  selectedHotspotIds?: string[]
  onHotspotToggle?: (hotspotId: string) => void
  disabled?: boolean
  checkResult?: CheckResult | null
  correctHotspotIds?: string[]
}
```

**Implementation — build in this order**:

1. **Sanitize**: `const sanitizedSvg = useMemo(() => sanitizeSvg(block.value), [block.value])`

2. **Container ref**: `const containerRef = useRef<HTMLDivElement>(null)`

3. **Static mode** (when `!block.interactive`):
   - Render:
     ```tsx
     <div>
       <div
         ref={containerRef}
         role="img"
         aria-label={block.altText || 'Diagram'}
         className="w-full max-w-full overflow-hidden [&>svg]:max-w-full [&>svg]:h-auto"
         dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
       />
       {block.caption && (
         <div className="mt-2 text-sm text-muted-foreground text-center">
           <RichTextRenderer block={{ ...block.caption, id: `${block.id}-caption` }} />
         </div>
       )}
     </div>
     ```

4. **Interactive mode** (when `block.interactive`):
   - Same render as static but with `role="application"` and additional `useEffect`:
   - In `useEffect`, after render, query the container for hotspot elements:

     ```typescript
     useEffect(() => {
       const container = containerRef.current
       if (!container || !block.hotspots) return

       const cleanups: (() => void)[] = []

       for (const hotspot of block.hotspots) {
         // Try both selector and data-hotspot-id
         const el =
           container.querySelector(hotspot.selector) ||
           container.querySelector(`[data-hotspot-id="${hotspot.id}"]`)
         if (!el) continue

         // Make interactive
         el.setAttribute('tabindex', '0')
         el.setAttribute('role', 'button')
         el.setAttribute('aria-label', hotspot.label || `Region ${hotspot.id}`)
         el.setAttribute('style', 'cursor: pointer; transition: opacity 0.2s;')

         // Visual state
         const isSelected = selectedHotspotIds?.includes(hotspot.id)
         if (isSelected) {
           el.setAttribute('stroke', 'hsl(var(--primary))')
           el.setAttribute('stroke-width', '3')
         }

         // Click handler
         const handler = () => onHotspotToggle?.(hotspot.id)
         el.addEventListener('click', handler)
         el.addEventListener('keydown', (e: Event) => {
           if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
             e.preventDefault()
             handler()
           }
         })

         cleanups.push(() => {
           el.removeEventListener('click', handler)
         })
       }

       return () => cleanups.forEach((fn) => fn())
     }, [block.hotspots, selectedHotspotIds, disabled])
     ```

   - After check, apply correct/incorrect styling to hotspot elements.

**Acceptance criteria**:

- [ ] Static SVG renders safely with sanitization
- [ ] Alt text is set for accessibility
- [ ] Caption renders below via RichTextRenderer
- [ ] Interactive mode: clicking hotspots toggles selection
- [ ] Keyboard: Tab to each hotspot, Enter/Space to toggle
- [ ] Visual feedback for selected/correct/incorrect states

---

### Step 3.4: Add SVG answer checking

**File**: `src/ui/web/exerciserenderer/utils/answerChecking.ts`
**Action**: MODIFY — add exported function for SVG checking

Since interactive SVG blocks are handled separately from the main `QuestionBlock` flow, add a standalone function:

```typescript
export function checkSvgAnswer(
  block: SvgBlock,
  selectedHotspotIds: string[],
  messages: AnswerErrorMessages,
): CheckResult {
  if (!block.correctHotspotIds || block.correctHotspotIds.length === 0) {
    return { isCorrect: false, message: messages.noCorrectAnswer }
  }
  if (selectedHotspotIds.length === 0) {
    return { isCorrect: false, message: messages.selectAnAnswer }
  }

  const correctSet = new Set(block.correctHotspotIds)
  const userSet = new Set(selectedHotspotIds)

  if (correctSet.size !== userSet.size) return { isCorrect: false }
  for (const id of userSet) {
    if (!correctSet.has(id)) return { isCorrect: false }
  }
  return { isCorrect: true }
}
```

Also add:

```typescript
export function getInitialSvgAnswer(): UserAnswer {
  return { type: 'svg', selectedHotspotIds: [] }
}
```

---

### Step 3.5: Integrate SVG into ExerciseRenderer

**File**: `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`
**Action**: MODIFY — add SVG handling in the block rendering loop

SVG blocks need special handling: they can be content (static) or question (interactive).

**1. Add imports**:

```typescript
import { SvgRenderer } from '../blocks/SvgRenderer'
import { checkSvgAnswer, getInitialSvgAnswer } from '../utils/answerChecking'
import type { SvgBlock } from '../types'
```

**2. Add SVG-specific state** (alongside existing `answers`, `checkResults` etc.):

```typescript
const [svgAnswers, setSvgAnswers] = useState<Record<string, UserAnswer>>({})
const [svgCheckResults, setSvgCheckResults] = useState<Record<string, CheckResult>>({})
```

**3. Add SVG handlers**:

```typescript
const handleSvgHotspotToggle = (blockId: string, hotspotId: string) => {
  setSvgAnswers((prev) => {
    const current = prev[blockId] ?? getInitialSvgAnswer()
    if (current.type !== 'svg') return prev
    const ids = current.selectedHotspotIds.includes(hotspotId)
      ? current.selectedHotspotIds.filter((id) => id !== hotspotId)
      : [...current.selectedHotspotIds, hotspotId]
    return { ...prev, [blockId]: { type: 'svg', selectedHotspotIds: ids } }
  })
}

const handleSvgCheck = (blockId: string, block: SvgBlock) => {
  const answer = svgAnswers[blockId] ?? getInitialSvgAnswer()
  if (answer.type !== 'svg') return
  const result = checkSvgAnswer(block, answer.selectedHotspotIds, errorMessages)
  setSvgCheckResults((prev) => ({ ...prev, [blockId]: result }))
}
```

**4. In the rendering loop**, add before the question block handling:

```typescript
if (block.type === 'svg') {
  const svgBlock = block as SvgBlock
  if (svgBlock.interactive && svgBlock.hotspots?.length) {
    const svgAnswer = svgAnswers[svgBlock.id] ?? getInitialSvgAnswer()
    const svgResult = svgCheckResults[svgBlock.id] || null
    const svgDisabled = svgResult?.isCorrect
    return (
      <QuestionCard
        key={svgBlock.id}
        showCheckButton={showCheckAnswer}
        onCheckAnswer={() => handleSvgCheck(svgBlock.id, svgBlock)}
        disabled={!!svgDisabled}
        loading={false}
        checked={!!svgResult}
        checkResult={svgResult}
        checkAnswerText={t('checkAnswer')}
        correctText={t('correct')}
        incorrectText={t('incorrect')}
      >
        <SvgRenderer
          block={svgBlock}
          selectedHotspotIds={svgAnswer.type === 'svg' ? svgAnswer.selectedHotspotIds : []}
          onHotspotToggle={(id) => handleSvgHotspotToggle(svgBlock.id, id)}
          disabled={!!svgDisabled}
          checkResult={svgResult}
          correctHotspotIds={svgBlock.correctHotspotIds}
        />
      </QuestionCard>
    )
  } else {
    return (
      <div key={svgBlock.id}>
        <SvgRenderer block={svgBlock} />
      </div>
    )
  }
}
```

**5. Add i18n keys** (in en.json and he.json under `courses`):

```json
"svgSelectHotspot": "Click on the correct region",
"svgBadge": "Diagram"
```

Hebrew: `"svgSelectHotspot": "לחץ על האזור הנכון"`, `"svgBadge": "דיאגרמה"`

---

### Step 3.6: Phase 3 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 4: JSXGraph React Wrapper (~3 hours)

### Step 4.1: Install JSXGraph

```bash
pnpm add jsxgraph
```

**Critical**: JSXGraph is ~960KB and accesses browser DOM at import time. It **cannot** be imported server-side. All components using it must use `next/dynamic` with `{ ssr: false }` or dynamic `import()` inside `useEffect`.

---

### Step 4.2: Create `JSXGraphBoard` React wrapper

**File**: `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`
**Action**: NEW file — `'use client'` component

**Props interface**:

```typescript
interface JSXGraphBoardProps {
  id: string
  width: number
  height: number
  boundingBox?: [number, number, number, number] // [xMin, yMax, xMax, yMin]
  showGrid?: boolean
  showAxis?: boolean
  axisConfig?: {
    axisColor?: string
    numberColor?: string
    labelColor?: string
    showNumbers?: boolean
    showLabels?: boolean
    ticks?: number
    labels?: { x: string; y: string }
  }
  onBoardReady: (board: JXG.Board) => void
  className?: string
}
```

**Implementation — step by step**:

1. **Refs**:

   ```typescript
   const containerRef = useRef<HTMLDivElement>(null)
   const boardRef = useRef<JXG.Board | null>(null)
   ```

2. **Board initialization via useEffect** — dynamic import to avoid SSR:

   ```typescript
   useEffect(() => {
     let board: JXG.Board | null = null
     let destroyed = false

     async function init() {
       // Dynamic import — this is critical for SSR safety
       const JXG = (await import('jsxgraph')).default || (await import('jsxgraph'))
       if (destroyed || !containerRef.current) return

       const containerId = `jsxgraph-${id}`
       board = JXG.JSXGraph.initBoard(containerId, {
         boundingbox: boundingBox || [-10, 10, 10, -10],
         axis: showAxis ?? false,
         grid: showGrid ?? false,
         showNavigation: false,
         showCopyright: false,
         keepAspectRatio: false,
         pan: { enabled: false },
         zoom: { enabled: false },
       })

       boardRef.current = board
       onBoardReady(board)
     }

     init()

     return () => {
       destroyed = true
       if (board) {
         try {
           JXG.JSXGraph.freeBoard(board)
         } catch {
           /* ignore cleanup errors */
         }
         boardRef.current = null
       }
     }
   }, [id]) // Only re-init when id changes
   ```

   **Note**: The `JXG` variable needs to be accessible in cleanup. You may need to store it in a ref or module-level variable.

3. **Resize handling**: Attach `ResizeObserver` on mount, call `board.resizeContainer()` on resize.

4. **Import JSXGraph CSS**:

   ```typescript
   import 'jsxgraph/distrib/jsxgraph.css'
   ```

5. **Render**:
   ```tsx
   return (
     <div
       ref={containerRef}
       id={`jsxgraph-${id}`}
       className={cn('w-full border rounded-lg overflow-hidden bg-white', className)}
       style={{ width, height, maxWidth: '100%' }}
     />
   )
   ```

**Acceptance criteria**:

- [ ] Board initializes on mount, destroys on unmount
- [ ] No SSR errors (dynamic import in useEffect)
- [ ] `onBoardReady` callback fires with board instance
- [ ] Container has correct dimensions
- [ ] No navigation/copyright UI shown

---

### Step 4.3: Create geometry element builders

**File**: `src/ui/web/exerciserenderer/graphics/geometryElements.ts`
**Action**: NEW file — pure functions, no React

**Master function**:

```typescript
import type { GeometrySpecV1 } from '@/infra/contracts'

export function renderGeometrySpec(board: JXG.Board, spec: GeometrySpecV1): void {
  const pointMap = renderPoints(board, spec.elements.points)
  renderLines(board, spec.elements.lines, pointMap)
  renderCircles(board, spec.elements.circles, pointMap)
  renderAngles(board, spec.elements.angles, pointMap)
  if (spec.elements.vectors) renderVectors(board, spec.elements.vectors, pointMap)
  if (spec.elements.areas) renderAreas(board, spec.elements.areas, pointMap)
  if (spec.elements.rectangles) renderRectangles(board, spec.elements.rectangles, pointMap)
  if (spec.elements.triangles) renderTriangles(board, spec.elements.triangles, pointMap)
  if (spec.elements.texts) renderTexts(board, spec.elements.texts, pointMap)
  if (spec.elements.equalSegments) renderEqualSegments(board, spec.elements.equalSegments, pointMap)
}
```

**Individual builder functions** — implement each one:

- `renderPoints`: `board.create('point', [x, y], { name, fixed: true, ...styles })` → return `Map<string, JXG.Point>`
- `renderLines`: `board.create('segment', [fromPoint, toPoint], { dash, strokeWidth, strokeColor, ...label })` using point names from Map
- `renderCircles`: `board.create('circle', [centerPoint, throughPoint || radius], { dash, strokeColor })`
- `renderAngles`: `board.create('angle', [ray1Point, centerPoint, ray2Point], { radius, type, strokeColor, ...label })`
- `renderVectors`: `board.create('arrow', [fromPoint, toPoint], { strokeColor, strokeWidth, dash })`
- `renderAreas`: `board.create('polygon', [point1, point2, ...], { fillColor, fillOpacity, borders: { strokeWidth: 0 } })`
- `renderRectangles`: Same as areas but exactly 4 points
- `renderTriangles`: Same as areas but exactly 3 points
- `renderTexts`: `board.create('text', [x, y, value], { fontSize })` — positioned on a line midpoint or at explicit coordinates
- `renderEqualSegments`: For each group, add tick marks at midpoints of equal segments

**Position mapping helper**:

```typescript
function mapPosition(pos?: string): string {
  const map: Record<string, string> = {
    tr: 'urt',
    tl: 'ult',
    br: 'lrt',
    bl: 'llft',
    t: 'top',
    b: 'bot',
    l: 'left',
    r: 'right',
    m: 'top',
  }
  return map[pos || 'tr'] || 'urt'
}
```

**Acceptance criteria**:

- [ ] All 12 element types from `GeometrySpecV1.elements` are handled
- [ ] Points created and accessible by name via Map
- [ ] Lines connect correct points
- [ ] Styles (solid/dashed, colors, thickness) applied
- [ ] Labels positioned correctly

---

### Step 4.4: Create axis element builders

**File**: `src/ui/web/exerciserenderer/graphics/axisElements.ts`
**Action**: NEW file — pure functions, no React

```typescript
import type { AxisSpecV1 } from '@/infra/contracts'
import { parseMathExpression } from '../utils/safeMathEval'

export function renderAxisSpec(board: JXG.Board, spec: AxisSpecV1): void {
  renderGraphs(board, spec.elements.graphs)
  renderAxisPoints(board, spec.elements.points)
  if (spec.elements.asymptotesVertical?.length)
    renderVerticalAsymptotes(board, spec.elements.asymptotesVertical)
  if (spec.elements.asymptotesHorizontal?.length)
    renderHorizontalAsymptotes(board, spec.elements.asymptotesHorizontal)
  renderGraphPaint(board, spec.elements.graphs)
  if (spec.elements.paintBetweenGraphs)
    renderPaintBetweenGraphs(board, spec.elements.paintBetweenGraphs, spec.elements.graphs)
  if (spec.elements.lineBetweenPoints)
    renderLineBetweenPoints(board, spec.elements.lineBetweenPoints)
}
```

**Key builders**:

- `renderGraphs`: For each graph, call `parseMathExpression(graph.fn)`. If valid, `board.create('functiongraph', [parsed.evaluate, rangeFrom, rangeTo], { strokeColor, strokeWidth, dash })`.
- `renderAxisPoints`: For `type: 'point'` → filled circle, `type: 'hole'` → open circle (white fill, colored stroke), `type: 'floating_text'` → text element.
- `renderVerticalAsymptotes`: For each x value, `board.create('line', [[x, 0], [x, 1]], { dash: 3, strokeColor: '#999', straightFirst: true, straightLast: true })`.
- `renderHorizontalAsymptotes`: Same but horizontal.
- `renderGraphPaint`: For each graph's `paint.underGraph`/`paint.aboveGraph`/`paint.integral` ranges, create filled regions using `board.create('curve', ...)` or polygon approximation.
- `renderPaintBetweenGraphs`: Find the two graph functions, sample points in the `[fromX, toX]` range, create a filled polygon between them.
- `renderLineBetweenPoints`: `board.create('segment', [[a.x, a.y], [b.x, b.y]], { dash, strokeWidth, strokeColor })`.

**Acceptance criteria**:

- [ ] Function graphs plot correctly using `parseMathExpression`
- [ ] Points render as filled circles or holes
- [ ] Asymptotes render as dashed vertical/horizontal lines
- [ ] Paint regions render as filled areas
- [ ] Line styles applied correctly

---

### Step 4.5: Phase 4 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 5: Geometry Renderer + Question (~4 hours)

### Step 5.1: Replace GeometryRenderer placeholder

**File**: `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx`
**Action**: MODIFY — replace entire file content

The new implementation uses `next/dynamic` to lazy-load `JSXGraphBoard`:

```typescript
'use client'

import React, { useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { GeometrySpecV1 } from '@/infra/contracts'
import { renderGeometrySpec } from '../../graphics/geometryElements'

const JSXGraphBoard = dynamic(
  () => import('../../graphics/JSXGraphBoard').then(m => ({ default: m.JSXGraphBoard })),
  { ssr: false, loading: () => <div className="w-full h-64 bg-muted animate-pulse rounded-lg" /> }
)

interface GeometryRendererProps {
  blockId: string
  spec: GeometrySpecV1
}

export function GeometryRenderer({ blockId, spec }: GeometryRendererProps) {
  const handleBoardReady = useCallback((board: JXG.Board) => {
    renderGeometrySpec(board, spec)
  }, [spec])

  const boundingBox = calculateBoundingBox(spec)

  return (
    <div className="my-4 flex justify-center">
      <JSXGraphBoard
        id={blockId}
        width={spec.canvas.width}
        height={spec.canvas.height}
        boundingBox={boundingBox}
        showGrid={spec.canvas.grid ?? false}
        showAxis={false}
        onBoardReady={handleBoardReady}
        className="border-border"
      />
    </div>
  )
}

function calculateBoundingBox(spec: GeometrySpecV1): [number, number, number, number] {
  const points = spec.elements.points
  if (points.length === 0) {
    return [-1, spec.canvas.height + 1, spec.canvas.width + 1, -1]
  }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const padding = 50
  return [
    Math.min(...xs) - padding,
    Math.max(...ys) + padding,
    Math.max(...xs) + padding,
    Math.min(...ys) - padding,
  ]
}
```

---

### Step 5.2: Create `GeometryQuestion` component

**File**: `src/ui/web/exerciserenderer/questions/GeometryQuestion/index.tsx`
**Action**: NEW file — `'use client'` component

**Props**: Same pattern as all other question components.

**Layout**:

1. Prompt (via `RichTextRenderer`)
2. Geometry diagram (via `GeometryRenderer`)
3. Answer input area — switches on `question.answer?.kind`:
   - No `answer` field → nothing (display-only)
   - `'numeric'` → `<input type="number" step="any" className="..." />`
   - `'mcq'` → radio/checkbox list (loop over `answer.options`, render `RichTextRenderer` for content, checkbox/radio for selection — reuse McqQuestion's styling pattern)
   - `'free_response'` → `<Textarea>` with auto-resize (reuse FreeResponseQuestion's pattern)
   - `'point'` → two `<input type="number">` side by side, labeled "X:" and "Y:"
   - `'function'` → `<input type="text" placeholder={t('enterExpression')} />`

**Wire `onChange`**: Convert input values to correct `UserAnswer` shape. Example for numeric:

```typescript
onChange({
  type: 'geometry',
  kind: 'numeric',
  numericValue: parseFloat(e.target.value),
})
```

---

### Step 5.3: Add geometry answer checking

**File**: `src/ui/web/exerciserenderer/utils/answerChecking.ts`
**Action**: MODIFY — add geometry case + shared `validateGenericAnswer` helper

**Add to `checkQuestionAnswer` switch**:

```typescript
    case 'question_geometry': {
      const geoQuestion = question as QuestionGeometryBlock
      if (!geoQuestion.answer) {
        return { isCorrect: false, message: 'No answer defined for this question' }
      }
      return validateGenericAnswer(geoQuestion.answer, answer, 'geometry', messages)
    }
```

**Add `validateGenericAnswer`** — this shared helper works for both geometry and axis:

```typescript
function validateGenericAnswer(
  expected: QuestionAnswer,
  userAnswer: UserAnswer,
  answerType: 'geometry' | 'axis',
  messages: AnswerErrorMessages,
): CheckResult {
  if (userAnswer.type !== answerType) {
    return { isCorrect: false, message: messages.invalidAnswerType }
  }

  switch (expected.kind) {
    case 'numeric': {
      const value = userAnswer.numericValue
      if (value === undefined || isNaN(value))
        return { isCorrect: false, message: messages.enterAnAnswer }
      const tolerance = expected.tolerance ?? 0.01
      return { isCorrect: Math.abs(value - expected.value) <= tolerance }
    }
    case 'mcq': {
      const selected = userAnswer.selectedOptionIds ?? []
      if (selected.length === 0) return { isCorrect: false, message: messages.selectAnAnswer }
      const userSorted = [...selected].sort()
      const correctSorted = [...expected.correctOptionIds].sort()
      return {
        isCorrect:
          userSorted.length === correctSorted.length &&
          userSorted.every((id, i) => id === correctSorted[i]),
      }
    }
    case 'free_response': {
      const text = userAnswer.textValue?.trim()
      if (!text) return { isCorrect: false, message: messages.enterAnAnswer }
      const normalized = text.toLowerCase().replace(/\s+/g, ' ')
      return {
        isCorrect: expected.acceptedAnswers.some(
          (a) => a.toLowerCase().replace(/\s+/g, ' ') === normalized,
        ),
      }
    }
    case 'point': {
      const point = userAnswer.point
      if (!point) return { isCorrect: false, message: messages.enterAnAnswer }
      const tolerance = expected.tolerance ?? 0.01
      return {
        isCorrect:
          Math.abs(point.x - expected.x) <= tolerance &&
          Math.abs(point.y - expected.y) <= tolerance,
      }
    }
    case 'function': {
      const expr = userAnswer.functionExpression?.trim()
      if (!expr) return { isCorrect: false, message: messages.enterAnAnswer }
      const normalized = expr.toLowerCase().replace(/\s+/g, '')
      return {
        isCorrect: expected.acceptedExpressions.some(
          (e) => e.toLowerCase().replace(/\s+/g, '') === normalized,
        ),
      }
    }
  }
}
```

**Add `getInitialAnswer` cases**:

```typescript
    case 'question_geometry':
      return { type: 'geometry', kind: (question as QuestionGeometryBlock).answer?.kind ?? 'numeric' }
```

---

### Step 5.4: Integrate geometry into ExerciseRenderer

**File**: `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`
**Action**: MODIFY

1. Import `GeometryQuestion`, `GeometryRenderer`, and type `QuestionGeometryBlock`
2. Extend `questionBlocks` filter: `block.type === 'question_geometry' && (block as QuestionGeometryBlock).answer !== undefined`
3. For geometry blocks WITHOUT `answer`: render as content block (diagram + prompt only)
4. For geometry blocks WITH `answer`: render inside `QuestionCard` with `<GeometryQuestion>`
5. Add `formatStudentAnswer` case for `'geometry'` and `'axis'`:
   ```typescript
   if (answer.type === 'geometry' || answer.type === 'axis') {
     if (answer.numericValue !== undefined) return String(answer.numericValue)
     if (answer.selectedOptionIds?.length) return answer.selectedOptionIds.join(', ')
     if (answer.textValue) return answer.textValue
     if (answer.point) return `(${answer.point.x}, ${answer.point.y})`
     if (answer.functionExpression) return answer.functionExpression
     return ''
   }
   ```

---

### Step 5.5: Phase 5 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 6: Axis Renderer + Question (~4 hours)

### Step 6.1: Replace AxisRenderer placeholder

**File**: `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`
**Action**: MODIFY — replace entire file content

Same pattern as GeometryRenderer (Step 5.1) but for axis:

- Use `renderAxisSpec` from `../../graphics/axisElements`
- Configure JSXGraph with `showAxis: true`, grid from `spec.grid.enabled`
- Pass `axisConfig` from `spec.axes`
- Calculate bounding box from `spec.viewport` (or default ±10)

---

### Step 6.2: Create `AxisQuestion` component

**File**: `src/ui/web/exerciserenderer/questions/AxisQuestion/index.tsx`
**Action**: NEW file

Identical structure to `GeometryQuestion` but uses `<AxisRenderer>` instead of `<GeometryRenderer>`. The answer input section is the same pattern. Uses `question.axis` for the spec prop.

---

### Step 6.3: Add axis answer checking + integration

**File**: `src/ui/web/exerciserenderer/utils/answerChecking.ts`
**Action**: MODIFY — add axis case (reuses `validateGenericAnswer`):

```typescript
    case 'question_axis': {
      const axisQuestion = question as QuestionAxisBlock
      if (!axisQuestion.answer) return { isCorrect: false, message: 'No answer defined' }
      return validateGenericAnswer(axisQuestion.answer, answer, 'axis', messages)
    }
```

Add `getInitialAnswer` case:

```typescript
    case 'question_axis':
      return { type: 'axis', kind: (question as QuestionAxisBlock).answer?.kind ?? 'numeric' }
```

Integrate into ExerciseRenderer following exact same pattern as geometry (Step 5.4).

**Add i18n keys** (en.json + he.json under `courses`):

```json
"geometryBadge": "Geometry",
"axisBadge": "Graph",
"enterCoordinates": "Enter coordinates",
"enterExpression": "Enter expression (e.g., x^2 + 1)"
```

Hebrew:

```json
"geometryBadge": "גיאומטריה",
"axisBadge": "גרף",
"enterCoordinates": "הזן קואורדינטות",
"enterExpression": "הזן ביטוי (לדוגמה: x^2 + 1)"
```

---

### Step 6.4: Phase 6 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 7: Hint/Solution Reveal UI (~2 hours)

### Step 7.1: Create `HintSolutionPanel` component

**File**: `src/ui/web/exerciserenderer/components/HintSolutionPanel/index.tsx`
**Action**: NEW file — `'use client'` component

**Props**:

```typescript
interface HintSolutionPanelProps {
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  t: (key: string) => string
}
```

**Implementation**:

1. **State**: `showHint`, `showSolution`, `showFullSolution` — all `useState(false)`

2. **Progressive reveal logic**:
   - Hint button: always visible (if hint content is non-empty — `hint?.value?.trim()`)
   - Solution button: visible only if `showHint === true` OR no hint exists
   - Full Solution button: visible only if `showSolution === true` OR no solution exists

3. **Render pattern** (repeat for each field with appropriate icon):

   ```tsx
   {
     hint && hint.value.trim() !== '' && (
       <div className="mt-3">
         <button
           onClick={() => setShowHint(!showHint)}
           className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
         >
           <Lightbulb className="w-4 h-4" />
           {showHint ? t('hideHint') : t('showHint')}
         </button>
         {showHint && (
           <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border text-sm">
             <RichTextRenderer block={{ ...hint, id: 'hint' }} />
           </div>
         )}
       </div>
     )
   }
   ```

4. **Icons** (from `lucide-react`): `Lightbulb` for hint, `BookOpen` for solution, `FileText` for full solution.

---

### Step 7.2: Integrate into QuestionCard

**File**: `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx`
**Action**: MODIFY — add optional props and render `HintSolutionPanel`

**Add optional props** to `QuestionCardProps`:

```typescript
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  t?: (key: string) => string
```

**Render** between `{children}` and the check button:

```tsx
      {children}

      {/* Hint/Solution Panel */}
      {(hint || solution || fullSolution) && t && (
        <div className="mt-card-padding">
          <HintSolutionPanel hint={hint} solution={solution} fullSolution={fullSolution} t={t} />
        </div>
      )}

      {/* Check Answer Button */}
      {showCheckButton && ( ... )}
```

---

### Step 7.3: Pass hint/solution from ExerciseRenderer to QuestionCard

**File**: `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`
**Action**: MODIFY — add `hint`, `solution`, `fullSolution`, `t` props to every `<QuestionCard>` call

This applies to ALL question types (existing + new). For each `<QuestionCard>` rendering:

```typescript
<QuestionCard
  key={question.id}
  // ... existing props ...
  hint={question.hint}
  solution={question.solution}
  fullSolution={question.fullSolution}
  t={t}
>
```

**Add i18n keys** (en.json + he.json under `courses`):

```json
"showHint": "Show Hint",
"hideHint": "Hide Hint",
"showSolution": "Show Solution",
"hideSolution": "Hide Solution",
"showFullSolution": "Show Full Solution",
"hideFullSolution": "Hide Full Solution"
```

Hebrew:

```json
"showHint": "הצג רמז",
"hideHint": "הסתר רמז",
"showSolution": "הצג פתרון",
"hideSolution": "הסתר פתרון",
"showFullSolution": "הצג פתרון מלא",
"hideFullSolution": "הסתר פתרון מלא"
```

---

### Step 7.4: Phase 7 quality gate

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

---

## Phase 8: Testing (~4 hours)

### Step 8.1: Matching answer checking unit tests

**File**: `tests/unit/exercise-renderer/matchingChecking.test.ts`
**Action**: NEW file

**Test cases** (use `describe`/`it` from vitest):

- `it('returns correct for exact match of all pairs')`
- `it('returns incorrect with partial score message for partial match')`
- `it('returns error for empty connections')`
- `it('returns error for wrong answer type')`
- `it('returns incorrect when extra connections beyond correct pairs')`
- `it('handles single pair correctly')`
- `it('handles reversed pair order (same set, different array order) as correct')`

Import `checkQuestionAnswer` from the utils and construct mock `QuestionMatchingBlock` objects.

---

### Step 8.2: SVG sanitization unit tests

**File**: `tests/unit/exercise-renderer/svgSanitize.test.ts`
**Action**: NEW file

**Test cases**:

- `it('passes clean SVG through unchanged')`
- `it('strips script tags')`
- `it('strips onclick attributes')`
- `it('strips onerror attributes')`
- `it('strips foreignObject elements')`
- `it('preserves data-hotspot-id attributes')`
- `it('preserves standard SVG elements (circle, rect, path)')`
- `it('handles empty string')`
- `it('does not throw on malformed markup')`

---

### Step 8.3: SVG hotspot checking unit tests

**File**: `tests/unit/exercise-renderer/svgChecking.test.ts`
**Action**: NEW file

**Test cases**:

- `it('returns correct for exact single hotspot match')`
- `it('returns correct for exact multi-hotspot match')`
- `it('returns incorrect for wrong hotspot')`
- `it('returns incorrect for subset of correct hotspots')`
- `it('returns incorrect for superset of correct hotspots')`
- `it('returns error for no selection')`
- `it('returns error when no correct answer defined')`

---

### Step 8.4: Geometry/Axis answer checking unit tests

**File**: `tests/unit/exercise-renderer/geometryChecking.test.ts`
**Action**: NEW file

**Test cases per answer kind**:

- `describe('numeric')`: exact match, within tolerance, outside tolerance, NaN input, missing value
- `describe('mcq')`: all correct, partial, none selected, wrong type
- `describe('free_response')`: exact match, case-insensitive, whitespace variations, no match, empty
- `describe('point')`: exact match, within tolerance, x correct y wrong, missing point
- `describe('function')`: exact match, whitespace normalization, case normalization, no match, empty

**File**: `tests/unit/exercise-renderer/axisChecking.test.ts`
**Action**: NEW file — same test cases but with `type: 'axis'` answers. Can be very similar to geometry tests since they share `validateGenericAnswer`.

---

### Step 8.5: Extend schema integration tests

**File**: `tests/int/contracts/exercise-content-blocks.int.spec.ts`
**Action**: MODIFY — add new test cases to existing describe blocks

**Add to `SvgBlockSchema` describe block**:

- `it('validates interactive SVG with hotspots')` — valid data with `interactive: true`, `hotspots`, `correctHotspotIds`
- `it('rejects correctHotspotIds referencing non-existent hotspot ID')`
- `it('rejects interactive SVG with no hotspots')`
- `it('validates non-interactive SVG with new optional fields omitted')` — backwards compat

**Add to `QuestionGeometryBlockSchema` describe block**:

- `it('validates geometry with numeric answer')` — `answer: { kind: 'numeric', value: 42, tolerance: 0.5 }`
- `it('validates geometry with mcq answer')` — `answer: { kind: 'mcq', options: [...], correctOptionIds: [...] }`
- `it('validates geometry without answer (display-only)')` — no `answer` field
- `it('rejects geometry with invalid answer kind')`

**Add to `QuestionAxisBlockSchema` describe block**:

- Same 4 test cases as geometry

---

### Step 8.6: Final quality gate

```bash
pnpm -s tsc --noEmit
pnpm vitest run tests/unit/exercise-renderer/
pnpm vitest run tests/int/contracts/exercise-content-blocks.int.spec.ts
pnpm -s lint
pnpm generate:importmap
```

**All commands must pass.**

---

## Full Summary

| #   | File                                                                 | Action | Phase     |
| --- | -------------------------------------------------------------------- | ------ | --------- |
| 1   | `src/shared/exercise-content/types.ts`                               | MODIFY | 1         |
| 2   | `src/shared/exercise-content/defaults.ts`                            | MODIFY | 1         |
| 3   | `src/server/payload/collections/Exercises/schemas.ts`                | MODIFY | 1         |
| 4   | `src/ui/web/exerciserenderer/types.ts`                               | MODIFY | 1         |
| 5   | `src/ui/web/exerciserenderer/utils/extractMediaIds.ts`               | MODIFY | 1         |
| 6   | `src/i18n/en.json`                                                   | MODIFY | 2,3,6,7   |
| 7   | `src/i18n/he.json`                                                   | MODIFY | 2,3,6,7   |
| 8   | `src/ui/web/exerciserenderer/questions/MatchingQuestion/index.tsx`   | NEW    | 2         |
| 9   | `src/ui/web/exerciserenderer/utils/answerChecking.ts`                | MODIFY | 2,3,5,6   |
| 10  | `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`             | MODIFY | 2,3,5,6,7 |
| 11  | `src/ui/web/exerciserenderer/utils/svgSanitize.ts`                   | NEW    | 3         |
| 12  | `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx`           | NEW    | 3         |
| 13  | `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`             | NEW    | 4         |
| 14  | `src/ui/web/exerciserenderer/graphics/geometryElements.ts`           | NEW    | 4         |
| 15  | `src/ui/web/exerciserenderer/graphics/axisElements.ts`               | NEW    | 4         |
| 16  | `src/ui/web/exerciserenderer/blocks/GeometryRenderer/index.tsx`      | MODIFY | 5         |
| 17  | `src/ui/web/exerciserenderer/questions/GeometryQuestion/index.tsx`   | NEW    | 5         |
| 18  | `src/ui/web/exerciserenderer/blocks/AxisRenderer/index.tsx`          | MODIFY | 6         |
| 19  | `src/ui/web/exerciserenderer/questions/AxisQuestion/index.tsx`       | NEW    | 6         |
| 20  | `src/ui/web/exerciserenderer/components/HintSolutionPanel/index.tsx` | NEW    | 7         |
| 21  | `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx`      | MODIFY | 7         |
| 22  | `src/ui/web/exerciserenderer/components/FeedbackDisplay/index.tsx`   | MODIFY | 2         |
| 23  | `tests/unit/exercise-renderer/matchingChecking.test.ts`              | NEW    | 8         |
| 24  | `tests/unit/exercise-renderer/svgSanitize.test.ts`                   | NEW    | 8         |
| 25  | `tests/unit/exercise-renderer/svgChecking.test.ts`                   | NEW    | 8         |
| 26  | `tests/unit/exercise-renderer/geometryChecking.test.ts`              | NEW    | 8         |
| 27  | `tests/unit/exercise-renderer/axisChecking.test.ts`                  | NEW    | 8         |
| 28  | `tests/int/contracts/exercise-content-blocks.int.spec.ts`            | MODIFY | 8         |

**Totals**: 15 new files, 13 modified files, 2 new dependencies (`jsxgraph`, `isomorphic-dompurify`)
