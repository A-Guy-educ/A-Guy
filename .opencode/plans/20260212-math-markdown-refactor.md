# Plan: Shared `<MathMarkdown>` + Chat-Specific `<ChatMessageContent>`

**Goal**: Create a shared `<MathMarkdown>` base component for rendering markdown with math (KaTeX),
and refactor `<ChatMessageContent>` to wrap it with chat-specific UI additions. Enable math rendering
across ALL question types (MCQ options, True/False labels, prompts, and future hint/solution fields).

**Why**: Currently there are 3 independent ReactMarkdown+KaTeX setups with duplicated config,
inconsistent RTL handling (exercises lack it), redundant CSS imports, and dead code.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│               <MathMarkdown>                       │
│  (shared base - used everywhere math is needed)    │
│                                                    │
│  - remarkMath plugin (parses $...$ and $$...$$)    │
│  - rehypeKatex plugin (renders to KaTeX HTML)      │
│  - rehypeMathWrapper plugin (RTL dir="ltr" fix)    │
│  - accepts optional `components` override          │
│  - accepts optional `className`                    │
└────────────────┬───────────────────────────────────┘
                 │
        ┌────────┴─────────────────┐
        │                          │
 Used directly by:            Wrapped by:
 - RichTextRenderer            - ChatMessageContent
   (exercise prompts,            (adds LLM normalization +
    MCQ options,                  chat typography +
    T/F labels)                   chat CSS class)
 - Future: hints, solutions
 - Any new markdown need
```

### Why `normalizeLatexDelimiters` stays in chat only (NOT in MathMarkdown)

The `normalizeLatexDelimiters` function is **opinionated and lossy**:

1. **Converts ALL `\(…\)` inline math to `$$…$$` block math** — forces math onto its own
   line. Fine for chat readability, but would break MCQ options like "The value of $\frac{1}{2}$"
   by pushing the math to a separate line.
2. **`\\frac` → `\frac`** — fixes double-escaping from LLM JSON. Exercise content already
   gets un-escaped at ingestion (`parseExtractorResponseText()` in helpers.ts:146).
3. **`\=` → `=`** — another LLM artifact that shouldn't exist in pre-processed data.

**Chat is the only place** where you can't pre-process data — it's a live LLM stream.
Every other path normalizes at ingestion time. `<MathMarkdown>` renders clean markdown.

---

## Broader Impact: Math Rendering Across All Question Types

### All InlineRichText Fields (format `md-math-v1`)

Every question type has `InlineRichText` fields that can contain math.
After this refactor, ALL rendered fields automatically get math + RTL support
because they flow through `RichTextRenderer` → `MathMarkdown`:

| Question Type     | Field            | Rendered Today? | Path After Refactor                           |
| ----------------- | ---------------- | --------------- | --------------------------------------------- |
| **All types**     | `prompt`         | ✅ Yes          | `→ RichTextRenderer → MathMarkdown`           |
| **MCQ**           | `option.content` | ✅ Yes          | `→ RichTextRenderer → MathMarkdown`           |
| **True/False**    | `option.label`   | ✅ Yes          | `→ RichTextRenderer → MathMarkdown`           |
| **All types**     | `hint`           | ❌ Not yet      | Future: `<MathMarkdown content={hint.value}>` |
| **All types**     | `solution`       | ❌ Not yet      | Future: `<MathMarkdown content={...}>`        |
| **All types**     | `fullSolution`   | ❌ Not yet      | Future: `<MathMarkdown content={...}>`        |
| **Chat messages** | `content`        | ✅ Yes          | `→ ChatMessageContent → MathMarkdown`         |

### Why This Refactor Fixes Math Everywhere (Not Just Chat)

All currently-rendered question fields (prompts, MCQ options, T/F labels) already flow
through `RichTextRenderer`. By making `RichTextRenderer` use `<MathMarkdown>` internally
(Step 5), **every existing rendering location automatically gains**:

- ✅ KaTeX math rendering (was already there)
- ✅ RTL isolation with `dir="ltr"` (NEW — was missing, bug fix for Hebrew)
- ✅ Single source of truth for the math pipeline

**No changes needed to McqQuestion, TrueFalseQuestion, or FreeResponseQuestion.**

### Future Usage Model

When rendering ANY new `InlineRichText` field (hints, solutions, etc.):

```tsx
// Option A: Use RichTextRenderer (if you need .rich-text-content CSS scope)
<RichTextRenderer block={{ ...hint, id: 'some-id', mediaIds: [] }} />

