# Exercises Collection

**Status**: ✅ Complete

This directory documents the Exercises collection in Payload CMS, including fields, Zod validation, and rendering behavior.

---

## Overview

The Exercises collection provides a minimal foundation for creating and managing educational exercises with strongly-typed content and answer specifications.

### Key Features

- **Block-Based Content**: Each exercise's content is a stream of typed blocks (questions + presentational)
- **Zod Validation**: Runtime validation of block structures via `ContentBlockSchema`
- **Self-Contained Questions**: Each question block owns its own prompt, answer, and optional hint/solution
- **Relationship to Lessons**: Each exercise belongs to a Lesson
- **Scroll View Rendering**: Exercises render as a "Scroll view" document — same blocks as the Interactive tab, styled as a static card with no inputs
- **Type-Safe**: Full TypeScript integration with Payload

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Payload Admin UI                      │
│  (Block-based content via Payload Admin)                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          Exercises Collection (Payload)                  │
│  src/server/payload/collections/Exercises/index.ts      │
│                                                          │
│  Fields:                                                 │
│  - title: string (optional, admin reference)            │
│  - lesson: relationship → Lessons                       │
│  - content: JSON { blocks: ContentBlock[] }             │
│                                                          │
│  beforeChange Hook:                                      │
│  - Validates content.blocks with ContentBlockSchema     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│             Scroll View (BlocksDocumentLessonView)       │
│  src/app/(frontend)/courses/.../BlocksDocumentLessonView│
│                                                          │
│  - Renders exercises as a static "Scroll view" card    │
│  - Uses ExerciseWorksheet for block rendering           │
│  - Collects fullSolution/solution into Solutions section │
│  - Locale-aware: RTL for Hebrew, LTR for English       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          ExerciseWorksheet (block renderer)               │
│  src/ui/web/exerciserenderer/ExerciseWorksheet/          │
│                                                          │
│  - question_geometry / question_axis → GraphWithPrompt   │
│    (card-wrapped, 50/50 split, 3/5 wrap, RTL-aware)   │
│  - question_multi_axis → MultiAxisRenderer               │
│  - question_select → WorksheetMcq / WorksheetTrueFalse   │
│  - question_table → side-by-side (narrow) or stacked    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          GraphWithPrompt (geometry/axis wrapper)          │
│  src/ui/web/exerciserenderer/blocks/GraphWithPrompt/   │
│                                                          │
│  - 4 layouts: textAbove, textBelow, textLeft, textRight │
│  - Forces dir='ltr' on flex container for RTL safety   │
│  - 3/5 wrap rule: wide diagrams (>5:3) stack vertically│
│  - worksheetLayout: 50/50 proportions, mobile stacking  │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

### Minimal Fields (Stage 0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | ❌ | Exercise title (admin reference, optional) |
| `lesson` | `relationship` | ✅ | Reference to Lessons collection |
| `content` | `json` | ✅ | Block stream `{ blocks: ContentBlock[] }` validated by `ContentBlockSchema` |

### Validation Rules

1. **Content Validation**: `content.blocks` must pass [`ContentBlockSchema`](../../../src/server/payload/collections/Exercises/schemas.ts) — a discriminated union of 12 block types.
2. Each question block (`question_geometry`, `question_axis`, etc.) carries its own prompt, answer, and optional hint/solution inline — there is no exercise-level `questionType` or `answerSpecJson`.

---

## Quick Start

### 1. Prerequisites

Ensure you have:
- Payload CMS running locally
- At least one Lesson in the database
- Admin user access

### 2. Create an Exercise

1. Navigate to **Exercises** in Payload Admin
2. Click **Create New**
3. Fill in fields using samples from [MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md)
4. Click **Save**

### 3. Verification

Follow the complete manual verification guide:
- [📋 MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md)

---

## Implementation Details

### File Structure

```
src/server/payload/collections/Exercises/index.ts   # Payload collection config
src/server/payload/collections/Exercises/schemas.ts # Zod schemas (ContentBlockSchema, etc.)
docs/exercises/
  ├── README.md                       # This file
  └── MANUAL_VERIFICATION.md          # Verification guide with samples
```

### Code Highlights

**Collection Configuration**:
```typescript
export const Exercises: CollectionConfig = {
  slug: 'exercises',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'lesson', 'updatedAt'],
  },
  access: {
    read: anyone,
    create: authenticated,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  fields: [
    // ... fields
  ],
  hooks: {
    beforeChange: [enforceContentStructure /* + auto-populate course from lesson */],
  },
}
```

**Schema**:
```typescript
import { ContentBlockSchema } from './schemas'
// ContentBlockSchema is a discriminated union of 12 block types:
// rich_text, question_select, question_free_response, latex,
// question_table, question_matching, svg, question_geometry,
// question_axis, question_multi_axis, html, media
```

---

## Supported Question Block Types

