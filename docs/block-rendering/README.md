# Block Renderer Extension Guide

**Status**: ✅ Complete - Production Ready
**Last Updated**: 2026-01-07

This document describes the block-based exercise rendering architecture and provides a step-by-step guide for adding new block types.

---

## 📂 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Exercise Content (JSON)                    │
│   { blocks: [RichText, Question, RichText, ...] }          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Zod Validation (Contract Layer)                │
│   src/collections/Exercises/schemas.ts                      │
│   - ContentBlockSchema (discriminated union)                │
│   - Validates structure before DB save                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              ExerciseRenderer (Main Router)                 │
│   src/components/ExerciseRenderer/ExerciseRenderer/         │
│   - Loops through blocks                                    │
│   - Routes to appropriate renderer                          │
│   - Manages state (answers, check results)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  RichTextRenderer    │    │   Question Renderers     │
│  (Content blocks)    │    │   (Interactive blocks)   │
│                      │    │                          │
│  - Markdown + KaTeX  │    │  - TrueFalseQuestion    │
│  - No interaction    │    │  - McqQuestion          │
│                      │    │  - FreeResponseQuestion │
└──────────────────────┘    └──────────────────────────┘
```

---

## 🎯 Current Block Types

| Block Type | Purpose | Renderer | Interactive |
|------------|---------|----------|-------------|
| **`rich_text`** | Content, instructions, explanations | [`RichTextRenderer`](../../../src/components/exercise/RichTextRenderer/index.tsx) | ❌ No |
| **`question_select`** (variant: `true_false`) | True/False questions | [`TrueFalseQuestion`](../../../src/components/exercise/questions/TrueFalseQuestion/index.tsx) | ✅ Yes |
| **`question_select`** (variant: `mcq`) | Multiple choice questions | [`McqQuestion`](../../../src/components/exercise/questions/McqQuestion/index.tsx) | ✅ Yes |
| **`question_free_response`** | Open-ended text answers | [`FreeResponseQuestion`](../../../src/components/exercise/questions/FreeResponseQuestion/index.tsx) | ✅ Yes |

---

## 🔄 Rendering Pipeline

### Stage 1: Content Validation (Database Save)

```typescript
// src/collections/Exercises/index.ts
{
  name: 'content',
  type: 'json',
  validate: (value: unknown) => {
    const result = ContentSchema.safeParse(value)
    if (result.success) return true
    return 'Invalid content structure'
  },
}
```

**What Happens**:
1. User saves exercise in admin
2. `ContentSchema.safeParse()` validates structure
3. If invalid → error message shown, save blocked
4. If valid → exercise saved to database

### Stage 2: Block Routing (Rendering)

```typescript
// src/components/ExerciseRenderer/ExerciseRenderer/index.tsx
{content.blocks.map((block) => {
  // Rich text block - just render content
  if (block.type === 'rich_text') {
    return <RichTextRenderer block={block} />
  }

  // Question blocks - render with answer UI
  const question = block as QuestionBlock
  return (
    <QuestionCard>
      {question.type === 'question_select' && question.variant === 'true_false' && (
        <TrueFalseQuestion question={question} ... />
      )}
      {question.type === 'question_select' && question.variant === 'mcq' && (
        <McqQuestion question={question} ... />
      )}
      {question.type === 'question_free_response' && (
        <FreeResponseQuestion question={question} ... />
      )}
    </QuestionCard>
  )
})}
```

**What Happens**:
1. Loop through all blocks in order
2. Check `block.type` (and `variant` if applicable)
3. Render appropriate component
4. For questions: wrap in `QuestionCard` for consistent UI

### Stage 3: Specific Rendering

```typescript
// src/components/ExerciseRenderer/blocks/RichTextRenderer/index.tsx
export function RichTextRenderer({ block }: RichTextRendererProps) {
  return (
    <div className="rich-text-content">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {block.value}
      </ReactMarkdown>
    </div>
  )
}
```

**What Happens**:
1. Receive block data
2. Transform/render based on block type
3. Return React component

---

## 📝 5-Step Guide: Add New Block Type

### Example: Adding a "Code" Block

Let's add support for syntax-highlighted code blocks.

---

### Step 1: Define Zod Contract

**File**: [`src/collections/Exercises/schemas.ts`](../../../src/collections/Exercises/schemas.ts)

```typescript
// Add new block schema
export const CodeBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('code'),
    language: z.enum(['javascript', 'python', 'typescript', 'sql']),
    value: z.string().min(1),
    showLineNumbers: z.boolean().default(true),
  })
  .strict()