// Option B: Use MathMarkdown directly (simpler, for inline/lightweight contexts)
<MathMarkdown content={hint.value} />

// NEVER do this — don't set up ReactMarkdown + KaTeX manually:
// ❌ <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
```

---

## Files to Change (Summary)

| #   | File                                                            | Action                                     |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| 1   | `src/ui/web/shared/MathMarkdown/rehype-math-wrapper.ts`         | **CREATE** - Extract RTL isolation plugin  |
| 2   | `src/ui/web/shared/MathMarkdown/index.tsx`                      | **CREATE** - Shared base component         |
| 3   | `src/ui/web/shared/index.ts`                                    | **EDIT** - Add MathMarkdown export         |
| 4   | `src/ui/web/chat/ChatMessageContent/index.tsx`                  | **EDIT** - Refactor to use MathMarkdown    |
| 5   | `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` | **EDIT** - Replace with MathMarkdown       |
| 6   | `src/app/(frontend)/courses/.../NotebookFormulas/index.tsx`     | **DELETE** - Dead code                     |
| 7   | `tests/unit/components/shared/MathMarkdown.test.tsx`            | **CREATE** - Test the shared component     |
| 8   | Existing tests                                                  | **VERIFY** - Run to confirm no regressions |

---

## Step-by-Step Instructions

### Step 1: Create the RTL isolation plugin file

**Time**: ~10 minutes
**File**: `src/ui/web/shared/MathMarkdown/rehype-math-wrapper.ts` (NEW)

This file extracts the `rehypeMathWrapper` function that currently lives inside
`src/ui/web/chat/ChatMessageContent/index.tsx` (lines 75-149).

**What this function does (for context)**:

- It's a "rehype plugin" — a function that modifies the HTML tree (AST) AFTER
  rehype-katex has already converted math into KaTeX HTML.
- It looks for elements with class `katex-display` (block math) or `katex` (inline math).
- It wraps them in a `<div dir="ltr">` or `<span dir="ltr">` so that math expressions
  display correctly even when the page is in RTL mode (Hebrew).
- Without this, math like `x = 5` would render with reversed ordering in Hebrew pages.

**What to write**:

```typescript
/**
 * @fileType utility
 * @domain ui
 * @pattern rtl-isolation
 * @ai-summary Rehype plugin that wraps KaTeX math output with dir="ltr" for RTL language support
 */

import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Rehype plugin to wrap KaTeX output with RTL isolation.
 *
 * WHY: In RTL pages (like Hebrew), math expressions render incorrectly
 * because the browser applies right-to-left text direction to them.
 * This plugin wraps KaTeX HTML with dir="ltr" at the AST level
 * (before React sees it), so math always reads left-to-right.
 *
 * HOW: After rehype-katex converts $...$ into KaTeX HTML, this plugin
 * walks the HTML tree and wraps:
 * - Block math (.katex-display) -> <div dir="ltr" class="isolate block text-center mt-3 mb-3">
 * - Inline math (.katex)        -> <span dir="ltr" class="isolate inline-block align-middle">
 */
