# Exercise Contracts

Shared, versioned, strongly-validated TypeScript contract layer (Zod) for Exercise content, Answer specifications, and Graphics specifications.

## Overview

This package provides Zod schemas and TypeScript types for:
- **Exercise Content Blocks** - Rich text, tables, SVG, axis systems, geometry
- **Answer Specifications** - MCQ, True/False, Free Response (v1 question types)
- **Axis Specifications** - Declarative JSON for cartesian coordinate systems
- **Geometry Specifications** - Declarative JSON for Euclidean geometry

All contracts are usable by both server (Payload hooks) and client (renderers/editors).

## Structure

```
src/contracts/
├── index.ts                    # Main exports
├── primitives.ts               # Shared primitive schemas
├── exercise/
│   ├── blocks.ts              # Exercise block schemas (discriminated union)
│   ├── content.ts             # Exercise content structure
│   └── answers.ts             # Answer spec schemas (discriminated union)
├── graphics/
│   ├── axis.v1.ts             # Axis system spec v1
│   └── geometry.v1.ts         # Geometry spec v1
├── examples/                   # Example JSON files
│   ├── exercise-content.example.json
│   ├── answer-spec-mcq.example.json
│   ├── answer-spec-true-false.example.json
│   ├── answer-spec-free-response.example.json
│   ├── axis-spec-v1.example.json
│   └── geometry-spec-v1.example.json
└── README.md                   # This file
```

## Usage

### Basic Import

```typescript
import {
  ExerciseContentSchema,
  AnswerSpecSchema,
  AxisSpecV1Schema,
  GeometrySpecV1Schema,
  type ExerciseContent,
  type AnswerSpec,
} from '@/contracts'
```

### Validating Exercise Content

```typescript
import { ExerciseContentSchema } from '@/contracts'

const exerciseData = {
  stem: [
    {
      id: 'b1',
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Solve: $2x^2+3=11$',
    },
  ],
}

// Validate and parse
const validated = ExerciseContentSchema.parse(exerciseData)

// Safe parse (returns success/error)
const result = ExerciseContentSchema.safeParse(exerciseData)
if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error)
}
```

### Validating Answer Specs

```typescript
import { AnswerSpecSchema } from '@/contracts'

// MCQ
const mcqAnswer = {
  questionType: 'mcq',
  multiSelect: false,
  options: [
    { id: 'o1', content: [/* blocks */] },
    { id: 'o2', content: [/* blocks */] },
  ],
  correctOptionIds: ['o1'],
}
AnswerSpecSchema.parse(mcqAnswer)

// True/False
const tfAnswer = {
  questionType: 'true_false',
  correct: true,
}
AnswerSpecSchema.parse(tfAnswer)

// Free Response
const frAnswer = {
  questionType: 'free_response',
  responseKind: 'numeric',
  acceptedAnswers: ['3.14'],
  tolerance: 0.01,
}
AnswerSpecSchema.parse(frAnswer)
```

### Using TypeScript Types

```typescript
import type { ExerciseBlock, AnswerSpec, AxisSpecV1 } from '@/contracts'

function renderBlock(block: ExerciseBlock) {
  switch (block.type) {
    case 'rich_text':
      return renderMarkdown(block.value)
    case 'axis_system':
      return renderAxis(block.spec)
    case 'geometry':
      return renderGeometry(block.spec)
    // ... etc
  }
}

function gradeAnswer(answer: AnswerSpec, studentResponse: unknown) {
  switch (answer.questionType) {
    case 'mcq':
      // answer.options, answer.correctOptionIds are available
      break
    case 'true_false':
      // answer.correct is available
      break
    case 'free_response':
      // answer.acceptedAnswers, answer.tolerance, etc. are available
      break
  }
}
```

## Key Design Principles

### 1. Discriminated Unions

Blocks and answer specs use discriminated unions for type safety:

```typescript
// Exercise blocks discriminated by 'type'
type ExerciseBlock = 
  | { type: 'rich_text', ... }
  | { type: 'table', ... }
  | { type: 'axis_system', ... }
  | { type: 'geometry', ... }
  | { type: 'svg', ... }

// Answer specs discriminated by 'questionType'
type AnswerSpec = 
  | { questionType: 'mcq', ... }
  | { questionType: 'true_false', ... }
  | { questionType: 'free_response', ... }
```

### 2. Version Enforcement

Axis and Geometry blocks enforce `specVersion` as literal:

```typescript
{
  type: "axis_system",
  specVersion: 1,  // Must be exactly 1 for v1
  spec: AxisSpecV1
}
```

### 3. Stable IDs

Every block has an `id` for stable React keys and editor operations:

```typescript
{
  id: "b1",  // Required for all blocks
  type: "rich_text",
  value: "..."
}
```

### 4. Render Order

Block array order **is** the render order. No `*_order` fields exist in contracts.

## Block Types

### Rich Text Block
Math-aware Markdown with inline `$...$` and block `$$...$$` support.

```typescript
{
  id: "b1",
  type: "rich_text",
  format: "md-math-v1",
  value: "Solve: $2x^2+3=11$"
}
```

### Table Block

```typescript
{
  id: "t1",
  type: "table",
  headers: ["x", "y"],
  rows: [["1", "2"], ["3", "4"]],
  showBorders: true,
  showHeader: true,
  columnAlignment: ["left", "center"]
}
```

### SVG Block

Static SVG content.

```typescript
{
  id: "s1",
  type: "svg",
  svg: "<svg>...</svg>"
}
```

### Axis System Block

Declarative coordinate system with graphs, points, painting, etc.

```typescript
{
  id: "a1",
  type: "axis_system",
  specVersion: 1,
  spec: {
    kind: "cartesian",
    units: 1,
    grid: { enabled: true },
    axes: { ... },
    elements: {
      points: [...],
      graphs: [{
        id: "g1",
        fn: "x^2",
        style: "solid",
        thickness: 2
      }]
    },
    interactionSpec: { ... }  // Future Drawing Response
  }
}
```

### Geometry Block

Declarative Euclidean geometry with points, lines, circles, angles, etc.

```typescript
{
  id: "g1",
  type: "geometry",
  specVersion: 1,
  spec: {
    kind: "euclidean",
    canvas: { width: 600, height: 400 },
    elements: {
      points: [{ name: "A", x: 100, y: 100 }],
      lines: [{ from: "A", to: "B", style: "solid" }],
      circles: [...],
      angles: [...]
    }
  }
}
```

## Answer Spec Types

### MCQ (Multiple Choice Question)

```typescript
{
  questionType: "mcq",
  multiSelect: false,  // true for multiple correct answers
  options: [
    { id: "o1", content: [/* ExerciseBlock[] */] }
  ],
  correctOptionIds: ["o1"]
}
```

### True/False

```typescript
{
  questionType: "true_false",
  correct: true
}
```

### Free Response

```typescript
{
  questionType: "free_response",
  responseKind: "numeric" | "algebraic" | "text",
  acceptedAnswers: ["3.14"],
  tolerance: 0.01,           // numeric only
  caseSensitive: false,      // text only
  normalizeWhitespace: true  // text only
}
```

## Testing

Tests are located in `tests/int/contracts.int.spec.ts`:

```bash
# Run all tests
pnpm test:int

# Run only contract tests
pnpm exec vitest run tests/int/contracts.int.spec.ts
```

## Examples

See [`examples/`](./examples/) directory for complete JSON examples of each contract type.

## Future Enhancements

- Drawing Response grading engine (via `interactionSpec.evaluation.rules`)
- Additional block types as needed
- Version 2 specs with backward compatibility
- Enhanced validation rules (cross-field validation, etc.)

## Contributing

When adding new block types or modifying schemas:

1. Update the appropriate schema file
2. Add TypeScript type exports
3. Update [`index.ts`](./index.ts) exports
4. Add tests in `tests/int/contracts.int.spec.ts`
5. Add example JSON in `examples/`
6. Run `pnpm tsc --noEmit` to verify types
7. Run `pnpm test:int` to verify tests pass