Each question type is a **block inside `content.blocks[]`**. There is no exercise-level `questionType` or `answerSpecJson` — the question block owns its own prompt, answer, and optional hint/solution.

### 1. Multiple Choice (MCQ) — `question_select` + `variant: "mcq"`

```json
{
  "id": "q1",
  "type": "question_select",
  "variant": "mcq",
  "selectionMode": "single",
  "prompt": {
    "format": "md-math-v1",
    "value": "What is $2 + 2$?",
    "mediaIds": []
  },
  "answer": {
    "multiSelect": false,
    "options": [
      { "id": "opt1", "content": { "format": "md-math-v1", "value": "$4$", "mediaIds": [] } },
      { "id": "opt2", "content": { "format": "md-math-v1", "value": "$5$", "mediaIds": [] } }
    ],
    "correctOptionIds": ["opt1"]
  }
}
```

### 2. True/False — `question_select` + `variant: "true_false"`

```json
{
  "id": "q2",
  "type": "question_select",
  "variant": "true_false",
  "prompt": {
    "format": "md-math-v1",
    "value": "The Earth is round.",
    "mediaIds": []
  },
  "answer": {
    "correctOptionId": "true"
  }
}
```

### 3. Free Response — `question_free_response`

```json
{
  "id": "q3",
  "type": "question_free_response",
  "prompt": {
    "format": "md-math-v1",
    "value": "Solve for $x$: $x + 5 = 12$",
    "mediaIds": []
  },
  "answer": {
    "responseKind": "numeric",
    "acceptedAnswers": ["7"],
    "tolerance": 0.01
  }
}
```

### 4. Table — `question_table`

```json
{
  "id": "q4",
  "type": "question_table",
  "prompt": { "format": "md-math-v1", "value": "Fill in the table:", "mediaIds": [] },
  "table": {
    "headers": ["x", "y"],
    "rowsData": [["1", "2"], ["3", "4"]],
    "showBorders": true,
    "showHeader": true,
    "columnAlignment": ["left", "center"]
  }
}
```

### 5. Matching — `question_matching`

```json
{
  "id": "q5",
  "type": "question_matching",
  "prompt": { "format": "md-math-v1", "value": "Match the items:", "mediaIds": [] },
  "leftColumn": [
    { "id": "l1", "content": { "format": "md-math-v1", "value": "$x^2$", "mediaIds": [] } }
  ],
  "rightColumn": [
    { "id": "r1", "content": { "format": "md-math-v1", "value": "Quadratic", "mediaIds": [] } }
  ]
}
```

### 6. Geometry — `question_geometry`

Geometry blocks render via `GraphWithPrompt`, wrapping the diagram in a card with the prompt side-by-side. The `layout` field controls text/diagram positioning; the 3/5 wrap rule applies — wide diagrams (>5:3 aspect) stack vertically, square/portrait stay side-by-side.

```json
{
  "id": "q6",
  "type": "question_geometry",
  "layout": "textRight",
  "prompt": { "format": "md-math-v1", "value": "Prove the following:", "mediaIds": [] },
  "geometry": {
    "specVersion": 1,
    "spec": {
      "kind": "euclidean",
      "canvas": { "width": 400, "height": 400 },
      "elements": {
        "points": [{ "name": "A", "x": 100, "y": 100 }],
        "lines": [{ "from": "A", "to": "B", "style": "solid" }]
      }
    }
  }
}
```

**Worksheet rendering**: Geometry blocks are wrapped in a card (`rounded-xl border bg-card p-card-padding-sm`) with a 50/50 split between prompt and diagram. On mobile, the prompt stacks above the diagram; on desktop, they are side-by-side with text on the reading-start side (left in LTR, right in RTL — the flex container forces `dir="ltr"` so layout names always describe physical position regardless of page direction).

### 7. Axis System — `question_axis`

Axis blocks render identically to geometry: `GraphWithPrompt` with card wrapper, 50/50 split, 3/5 wrap rule, and RTL-aware side-by-side layout.

```json
{
  "id": "q7",
  "type": "question_axis",
  "layout": "textLeft",
  "prompt": { "format": "md-math-v1", "value": "Sketch the function:", "mediaIds": [] },
  "axis": {
    "specVersion": 1,
    "spec": {
      "kind": "cartesian",
      "units": 1,
      "grid": { "enabled": true },
      "axes": { "showNumbers": true, "showLabels": true, "ticks": 1, "origin": { "x": 0, "y": 0 } },
      "elements": {
        "points": [],
        "graphs": [{ "id": "g1", "fn": "x^2", "style": "solid", "thickness": 1 }]
      }
    }
  }
}
```

### 8. Multi-Axis — `question_multi_axis`