export function rehypeMathWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const className = Array.isArray(node.properties?.className)
        ? node.properties.className.join(' ')
        : String(node.properties?.className || '')

      // Skip if already wrapped (check for Tailwind classes we use)
      if (
        className.includes('isolate') &&
        (className.includes('inline-block') || className.includes('block'))
      ) {
        return
      }

      // Check if parent is already a math wrapper or a katex element (to avoid nested wrapping)
      if (parent.type === 'element') {
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')

        // Skip if parent is already wrapped
        if (
          parentClassName.includes('isolate') &&
          (parentClassName.includes('inline-block') || parentClassName.includes('block'))
        ) {
          return
        }

        // Skip if parent is a katex element (we only wrap top-level katex)
        if (parentClassName.includes('katex')) {
          return
        }
      }

      // Block math: wrap katex-display
      if (className.includes('katex-display')) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            dir: 'ltr',
            className: ['isolate', 'block', 'text-center', 'mt-3', 'mb-3'],
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
        return
      }

      // Inline math: wrap katex (only top-level, not nested)
      if (
        className.includes('katex') &&
        !className.includes('katex-display') &&
        node.tagName === 'span'
      ) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'span',
          properties: {
            dir: 'ltr',
            className: ['isolate', 'inline-block', 'align-middle'],
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
      }
    })
  }
}
```

**How to verify**: Tested via components in Steps 7-8.

**Test gate**: N/A (tested through component tests)

---

### Step 2: Create the shared `<MathMarkdown>` component

**Time**: ~15 minutes
**File**: `src/ui/web/shared/MathMarkdown/index.tsx` (NEW)

**What to write**:

```typescript
/**
 * @fileType component
 * @domain ui
 * @pattern shared-markdown
 * @ai-summary Shared markdown renderer with KaTeX math support and RTL isolation
 */

'use client'

import { cn } from '@/infra/utils/ui'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { rehypeMathWrapper } from './rehype-math-wrapper'

export interface MathMarkdownProps {
  /** The markdown string to render. Supports $...$ (inline) and $$...$$ (block) math. */
  content: string

  /** Optional CSS class name added to the wrapper <div>. */
  className?: string

  /**
   * Optional override for how markdown elements (p, h1, code, etc.) render.
   *
   * WHY this exists: Different contexts need different styling.
   * - Chat messages use custom Tailwind-styled headings, lists, code blocks.
   * - Exercise content uses the default browser rendering + .rich-text-content CSS.
   *
   * If you don't pass this, markdown elements render with their default HTML tags.
   */
  components?: Components
}

/**
 * Shared markdown renderer with math (KaTeX) support and RTL isolation.
 *
 * This is the BASE component — use it directly for exercise content,
 * or wrap it (like ChatMessageContent does) when you need extra behavior.
 *
 * WHAT IT DOES:
 * 1. Parses $...$ and $$...$$ delimiters in the markdown string (remarkMath)
 * 2. Converts them to KaTeX HTML (rehypeKatex)
 * 3. Wraps KaTeX output with dir="ltr" for RTL language support (rehypeMathWrapper)
 * 4. Renders the result as React elements
 *
 * WHAT IT DOES NOT DO (on purpose):
 * - LaTeX delimiter normalization (\[...\] -> $$...$$) — that's chat-specific
 * - Custom markdown element styling — pass `components` prop if needed
 * - Import katex CSS — already in globals.css (frontend) and custom.scss (admin)
 *
 * @example Basic usage (exercise content)
 * <MathMarkdown content="Solve $x^2 = 4$" className="rich-text-content" />
 *
 * @example With custom components (chat)
 * <MathMarkdown content={text} components={chatComponents} className="chat-message-content" />
 */
