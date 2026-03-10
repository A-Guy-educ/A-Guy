# Web UI Behavioral HLS - AI-Optimized

**Purpose**: Extend exercise renderer to support 4 NEW question types
**Version**: 1.0 | **Date**: 2026-02-16
**Related**: Types in [`src/shared/exercise-content/types.ts`](src/shared/exercise-content/types.ts), Schemas in [`src/server/payload/collections/Exercises/schemas.ts`](src/server/payload/collections/Exercises/schemas.ts)

---

## Context: What Exists vs What We're Adding

### Existing System (Already Implemented)

**Current Question Types**:
| Block Type | Status | Description |
|------------|--------|-------------|
| `question_select` (true_false) | ✅ Done | True/False selection |
| `question_select` (mcq) | ✅ Done | Multiple choice |
| `question_free_response` | ✅ Done | Free text/numeric input |
| `table` | ✅ Done | Table-based questions |
| `rich_text` | ✅ Done | Rich text content |

**Existing Renderer Structure** (`src/ui/web/exerciserenderer/`):

```
ExerciseRenderer/
├── ExerciseRenderer/index.tsx      # Main orchestrator
├── questions/                     # Question components
│   ├── TrueFalseQuestion/
│   ├── McqQuestion/
│   └── FreeResponseQuestion/
├── blocks/                        # Content block renderers
│   ├── BlockRenderer/
│   ├── RichTextRenderer/
│   └── (placeholders for Geometry, Axis)
└── utils/
    ├── answerChecking.ts
    └── checkAnswer.ts
```

---

## What We're Adding (New Question Types)

| Block Type          | New    | Migration Source                                        |
| ------------------- | ------ | ------------------------------------------------------- |
| `question_matching` | ✅ NEW | `/Users/aguy/projects/aguy/Backend/handlers/exercises/` |
| `svg`               | ✅ NEW | Same as above                                           |
| `question_geometry` | ✅ NEW | Same as above                                           |
| `question_axis`     | ✅ NEW | Same as above                                           |

---

## 1. Quick Reference Matrix

| Type     | Block Type          | Extends | Key Feature       | Validation          | User Input            |
| -------- | ------------------- | ------- | ----------------- | ------------------- | --------------------- |
| Matching | `question_matching` | New     | Drag/click pairs  | Exact array match   | Connections           |
| SVG      | `svg`               | New     | Hotspot selection | ID match            | Click                 |
| Geometry | `question_geometry` | New     | Canvas elements   | Numeric/MCQ/free    | Point selection/input |
| Axis     | `question_axis`     | New     | Coordinate system | Coordinate/function | Point/function input  |

---

## 2. Question Type Specifications

### 2.1 Matching Question (`question_matching`)

**Reference**: [`MatchingOption`](src/shared/exercise-content/types.ts:142), [`MatchingPair`](src/shared/exercise-content/types.ts:150), [`QuestionMatchingBlock`](src/shared/exercise-content/types.ts:158)

**User Flow**: Click left → Click right → Connection drawn → Submit

**State Interface**:

```typescript
interface MatchingState {
  selectedLeft: string | null
  selectedRight: string | null
  connections: Array<{ left: string; right: string }>
  isChecking: boolean
  checkResult: CheckResult | null
}

interface UserAnswerMatching {
  type: 'matching'
  connections: MatchingConnection[]
}

interface MatchingConnection {
  leftOptionId: string
  rightOptionId: string
}
```

**Visual States**:
| State | Visual |
|-------|--------|
| `default` | Standard styling |
| `selected` | Blue border + background |
| `connected` | Colored line + indicator |
| `correct` | Green border + line |
| `incorrect` | Red border + line |

**Integration Points**:

- Add to `UserAnswer` union in [`types.ts:9`](src/ui/web/exerciserenderer/types.ts:9)
- Add handler in [`answerChecking.ts`](src/ui/web/exerciserenderer/utils/answerChecking.ts)
- Create new component at `questions/MatchingQuestion/`