```json
{
  "id": "q8",
  "type": "question_multi_axis",
  "prompt": { "format": "md-math-v1", "value": "Compare the functions:", "mediaIds": [] },
  "textPosition": "above",
  "columnsPerRow": 2,
  "graphs": [
    {
      "id": "g1",
      "fn": "x^2",
      "style": "solid",
      "thickness": 1,
      "spec": { "kind": "cartesian", "units": 1, "grid": { "enabled": true } }
    }
  ]
}
```

---

## Content Block Types

The `content.blocks` array supports 12 block types via a discriminated union (`ContentBlockSchema`). The question block types (geometry, axis, etc.) carry their own prompt and answer alongside the diagram/grid spec.

### Non-Question Blocks (presentational)

### 1. Rich Text

```json
{
  "id": "b1",
  "type": "rich_text",
  "format": "md-math-v1",
  "value": "Solve: $2x^2 + 3 = 11$"
}
```

### 2. LaTeX

```json
{
  "id": "b2",
  "type": "latex",
  "latex": "\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}",
  "renderMode": "block"
}
```

### 3. SVG (Static)

```json
{
  "id": "b3",
  "type": "svg",
  "value": "<svg width='100' height='100'><circle cx='50' cy='50' r='40'/></svg>",
  "altText": "A circle"
}
```

### 4. HTML

```json
{
  "id": "b4",
  "type": "html",
  "html": "<p>Some <strong>HTML</strong> content</p>"
}
```

### 5. Media

```json
{
  "id": "b5",
  "type": "media",
  "mediaId": "1234abcd"
}
```

### Question Block Types

Each question block owns: `prompt`, `answer`, and optional `hint`/`solution`/`fullSolution`. See **Supported Question Block Types** above for full examples.

| Block type | Used for |
|-----------|---------|
| `question_select` (`variant: "mcq"`) | Multiple-choice (single or multi-select) |
| `question_select` (`variant: "true_false"`) | True/False |
| `question_free_response` | Free response (numeric / algebraic / text) |
| `question_table` | Table completion |
| `question_matching` | Two-column matching |
| `question_geometry` | Euclidean geometry diagram |
| `question_axis` | Cartesian axis with function graphs |
| `question_multi_axis` | Grid of multiple axis systems |

---

## Testing

### TypeScript Validation

```bash
pnpm typecheck
```

### Exercise Tests

```bash
pnpm test:int tests/int/contracts/exercise-content-blocks.int.spec.ts
pnpm test:int tests/int/contracts/exercise-multi-axis-block.int.spec.ts
pnpm test:int tests/int/exercise-answer-validation.int.spec.ts
```

Unit tests for exercise hooks, schema idempotency, and display size are in `tests/unit/collections/`.

Follow [MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md) to test:
1. Valid exercise creation
2. Question type mismatch rejection
3. Invalid content structure rejection
4. Invalid answer spec rejection

---

## Related Documentation

- [📚 Contracts README](../contracts/README.md) - Contract usage guide
- [🔧 Contracts Implementation](../contracts/IMPLEMENTATION.md) - Implementation details
- [📋 Manual Verification Guide](./MANUAL_VERIFICATION.md) - Step-by-step testing
- [📁 Contract Examples](../../src/infra/contracts/) - JSON examples

---

## Future Enhancements

### Custom Admin UI Components
- Rich text editor with LaTeX preview
- Visual table builder
- Graph/geometry interactive editors
- Block drag-and-drop reordering

### Advanced Features
- Drawing Response grading
- Auto-grading engine
- Exercise versioning
- Difficulty tagging
- Learning objective mapping

---

## Troubleshooting

### Issue: Exercises collection not appearing in Admin

**Solution:**
1. Verify [`src/payload.config.ts`](../../../src/payload.config.ts) includes `Exercises` in collections array
2. Restart Payload dev server: `pnpm dev`
3. Clear browser cache and refresh

### Issue: Validation errors not showing

**Solution:**
1. Check browser console for errors
2. Verify `enforceContentStructure` hook is executing (check Payload server logs)
3. Check Payload server logs

### Issue: Cannot save valid exercise

**Solution:**
1. Verify JSON is valid (use JSONLint)
2. Check all required fields are filled
3. Ensure each block has required fields for its type (e.g., `prompt` for question blocks)
4. Review error message for specific field path

### Issue: TypeScript errors in Exercises

**Solution:**
1. Run `pnpm install` to ensure dependencies are installed
2. Verify schemas are exported from `src/server/payload/collections/Exercises/schemas.ts`
3. Run `pnpm generate:types` if collection fields were changed

---

## Contributing

When extending the Exercises collection:

1. **Update Schemas First**: Modify Zod schemas in `src/server/payload/collections/Exercises/schemas.ts`
2. **Update Tests**: Add test cases in `tests/int/contracts/` or `tests/unit/collections/`
3. **Update Collection**: Modify `src/server/payload/collections/Exercises/index.ts`
4. **Update Docs**: Update this README and [MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md)
5. **Run Validation**: `pnpm typecheck && pnpm lint`

---

## License

Part of the A-Guy project.