export function MathMarkdown({ content, className, components }: MathMarkdownProps) {
  return (
    <div className={cn(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeMathWrapper]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Key decisions**:

- `'use client'` — ReactMarkdown is a client component
- NO katex CSS import — `globals.css:3` already imports it for all frontend routes
- `rehypeMathWrapper` is ALWAYS applied — every context benefits from RTL isolation
- `components` prop passes through to ReactMarkdown for context-specific styling

**Test gate**: Tests in Step 7

---

### Step 3: Export MathMarkdown from the shared barrel file

**Time**: ~5 minutes
**File**: `src/ui/web/shared/index.ts` (EDIT — add 2 lines at end)

Add after the last export (line 36):

```typescript
// Markdown
export { MathMarkdown } from './MathMarkdown'
export type { MathMarkdownProps } from './MathMarkdown'
```

**Why**: Follows the same barrel-export pattern as all other shared components
(Typography, Layout, Loading, etc.)

**Test gate**: Import resolution verified by `pnpm tsc --noEmit`

---

### Step 4: Refactor `ChatMessageContent` to use `MathMarkdown`

**Time**: ~15 minutes
**File**: `src/ui/web/chat/ChatMessageContent/index.tsx` (EDIT — 167 lines → ~80 lines)

**What the file should look like after**:

```typescript
'use client'

import { cn } from '@/infra/utils/ui'
import type { Components } from 'react-markdown'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { normalizeLatexDelimiters } from './normalize-latex'

interface ChatMessageContentProps {
  content: string
  className?: string
}

/**
 * Custom components for ReactMarkdown with Tailwind styling.
 * Implements the chat answer formatting spec:
 * - Paragraphs: 16-24px spacing, line-height 1.5-1.6
 * - Headings: semibold, 8-12px spacing below
 * - Emphasis: bold only (em rendered as font-medium, not italic)
 * - Lists: proper indentation and spacing
 */
const chatMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-4 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h6>
  ),
  ul: ({ children }) => <ul className="mb-4 ps-5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 ps-5 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="mb-1 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="not-italic font-medium">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 border border-border">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-s-4 border-primary mb-4 ps-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-0 border-t border-border my-5" />,
}

/**
 * Chat message content renderer.
 *
 * WHAT THIS ADDS ON TOP OF MathMarkdown:
 * 1. normalizeLatexDelimiters() — converts LLM-style delimiters (\[...\], \(...\))
 *    to the standard $$...$$ that remark-math understands.
 * 2. chatMarkdownComponents — custom Tailwind-styled typography for chat bubbles.
 * 3. "chat-message-content" CSS class — triggers chat-specific KaTeX styling
 *    (muted background, rounded corners, padding) defined in globals.css lines 422-436.
 */
export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  const normalizedContent = normalizeLatexDelimiters(content)

  return (
    <MathMarkdown
      content={normalizedContent}
      className={cn('chat-message-content leading-relaxed', className)}
      components={chatMarkdownComponents}
    />
  )
}
```

**What was REMOVED** (moved to shared):

- `import ReactMarkdown` / `rehypeKatex` / `remarkMath` / `visit` / `Element` / `Root`
- The entire `rehypeMathWrapper()` function (75 lines)

**What STAYS** (chat-specific):

- `normalizeLatexDelimiters` import + usage
- `chatMarkdownComponents` (15+ styled element overrides)
- `chat-message-content` CSS class
- The `ChatMessageContent` component function

**Files NOT touched**:

- `normalize-latex.ts` — stays in place
- `globals.css` — all CSS unchanged
- `src/ui/web/chat/index.ts` — same export path

**Test gate**: Existing `ChatMessageContent.test.tsx` tests must ALL pass (Step 8)

---

### Step 5: Refactor `RichTextRenderer` to use `MathMarkdown`

**Time**: ~10 minutes
**File**: `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` (EDIT — 30 lines → ~20 lines)

**What the file should look like after**:

```typescript
/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX) using the shared MathMarkdown component.
 */

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'

interface RichTextRendererProps {
  block: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
}

export function RichTextRenderer({ block }: RichTextRendererProps) {
  return (
    <MathMarkdown
      content={block.value}
      className="rich-text-content leading-relaxed text-foreground"
    />
  )
}
```

**What was REMOVED**:

- `import React` / `ReactMarkdown` / `rehypeKatex` / `remarkMath`
- `import 'katex/dist/katex.min.css'` — REDUNDANT (already in globals.css)

**What this GAINS (bug fix)**:

- RTL isolation via `rehypeMathWrapper` — exercises in Hebrew now correctly
  render math with `dir="ltr"` wrapping

**Cascade effect**: Because all question components import `RichTextRenderer` from
this same path, ALL of these locations automatically get math + RTL support:

- MCQ prompts and option labels (`McqQuestion/index.tsx:59, 105`)
- True/False prompts and option labels (`TrueFalseQuestion/index.tsx:70, 108`)
- Free response prompts (`FreeResponseQuestion/index.tsx:42`)
- Content blocks in ExerciseRenderer (`ExerciseRenderer/index.tsx:160`)
- BlockRenderer passthrough (`BlockRenderer/index.tsx:30`)

**Test gate**: MathMarkdown tests (Step 7) + visual verification

---

### Step 6: Delete the `NotebookFormulas` component (dead code)

**Time**: ~5 minutes
**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/NotebookFormulas/index.tsx` (DELETE)

**Why**: Exported but never imported anywhere. Zero references in .tsx/.ts files.
Only appears in auto-generated AI indexes which get regenerated.

```bash
git rm -r "src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/NotebookFormulas/"
```

**Test gate**: `pnpm tsc --noEmit` passes (no broken imports)

---

### Step 7: Write tests for the shared `MathMarkdown` component

**Time**: ~20 minutes
**File**: `tests/unit/components/shared/MathMarkdown.test.tsx` (NEW)

Follow the exact patterns from `tests/unit/components/chat/ChatMessageContent.test.tsx`.

```typescript
// @vitest-environment jsdom
import { MathMarkdown } from '@/ui/web/shared'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('MathMarkdown', () => {
  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(
        <MathMarkdown content="The value is $E = mc^2$ here" />,
      )

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(
        <MathMarkdown content="Given $x = 5$ and $y = 10$" />,
      )

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(
        <MathMarkdown content={'$$\nx = \\frac{-b}{2a}\n$$'} />,
      )

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })
  })

  describe('Custom components', () => {
    it('applies custom component overrides when provided', () => {
      const { container } = render(
        <MathMarkdown
          content="Hello world"
          components={{
            p: ({ children }) => <p data-testid="custom-p">{children}</p>,
          }}
        />,
      )

      expect(container.querySelector('[data-testid="custom-p"]')).not.toBeNull()
    })

    it('renders default elements when no components provided', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('p')).not.toBeNull()
      expect(container.querySelector('[data-testid]')).toBeNull()
    })
  })

  describe('className', () => {
    it('applies className to wrapper div', () => {
      const { container } = render(
        <MathMarkdown content="test" className="my-custom-class" />,
      )

      expect(container.querySelector('.my-custom-class')).not.toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('renders without errors when content is empty', () => {
      const { container } = render(<MathMarkdown content="" />)
      expect(container.firstElementChild).not.toBeNull()
    })

    it('does NOT normalize LaTeX delimiters (that is chat-specific)', () => {
      // MathMarkdown does NOT call normalizeLatexDelimiters.
      // \[...\] is NOT recognized by remark-math, so no KaTeX rendered.
      // This verifies the shared component stays generic.
      const { container } = render(
        <MathMarkdown content="\\[ x^2 \\]" />,
      )

      expect(container.querySelector('.katex')).toBeNull()
    })
  })
})
```

**Test gate**: All tests pass: `pnpm vitest run tests/unit/components/shared/MathMarkdown.test.tsx`

---

### Step 8: Run verification commands

**Time**: ~10 minutes

```bash
# 1. Type-check (catches import errors, missing types)
pnpm tsc --noEmit