---

### 2.2 SVG Question (`svg`)

**Reference**: [`SvgBlock`](src/shared/exercise-content/types.ts:174)

**Rendering Modes**:
| Mode | Interaction | Use Case |
|------|-------------|----------|
| `static` | None | Display only |
| `interactive` | Click hotspots | Selection questions |
| `annotated` | Overlay labels | Educational |
| `zoomable` | Pan/zoom | Complex diagrams |

**Hotspot Structure**:

```typescript
interface SvgHotspot {
  id: string
  selector: string
  shape: 'rect' | 'circle' | 'path' | 'polygon'
  bounds: { x: number; y: number; width: number; height: number }
  label?: string
}

interface UserAnswerSvg {
  type: 'svg'
  selectedHotspotIds: string[]
}
```

**Accessibility**:

- `role="img"` for static, `role="application"` for interactive
- Tab navigation to hotspots
- ARIA labels for each region

**Integration Points**:

- Create `SvgRenderer` component in `blocks/SvgRenderer/`
- Handle in `BlockRenderer` switch statement
- Add to `ContentBlock` union

---

### 2.3 Geometry Question (`question_geometry`)

**Reference**: [`QuestionGeometryBlock`](src/shared/exercise-content/types.ts:185), [`GeometrySpecV1`](src/infra/contracts/graphics/geometry.v1.ts:194)

**GeometrySpecV1 Elements** (from [`geometry.v1.ts`](src/infra/contracts/graphics/geometry.v1.ts)):

| Element        | Schema Line | Render         | Interaction |
| -------------- | ----------- | -------------- | ----------- |
| `Point`        | :19         | Circle + label | Select/drag |
| `Line`         | :36         | Segment        | Select      |
| `Circle`       | :46         | Arc + center   | Select      |
| `Angle`        | :62         | Arc + label    | Select      |
| `Vector`       | :73         | Arrow          | Select/drag |
| `Area`         | :82         | Polygon fill   | Select      |
| `Rectangle`    | :89         | 4-point shape  | Select      |
| `Triangle`     | :98         | 3-point shape  | Select      |
| `Text`         | :107        | Label on/at    | Select      |
| `EqualSegment` | :126        | Tick marks     | Select      |
| `EqualAngle`   | :156        | Arc marks      | Select      |
| `Tangent`      | :134        | Line + circle  | Select      |

**User Answers**:

```typescript
interface UserAnswerGeometry {
  type: 'geometry'
  responseKind: 'numeric' | 'mcq' | 'free_response'
  // For numeric
  value?: number
  // For MCQ
  selectedOptionIds?: string[]
  // For free response
  textValue?: string
}
```

**Toolbar Tools**:

```
[Select] [Drag] [Measure] [Zoom+] [Zoom-] [Fit] [Reset]
```

**Canvas Config** (from [`CanvasSchema`](src/infra/contracts/graphics/geometry.v1.ts:11)):

```typescript
interface GeometryCanvas {
  width: number
  height: number
  background?: string
  grid?: boolean
}
```

**Integration Points**:

- Already has placeholder at [`blocks/GeometryRenderer/`](src/ui/web/exerciserenderer/blocks/GeometryRenderer/)
- Update with full implementation
- Add to `UserAnswer` union
- Create `GeometryQuestion` component in `questions/`

---

### 2.4 Axis Question (`question_axis`)

**Reference**: [`QuestionAxisBlock`](src/shared/exercise-content/types.ts:198), [`AxisSpecV1`](src/infra/contracts/graphics/axis.v1.ts:172)

**AxisSpecV1 Elements** (from [`axis.v1.ts`](src/infra/contracts/graphics/axis.v1.ts)):