export type CodeBlock = z.infer<typeof CodeBlockSchema>
```

---

### Step 2: Update ContentBlockSchema Union

**File**: [`src/collections/Exercises/schemas.ts`](../../../src/collections/Exercises/schemas.ts)

```typescript
// Update the discriminated union to include new block type
export const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  QuestionSelectBlockSchema,
  QuestionFreeResponseBlockSchema,
  CodeBlockSchema, // ✅ Add here
])
```

**Why Discriminated Union?**
- TypeScript can narrow types based on `block.type`
- Ensures only valid block types are allowed
- Provides autocomplete in editor

---

### Step 3: Create Renderer Component

**File**: `src/components/ExerciseRenderer/blocks/CodeRenderer/index.tsx`

```typescript
import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { CodeBlock } from '@/collections/Exercises/schemas'

interface CodeRendererProps {
  block: CodeBlock
}

export function CodeRenderer({ block }: CodeRendererProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="bg-muted px-4 py-2 text-sm text-muted-foreground">
        {block.language}
      </div>
      <SyntaxHighlighter
        language={block.language}
        style={vscDarkPlus}
        showLineNumbers={block.showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: 0,
        }}
      >
        {block.value}
      </SyntaxHighlighter>
    </div>
  )
}
```

**Best Practices**:
- ✅ Use TypeScript props interface
- ✅ Import block type from schemas
- ✅ Use Tailwind for styling (no CSS modules)
- ✅ Handle all block fields
- ✅ Provide fallbacks for optional fields

---

### Step 4: Update ExerciseRenderer Switch

**File**: [`src/components/ExerciseRenderer/ExerciseRenderer/index.tsx`](../../../src/components/exercise/ExerciseRenderer/index.tsx)

```typescript
import { CodeRenderer } from '../blocks/CodeRenderer'

// In the render loop:
{content.blocks.map((block) => {
  // Existing rich text handler
  if (block.type === 'rich_text') {
    return <RichTextRenderer key={block.id} block={block} />
  }

  // ✅ Add new code block handler
  if (block.type === 'code') {
    return <CodeRenderer key={block.id} block={block} />
  }

  // Existing question handlers...
  const question = block as QuestionBlock
  // ...
})}
```

**Critical**: Don't forget the `key` prop!

---

### Step 5: Update Types & Generate

**File**: `src/components/ExerciseRenderer/types.ts`

```typescript
// Export new block type for use in components
export type { CodeBlock } from '@/collections/Exercises/schemas'

// Update ContentBlock union type if needed
export type ContentBlock =
  | RichTextBlock
  | QuestionBlock
  | CodeBlock // ✅ Add here
```

**Generate TypeScript Types**:
```bash
pnpm run generate:types
```

This regenerates `src/payload-types.ts` from Payload config.

---

## 🧪 Testing New Block Types

### Manual Testing

1. **Add Sample Data**
```bash
# Login to Payload admin
open http://localhost:3000/admin

# Navigate to Exercises → Create New
# Add content JSON:
{
  "blocks": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Here's how to calculate factorial:",
      "mediaIds": []
    },
    {
      "id": "b2",
      "type": "code",
      "language": "python",
      "value": "def factorial(n):\n    return 1 if n == 0 else n * factorial(n-1)",
      "showLineNumbers": true
    }
  ]
}
```

2. **Save Exercise**
   - If validation fails → check Zod schema
   - If saves successfully → proceed to render test

3. **View Exercise**
```bash
# Navigate to exercise page
open http://localhost:3000/exercises/[exercise-id]
```

4. **Check Rendering**
   - ✅ Block renders correctly
   - ✅ Styling looks good
   - ✅ No console errors
   - ✅ Dark mode works

---

## 🎨 Math Rendering (KaTeX)

### Inline Math

```markdown
The formula $E = mc^2$ shows...
```

**Renders**: The formula \(E = mc^2\) shows...

### Display Math

```markdown
The quadratic formula is:

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

