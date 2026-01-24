# Exercises Collection - Stage 0 Implementation

**Status**: ✅ Complete - Ready for Manual Verification

This directory documents the **Stage 0** implementation of the Exercises collection in Payload CMS, including minimal fields and Zod validation.

---

## Overview

The Exercises collection provides a minimal foundation for creating and managing educational exercises with strongly-typed content and answer specifications.

### Key Features

- **Minimal Data Model**: Only essential fields required for v1
- **Zod Validation**: Runtime validation of JSON structures using contracts
- **Question Type Enforcement**: Ensures `questionType` field matches `answerSpecJson.questionType`
- **Relationship to Lessons**: Each exercise belongs to a Lesson
- **Type-Safe**: Full TypeScript integration with Payload

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Payload Admin UI                      │
│  (Manual JSON Entry - Stage 0)                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          Exercises Collection (Payload)                  │
│  src/collections/Exercises.ts                           │
│                                                          │
│  Fields:                                                 │
│  - title: string                                         │
│  - lesson: relationship → Lessons                        │
│  - questionType: "mcq" | "true_false" | "free_response" │
│  - contentJson: JSON (ExerciseContent)                   │
│  - answerSpecJson: JSON (AnswerSpec)                     │
│                                                          │
│  beforeValidate Hook:                                    │
│  - Validates contentJson with ExerciseContentSchema      │
│  - Validates answerSpecJson with AnswerSpecSchema        │
│  - Ensures questionType matches answerSpecJson           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│             Zod Contracts (Shared Layer)                 │
│  src/contracts/                                          │
│                                                          │
│  - ExerciseContentSchema                                 │
│  - AnswerSpecSchema (discriminated union)                │
│  - ExerciseBlockSchema (5 block types)                   │
│  - AxisSpecV1Schema                                      │
│  - GeometrySpecV1Schema                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

### Minimal Fields (Stage 0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | ✅ | Exercise title |
| `lesson` | `relationship` | ✅ | Reference to Lessons collection |
| `questionType` | `select` | ✅ | One of: `mcq`, `true_false`, `free_response` |
| `contentJson` | `json` | ✅ | Exercise content (validated by `ExerciseContentSchema`) |
| `answerSpecJson` | `json` | ✅ | Answer specification (validated by `AnswerSpecSchema`) |

### Validation Rules

1. **Content Validation**: `contentJson` must pass [`ExerciseContentSchema`](../../src/contracts/exercise/content.ts)
2. **Answer Spec Validation**: `answerSpecJson` must pass [`AnswerSpecSchema`](../../src/contracts/exercise/answers.ts)
3. **Type Consistency**: `questionType` field MUST equal `answerSpecJson.questionType`

**Example Rejection**:
```typescript
// ❌ This will be REJECTED
{
  questionType: "true_false",     // Field value
  answerSpecJson: {
    questionType: "mcq",          // Spec value (MISMATCH!)
    // ...
  }
}

// Error: "Question type mismatch: field is 'true_false' but answerSpecJson.questionType is 'mcq'. These must match."
```

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
src/collections/Exercises.ts          # Payload collection config
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
    defaultColumns: ['title', 'lesson', 'questionType', 'updatedAt'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    // ... fields
  ],
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        // Validate contentJson
        const contentResult = ExerciseContentSchema.safeParse(data.contentJson)

        // Validate answerSpecJson
        const answerResult = AnswerSpecSchema.safeParse(data.answerSpecJson)

        // Ensure questionType matches
        if (data.questionType !== answerResult.data.questionType) {
          throw new Error('Question type mismatch...')
        }

        return data
      },
    ],
  },
}
```

**Zod Integration**:
```typescript
import {
  ExerciseContentSchema,
  AnswerSpecSchema,
} from '@/contracts'
```

---

## Supported Question Types

### 1. Multiple Choice (MCQ)

**Content Example**:
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "What is $2 + 2$?"
    }
  ]
}
```

**Answer Spec Example**:
```json
{
  "questionType": "mcq",
  "multiSelect": false,
  "options": [
    {
      "id": "opt1",
      "content": [
        { "id": "t1", "type": "rich_text", "format": "md-math-v1", "value": "$4$" }
      ]
    },
    {
      "id": "opt2",
      "content": [
        { "id": "t2", "type": "rich_text", "format": "md-math-v1", "value": "$5$" }
      ]
    }
  ],
  "correctOptionIds": ["opt1"]
}
```

### 2. True/False

**Content Example**:
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "The Earth is round. True or False?"
    }
  ]
}
```

**Answer Spec Example**:
```json
{
  "questionType": "true_false",
  "correct": true
}
```

### 3. Free Response

**Content Example**:
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Solve for $x$: $x + 5 = 12$"
    }
  ]
}
```

**Answer Spec Example (Numeric)**:
```json
{
  "questionType": "free_response",
  "responseKind": "numeric",
  "acceptedAnswers": ["7"],
  "tolerance": 0.01
}
```