| Element              | Schema Line | Properties                       | Interaction |
| -------------------- | ----------- | -------------------------------- | ----------- |
| `Point`              | :45         | x, y, type (point/hole/floating) | Add/move    |
| `Graph`              | :62         | fn, style, color, range          | Add         |
| `Asymptote`          | :108        | vertical/horizontal              | Static      |
| `LineBetweenPoints`  | :93         | a, b, style                      | Add         |
| `GeometricLocus`     | :108        | equation, style                  | Static      |
| `PaintBetweenGraphs` | :84         | firstGraph, secondGraph, range   | Add         |

**Function Support**:

```
Basic: 2*x + 1
Powers: x^2, x^3, x^n
Roots: sqrt(x), cbrt(x)
Trig: sin(x), cos(x), tan(x), cot(x)
Log/Exp: ln(x), log(x), e^x, 10^x
Other: abs(x), pi, e
```

**User Answers**:

```typescript
interface UserAnswerAxis {
  type: 'axis'
  responseKind: 'point' | 'function' | 'expression' | 'region'
  // For point
  point?: { x: number; y: number }
  // For function
  functionExpression?: string
}
```

**Toolbar**:

```
[Pan] [Zoom] [Fit] [AddPoint] [AddFunction] [Clear] [Reset]
```

**Integration Points**:

- Already has placeholder at [`blocks/AxisRenderer/`](src/ui/web/exerciserenderer/blocks/AxisRenderer/)
- Update with full implementation
- Add to `UserAnswer` union
- Create `AxisQuestion` component in `questions/`

---

## 3. Validation Matrix

| Question Type          | Validation Method            | Response Type           | Handler Location                 |
| ---------------------- | ---------------------------- | ----------------------- | -------------------------------- |
| Matching               | Exact pair array comparison  | Boolean + partial score | `utils/answerChecking.ts`        |
| SVG Hotspot            | ID exact match               | Boolean                 | `utils/answerChecking.ts`        |
| Geometry Numeric       | Tolerance comparison (±0.01) | Boolean + value         | `utils/answerChecking.ts`        |
| Geometry MCQ           | Option ID match              | Boolean                 | `utils/answerChecking.ts`        |
| Geometry Free Response | Algebraic/text normalization | Boolean                 | `/api/exercises/validate-answer` |
| Axis Point             | Coordinate tolerance         | Boolean + coord         | `utils/answerChecking.ts`        |
| Axis Function          | Expression evaluation        | Boolean                 | `utils/answerChecking.ts`        |
| Axis Expression        | CAS comparison               | Boolean                 | `/api/exercises/validate-answer` |

---

## 4. Hint/Solution System

**Note**: Uses existing `hint` and `solution` fields from block definitions

**Hint Triggers**: Click button, timer (N sec), N wrong attempts, manual

**Hint Types**: Text, Visual highlight, Step-by-step, Partial answer, Related concept

**Solution Triggers**: Click button, timeout, N wrong attempts, correct answer (review mode)

**Solution Types**: Short answer, Full solution, Visual, Worked example, Alternative approach

**Tracking**: Hints used, time to first hint, attempt count

---

## 5. Feedback Patterns

| Context           | Feedback Type | Content                        |
| ----------------- | ------------- | ------------------------------ |
| True/False        | Immediate     | ✓/✗ icon + color bg            |
| After Check       | Detailed      | Message + hints + actions      |
| Multiple Attempts | Progressive   | Attempt counter + availability |
| Success           | Celebration   | Score + time + actions         |

---

## 6. Accessibility Checklist

**Visual**:

- [ ] Color contrast ≥ 4.5:1
- [ ] No color-only information
- [ ] Visible focus indicators (2px)
- [ ] Text resize 200%

**Keyboard**:

- [ ] All interactions keyboard-accessible
- [ ] Logical tab order
- [ ] No keyboard traps
- [ ] Skip links

**Screen Reader**:

- [ ] Alt text for images
- [ ] ARIA labels
- [ ] Live region announcements
- [ ] Error announcements

**Touch**:

- [ ] 44×44px minimum targets
- [ ] Gestures: tap, long-press, swipe, pinch, drag

---

## 7. RTL Adaptations