**Renders**:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

### KaTeX Configuration

```typescript
// src/components/ExerciseRenderer/blocks/RichTextRenderer/index.tsx
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css' // Required!

<ReactMarkdown
  remarkPlugins={[remarkMath]}    // Parse math syntax
  rehypePlugins={[rehypeKatex]}   // Render with KaTeX
>
  {block.value}
</ReactMarkdown>
```

**Supported Syntax**:
- Inline: `$...$` or `\(...\)`
- Display: `$$...$$` or `\[...\]`

---

## 🔐 Best Practices

### DO ✅

**1. Use Discriminated Unions**
```typescript
// ✅ GOOD: TypeScript can narrow types
export const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  CodeBlockSchema,
])

// Now TypeScript knows:
if (block.type === 'code') {
  console.log(block.language) // ✅ Type-safe!
}
```

**2. Validate with Zod**
```typescript
// ✅ GOOD: Runtime validation
export const CodeBlockSchema = z.object({
  id: z.string().min(1), // Required, non-empty
  type: z.literal('code'), // Exact value
  language: z.enum(['js', 'py']), // Limited options
}).strict() // No extra properties
```

**3. Use Strict Mode**
```typescript
// ✅ GOOD: Prevents typos and extra fields
.strict()

// ❌ BAD: Allows any extra properties
// (no .strict())
```

**4. Provide Type Exports**
```typescript
// ✅ GOOD: Export types for components
export type CodeBlock = z.infer<typeof CodeBlockSchema>
```

**5. Handle Errors Gracefully**
```typescript
// ✅ GOOD: Show helpful error message
if (block.type === 'unknown_type') {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-300">
      <span>⚠️ Unknown block type: {block.type}</span>
      {mode === 'debug' && (
        <pre>{JSON.stringify(block, null, 2)}</pre>
      )}
    </div>
  )
}
```

**6. Use Tailwind Classes**
```typescript
// ✅ GOOD: Tailwind only (as per project rules)
<div className="p-4 rounded-lg border border-border bg-card">

// ❌ BAD: CSS modules or inline styles
<div style={{ padding: '1rem' }}>
<div className={styles.container}>
```

---

### DON'T ❌

**1. Don't Skip Validation**
```typescript
// ❌ BAD: No validation, anything goes
{
  name: 'content',
  type: 'json',
  // No validate function!
}

// ✅ GOOD: Always validate
validate: (value) => {
  const result = ContentSchema.safeParse(value)
  if (result.success) return true
  return result.error.message
}
```

**2. Don't Mutate Props**
```typescript
// ❌ BAD: Mutating block object
function Renderer({ block }) {
  block.value = transform(block.value) // Mutates!
  return <div>{block.value}</div>
}

// ✅ GOOD: Create new values
function Renderer({ block }) {
  const transformed = transform(block.value)
  return <div>{transformed}</div>
}
```

**3. Don't Use Non-Standard Fields**
```typescript
// ❌ BAD: Custom field without Zod schema
{
  id: 'b1',
  type: 'code',
  customField: 'value', // Not in schema!
}

// ✅ GOOD: All fields defined in schema
export const CodeBlockSchema = z.object({
  id: z.string(),
  type: z.literal('code'),
  customField: z.string(), // Defined!
})
```

**4. Don't Forget Key Props**
```typescript
// ❌ BAD: Missing key in list
blocks.map(block => <Renderer block={block} />)

// ✅ GOOD: Always provide unique key
blocks.map(block => <Renderer key={block.id} block={block} />)
```

**5. Don't Hard-Code Strings**
```typescript
// ❌ BAD: Hard-coded English text
<button>Check Answer</button>

// ✅ GOOD: Use i18n
const t = useTranslations('exercises')
<button>{t('checkAnswer')}</button>
```