# 2. Run new MathMarkdown tests
pnpm vitest run tests/unit/components/shared/MathMarkdown.test.tsx

# 3. Run existing ChatMessageContent tests (must ALL still pass)
pnpm vitest run tests/unit/components/chat/ChatMessageContent.test.tsx

# 4. Run normalize-latex tests (file untouched, must pass)
pnpm vitest run tests/unit/components/chat/normalize-latex.test.ts

# 5. Lint check
pnpm lint

# 6. Generate import map (new components created)
pnpm generate:importmap
```

**Troubleshooting**:

| Problem                                        | Cause                                       | Fix                                                                              |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| ChatMessageContent tests fail on RTL selectors | rehypeMathWrapper logic changed during move | Diff extracted function against original — must be byte-for-byte identical       |
| Type error on `components` prop                | Wrong `Components` type import              | Import from `'react-markdown'` (not `'react-markdown/lib'`)                      |
| "Module not found" for MathMarkdown            | Missing barrel export                       | Check Step 3 — `src/ui/web/shared/index.ts` must have the export                 |
| Lint error about unused imports                | Old imports left in ChatMessageContent      | Remove: `ReactMarkdown`, `rehypeKatex`, `remarkMath`, `visit`, `Element`, `Root` |
| New test fails on `\[...\]`                    | Normalization leaked into shared component  | Ensure MathMarkdown does NOT import `normalizeLatexDelimiters`                   |

---

## What NOT to Change

These files must NOT be modified:

- **`src/app/(frontend)/globals.css`** — KaTeX CSS + `.chat-message-content .katex` rules stay
- **`src/app/(payload)/custom.scss`** — Admin panel KaTeX CSS stays
- **`src/ui/web/chat/ChatMessageContent/normalize-latex.ts`** — Chat-specific, unchanged
- **`tests/unit/components/chat/normalize-latex.test.ts`** — Tests for above, unchanged
- **`src/ui/web/chat/index.ts`** — Same export path
- **`src/ui/web/chat/ChatInterface/index.tsx`** — Imports ChatMessageContent same path
- **`src/ui/web/exerciserenderer/blocks/BlockRenderer/index.tsx`** — Imports RichTextRenderer same path
- **All question components** (McqQuestion, TrueFalseQuestion, FreeResponseQuestion) — Same import paths

---

## Visual Behavior Verification

After all changes, verify:

1. **Chat messages** — Math has muted background, rounded corners, padding.
   _(Styled by `.chat-message-content .katex` CSS — unchanged)_

2. **Exercise content (Hebrew)** — Math has `dir="ltr"` wrapping (NEW).
   Switch to Hebrew locale, view exercise with math. Should read left-to-right.

3. **Exercise content** — Math does NOT have chat-style muted background.
   _(`.rich-text-content` does not match `.chat-message-content .katex` rule)_

4. **MCQ options with math** — If option value contains `$\frac{1}{2}$`,
   it should render as inline KaTeX within the option label.

---

## Known Data Issues (Separate from This Refactor)

These are NOT fixed by this refactor. They need separate work:

### 1. AI extractor may omit `$...$` delimiters in MCQ options

- **File**: `src/infra/llm/prompts/simple-text-question.ts:14-24`
- **Problem**: Prompt shows options as plain strings. LLM may return `\frac{1}{2}`
  without dollar signs. remark-math won't recognize it.
- **Fix**: Update prompt examples; post-process option values at ingestion.

### 2. Schema mismatch for `option.content`

- **Contract** (`src/infra/contracts/exercise/answers.ts:19`): `RichTextBlock[]` (array)
- **Collection** (`src/server/payload/collections/Exercises/schemas.ts:47`): `InlineRichText` (single)
- **Problem**: If DB data uses array format, `...option.content` spread → `undefined` value
- **Fix**: Align schema or add adapter in McqQuestion.

### 3. Double-escaped LaTeX in exercise content

- **Problem**: `$\\frac{1}{2}$` → KaTeX error. Exercise content doesn't normalize.
- **Fix**: Ensure `parseExtractorResponseText()` properly un-escapes before DB storage.

---

## Summary: What Each Component Does After Refactor

### `<MathMarkdown>` (NEW — `src/ui/web/shared/MathMarkdown/index.tsx`)

- **Input**: markdown string with `$...$` / `$$...$$` math
- **Output**: rendered HTML with KaTeX math + RTL `dir="ltr"` isolation
- **Props**: `content`, `className`, `components` (optional)
- **Used by**: RichTextRenderer, ChatMessageContent, any future markdown need

### `<ChatMessageContent>` (REFACTORED — `src/ui/web/chat/ChatMessageContent/index.tsx`)

- **Wraps** `<MathMarkdown>` and adds 3 chat-specific things:
  1. `normalizeLatexDelimiters()` — fixes LLM-generated `\[...\]` delimiters
  2. `chatMarkdownComponents` — 15+ Tailwind-styled element overrides
  3. `chat-message-content` CSS class — triggers chat-specific KaTeX visual style
- **Public API unchanged** — same props, same export path

### `<RichTextRenderer>` (SIMPLIFIED — `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx`)

- **Wraps** `<MathMarkdown>` with `className="rich-text-content"`
- **Bug fix**: Now gains RTL isolation
- **Public API unchanged** — same props, same export path
- **Cascade**: All question components (MCQ, T/F, FreeResponse) automatically benefit