| Component            | LTR        | RTL                            |
| -------------------- | ---------- | ------------------------------ |
| Matching columns     | Left→Right | Columns swap                   |
| Matching connections | Left→Right | Draw same direction            |
| Axis systems         | No change  | No change (math is always LTR) |
| Text alignment       | Left       | Right                          |

---

## 8. Component Hierarchy

```
ExerciseRenderer/
├── ExerciseRenderer/index.tsx      # UPDATE: Add new question handlers
├── questions/                     # NEW: MatchingQuestion/
│   ├── TrueFalseQuestion/        # Existing
│   ├── McqQuestion/              # Existing
│   ├── FreeResponseQuestion/     # Existing
│   ├── MatchingQuestion/         # NEW
│   ├── GeometryQuestion/         # NEW
│   └── AxisQuestion/             # NEW
├── blocks/                       # UPDATE: Implement placeholders
│   ├── BlockRenderer/index.tsx   # UPDATE: Add new block types
│   ├── RichTextRenderer/         # Existing
│   ├── GeometryRenderer/         # UPDATE: Full implementation
│   ├── AxisRenderer/             # UPDATE: Full implementation
│   └── SvgRenderer/               # NEW
└── utils/
    ├── answerChecking.ts         # UPDATE: Add new validators
    └── checkAnswer.ts            # Update if needed
```

---

## 9. State Management Updates

**Current State** (from [`types.ts`](src/ui/web/exerciserenderer/types.ts:9)):

```typescript
export type UserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; value: boolean | null }
  | { type: 'free_response'; value: string }
  // ADD:
  | { type: 'matching'; connections: MatchingConnection[] }
  | { type: 'svg'; selectedHotspotIds: string[] }
  | { type: 'geometry'; value: number | selectedOptionIds: string[] | textValue: string }
  | { type: 'axis'; point?: { x: number; y: number }; functionExpression?: string }
```

**Global State** (add to [`ExerciseRenderer/index.tsx`](src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx)):

```typescript
interface ExerciseState {
  blocks: ContentBlock[]
  answers: Record<string, UserAnswer>
  checkResults: Record<string, CheckResult>
  hintsRevealed: Record<string, number>
  solutionRevealed: Record<string, boolean>
  selectedElements: Record<string, string[]>
  canvasState: Record<string, { zoom: number; pan: { x: number; y: number } }>
}
```

---

## 10. Implementation Phases

| Phase | Component                          | Priority | Status |
| ----- | ---------------------------------- | -------- | ------ |
| 1     | `MatchingQuestion` + `SvgRenderer` | High     | Todo   |
| 2     | `GeometryRenderer` (basic)         | Medium   | Todo   |
| 3     | `AxisRenderer` (basic)             | Medium   | Todo   |
| 4     | Geometry/Axis interactions         | Low      | Todo   |
| 5     | Hint/Solution UI                   | Medium   | Todo   |

---

## 11. Performance Targets

| Operation             | Target         |
| --------------------- | -------------- |
| Initial render        | < 100ms        |
| SVG update            | < 16ms (60fps) |
| Geometry/Axis canvas  | < 16ms (60fps) |
| Answer check (client) | < 50ms         |
| Function plot         | < 100ms        |

**Optimizations**:

- Code-split by question type (lazy load)
- requestAnimationFrame for updates
- Web Workers for function evaluation
- Memoize expensive computations

---

## 12. Testing Requirements

| Level             | Coverage                            | Files           |
| ----------------- | ----------------------------------- | --------------- |
| Unit              | Validation logic, state transitions | `tests/unit/`   |
| Integration       | Complete flows, API, persistence    | `tests/int/`    |
| E2E               | All question types, hint/solution   | `tests/e2e/`    |
| A11y              | Keyboard, screen reader, contrast   | `tests/a11y/`   |
| Visual Regression | All states, RTL, responsive         | `tests/visual/` |

**Reference**: Existing tests at [`tests/int/contracts/exercise-content-blocks.int.spec.ts`](tests/int/contracts/exercise-content-blocks.int.spec.ts)