**Answer Spec Example (Algebraic)**:
```json
{
  "questionType": "free_response",
  "responseKind": "algebraic",
  "acceptedAnswers": ["2x + 3", "3 + 2x", "3+2*x"]
}
```

**Answer Spec Example (Text)**:
```json
{
  "questionType": "free_response",
  "responseKind": "text",
  "acceptedAnswers": ["Paris", "paris"],
  "caseSensitive": false,
  "normalizeWhitespace": true
}
```

---

## Content Block Types

Exercises support 5 block types in `contentJson.stem`:

### 1. Rich Text (Math-Aware Markdown)

```json
{
  "id": "b1",
  "type": "rich_text",
  "format": "md-math-v1",
  "value": "Solve: $2x^2 + 3 = 11$"
}
```

### 2. Table

```json
{
  "id": "b2",
  "type": "table",
  "headers": ["x", "y"],
  "rows": [["1", "2"], ["3", "4"]],
  "showBorders": true,
  "showHeader": true,
  "columnAlignment": ["left", "center"]
}
```

### 3. SVG (Static)

```json
{
  "id": "b3",
  "type": "svg",
  "svg": "<svg width='100' height='100'><circle cx='50' cy='50' r='40'/></svg>"
}
```

### 4. Axis System (Declarative)

```json
{
  "id": "b4",
  "type": "axis_system",
  "specVersion": 1,
  "spec": {
    "kind": "cartesian",
    "units": 1,
    "grid": { "enabled": true },
    "axes": {
      "showNumbers": true,
      "showLabels": true,
      "ticks": 1,
      "labels": { "x": "x", "y": "y" },
      "origin": { "x": 0, "y": 0 }
    },
    "elements": {
      "points": [],
      "graphs": [
        {
          "id": "g1",
          "fn": "x^2",
          "style": "solid",
          "thickness": 1
        }
      ]
    },
    "interactionSpec": {
      "enabled": false,
      "toolsAllowed": [],
      "evaluation": { "mode": "none" }
    }
  }
}
```

### 5. Geometry (Declarative)

```json
{
  "id": "b5",
  "type": "geometry",
  "specVersion": 1,
  "spec": {
    "kind": "euclidean",
    "canvas": { "width": 400, "height": 400 },
    "elements": {
      "points": [
        { "name": "A", "x": 100, "y": 100 },
        { "name": "B", "x": 300, "y": 100 }
      ],
      "lines": [
        { "from": "A", "to": "B", "style": "solid" }
      ]
    }
  }
}
```

---

## Testing

### TypeScript Validation

```bash
npx tsc --noEmit
```

### Contract Tests

```bash
pnpm test tests/int/contracts
```

**Coverage**: 54 tests passing
- Block validation (11 tests)
- Axis spec validation (4 tests)
- Geometry spec validation (3 tests)
- Content validation (3 tests)
- MCQ answer spec (7 tests)
- True/False answer spec (4 tests)
- Free Response answer spec (9 tests)
- **NEW**: Multi-section content (13 tests)

### Manual Verification

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
- [📁 Contract Examples](../../src/contracts/examples/) - JSON examples

---

## Future Enhancements (Out of Stage 0 Scope)

### Custom Admin UI Components
- Rich text editor with LaTeX preview
- Visual table builder
- Graph/geometry interactive editors
- Block drag-and-drop reordering

### Frontend Renderers
- Math rendering (KaTeX/MathJax)
- Interactive axis system renderer
- Interactive geometry renderer
- Student response capture

### Advanced Features
- Multi-section exercises (sections + subSections)
- Drawing Response grading
- Auto-grading engine
- Exercise versioning
- Difficulty tagging
- Learning objective mapping

---

## Troubleshooting

### Issue: Exercises collection not appearing in Admin

**Solution:**
1. Verify [`src/payload.config.ts`](../../src/payload.config.ts) includes `Exercises` in collections array
2. Restart Payload dev server: `pnpm dev`
3. Clear browser cache and refresh

### Issue: Validation errors not showing

**Solution:**
1. Check browser console for errors
2. Verify hook is executing (add console.log in beforeValidate)
3. Check Payload server logs

### Issue: Cannot save valid exercise

**Solution:**
1. Verify JSON is valid (use JSONLint)
2. Check all required fields are filled
3. Ensure `questionType` matches `answerSpecJson.questionType`
4. Review error message for specific field path

### Issue: TypeScript errors in Exercises.ts

**Solution:**
1. Run `pnpm install` to ensure dependencies are installed
2. Verify contracts are exported from `src/contracts/index.ts`
3. Check `@/contracts` path alias in `tsconfig.json`

---

## Contributing

When extending the Exercises collection:

1. **Update Contracts First**: Modify Zod schemas in `src/contracts/`
2. **Update Tests**: Add test cases in `tests/int/contracts/`
3. **Update Collection**: Modify `src/server/payload/collections/Exercises/index.ts`
4. **Update Docs**: Update this README and verification guide
5. **Run Validation**: `npx tsc --noEmit && pnpm test`

---

## License

Part of the A-Guy project.