---

## 🎓 Common Patterns

### Pattern 1: Converting Inline to Block Format

Some question renderers need block format for rendering. Convert inline format:

```typescript
// InlineRichText (no id, used in questions)
interface InlineRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds?: string[]
}

// RichTextBlock (has id, used in content stream)
interface RichTextBlock extends InlineRichText {
  id: string
}

// Convert for rendering:
const promptBlock: RichTextBlock = {
  ...question.prompt, // InlineRichText
  id: `${question.id}-prompt`, // Add unique ID
}

<RichTextRenderer block={promptBlock} />
```

### Pattern 2: Conditional Block Rendering

```typescript
// Only render in specific modes
{content.blocks.map((block) => {
  if (block.type === 'teacher_notes' && mode !== 'teacher') {
    return null // Skip this block for students
  }

  return <BlockRenderer key={block.id} block={block} mode={mode} />
})}
```

### Pattern 3: Block with State

```typescript
interface InteractiveBlock {
  id: string
  type: 'interactive_diagram'
  initialState: DiagramState
}

function DiagramRenderer({ block }: { block: InteractiveBlock }) {
  const [state, setState] = useState(block.initialState)

  return (
    <div>
      <DiagramCanvas state={state} onChange={setState} />
    </div>
  )
}
```

---

## 🔍 Troubleshooting

### Issue: "Invalid content structure" on save

**Cause**: Zod validation failed

**Solution**:
1. Check console for Zod error details
2. Verify all required fields are present
3. Check field types match schema
4. Ensure no extra fields (use `.strict()`)

**Debug**:
```typescript
const result = ContentSchema.safeParse(yourContent)
if (!result.success) {
  console.log(result.error.issues)
}
```

### Issue: Block not rendering

**Cause**: Missing renderer case in ExerciseRenderer

**Solution**:
1. Check `ExerciseRenderer/index.tsx` has case for your block type
2. Verify import statement exists
3. Ensure component is exported

### Issue: TypeScript errors after adding block

**Cause**: Types not regenerated

**Solution**:
```bash
# Regenerate Payload types
pnpm run generate:types

# Restart TypeScript server in VSCode
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Issue: Block renders but looks broken

**Cause**: Missing CSS or wrong classes

**Solution**:
1. Check Tailwind classes are valid
2. Import required CSS (e.g., `katex.min.css`)
3. Test in both light and dark modes
4. Check browser console for errors

---

## 📊 Block Type Checklist

When adding a new block type, ensure:

- [ ] **Zod schema defined** in `schemas.ts`
- [ ] **Schema added to union** in `ContentBlockSchema`
- [ ] **Type exported** from schemas
- [ ] **Renderer component created** with proper types
- [ ] **Renderer imported** in ExerciseRenderer
- [ ] **Switch case added** in render loop
- [ ] **Types updated** in `types.ts`
- [ ] **Types generated** with `pnpm run generate:types`
- [ ] **Manual test performed** in admin + frontend
- [ ] **Dark mode tested** (if applicable)
- [ ] **i18n strings added** (if applicable)
- [ ] **Documentation updated** (this file)

---

## 🔗 Related Documentation

- **[Exercise Collection](../exercises/README.md)** - Exercise data model
- **[Contracts Documentation](../contracts/README.md)** - Validation schemas
- **[Component Guidelines](../../src/components/exercise/README.md)** - Component patterns
- **[Design System](../../DESIGN_SYSTEM.md)** - Tailwind styling guide

---

## 🚀 Future Block Types (Ideas)

### Planned
- [ ] **Image Block** - Display images with captions
- [ ] **Table Block** - Data tables with sorting
- [ ] **Video Block** - Embedded video player
- [ ] **Audio Block** - Audio player for listening exercises

### Under Consideration
- [ ] **Interactive Graph** - Desmos-style graphing
- [ ] **Geometry Canvas** - GeoGebra-style construction
- [ ] **LaTeX Editor** - Live math editor
- [ ] **Code Sandbox** - Runnable code examples

---

**Last Updated**: 2026-01-07
**Status**: ✅ Production Ready