---

## 13. Dependencies

| Need                    | Solution               | Status  |
| ----------------------- | ---------------------- | ------- |
| Math expression parsing | mathjs or custom       | Todo    |
| Function graphing       | Custom + function-plot | Todo    |
| Geometry rendering      | Canvas API             | Todo    |
| Drag-and-drop           | dnd-kit or custom      | Todo    |
| Math typesetting        | KaTeX (existing)       | ✅ Done |

---

## 14. Key Code Patterns

### 14.1 Add to ExerciseRenderer Switch

**Location**: [`ExerciseRenderer/index.tsx`](src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx:221)

```typescript
// ADD new question types:
{ question.type === 'question_matching' && (
  <MatchingQuestion
    question={question as QuestionMatchingBlock}
    answer={answer}
    onChange={(ans) => handleAnswerChange(question.id, ans)}
    disabled={!!disabled}
    checkResult={checkResult}
  />
)}
{ question.type === 'question_geometry' && (
  <GeometryQuestion
    question={question as QuestionGeometryBlock}
    answer={answer}
    onChange={(ans) => handleAnswerChange(question.id, ans)}
    disabled={!!disabled}
    checkResult={checkResult}
  />
)}
{ question.type === 'question_axis' && (
  <AxisQuestion
    question={question as QuestionAxisBlock}
    answer={answer}
    onChange={(ans) => handleAnswerChange(question.id, ans)}
    disabled={!!disabled}
    checkResult={checkResult}
  />
)}
```

### 14.2 Add to BlockRenderer Switch

**Location**: [`BlockRenderer/index.tsx`](src/ui/web/exerciserenderer/blocks/BlockRenderer/index.tsx:14)

```typescript
// ADD new block types:
case 'svg':
  return <SvgRenderer block={block as SvgBlock} />
case 'question_geometry':
  return <GeometryRenderer blockId={block.id} spec={(block as QuestionGeometryBlock).geometry} />
case 'question_axis':
  return <AxisRenderer blockId={block.id} spec={(block as QuestionAxisBlock).axis} />
```

### 14.3 Add to Answer Checking

**Location**: [`utils/answerChecking.ts`](src/ui/web/exerciserenderer/utils/answerChecking.ts:23)

```typescript
case 'question_matching':
  return validateMatchingAnswer(question, answer, messages)
case 'question_geometry':
  return validateGeometryAnswer(question, answer, messages)
case 'question_axis':
  return validateAxisAnswer(question, answer, messages)
```

---

## 15. Integration Checklist

- [ ] Update `UserAnswer` union in [`types.ts`](src/ui/web/exerciserenderer/types.ts)
- [ ] Create `MatchingQuestion` component
- [ ] Create `SvgRenderer` component
- [ ] Update `GeometryRenderer` placeholder
- [ ] Update `AxisRenderer` placeholder
- [ ] Create `GeometryQuestion` component
- [ ] Create `AxisQuestion` component
- [ ] Add handlers in `ExerciseRenderer/index.tsx`
- [ ] Add handlers in `BlockRenderer/index.tsx`
- [ ] Add validators in `utils/answerChecking.ts`
- [ ] Add tests for all new types
- [ ] Verify i18n (en.json, he.json)
- [ ] Verify RTL layout
- [ ] Verify mobile responsive
- [ ] Verify accessibility

---

## 16. Open Questions (To Resolve)

1. **Q1**: Geometry interaction - drag points or select only?
2. **Q2**: Function parsing - full CAS or basic only?
3. **Q3**: Matching - drag essential or tap sufficient?
4. **Q4**: Mobile - platform gestures or unified?
5. **Q5**: Offline - local storage + sync?

---

**Full Spec**: [`tasks/20261116-web-ui-behavioral-spec.md`](tasks/20261116-web-ui-behavioral-spec.md)
**Admin Spec**: [`tasks/20261116-phase2-admin-editors-spec.md`](tasks/20261116-phase2-admin-editors-spec.md)
