# Plan: Math Rendering with RTL/LTR Isolation (Chat)

## Summary

Add math rendering support to chat messages with proper RTL/LTR isolation, ensuring mathematical expressions display correctly in Hebrew (RTL) context.

---

## Decision: KaTeX (not MathJax)

Continue with **KaTeX** - already integrated, faster rendering, same syntax support.

---

## Current State

| Component        | Location                                                   | Current Behavior                           |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------ |
| ChatInterface    | `src/app/(frontend)/.../ChatInterface/index.tsx:104`       | `{msg.content}` - plain text               |
| NotebookChat     | `src/app/(frontend)/.../NotebookChat/index.tsx:85`         | `{msg.content}` - plain text               |
| RichTextRenderer | `src/components/ExerciseRenderer/blocks/RichTextRenderer/` | ReactMarkdown + remark-math + rehype-katex |
| KaTeX CSS        | Imported per-component, NOT global in frontend             | No RTL isolation                           |

---

## Implementation Plan

### Step 1: Add Global KaTeX CSS Import

**Update**: `src/app/(frontend)/globals.css`

Add at top of file (after tailwind imports):

```css
@import 'katex/dist/katex.min.css';
```

This ensures KaTeX CSS is loaded once globally. Remove per-component imports in future cleanup.

---

### Step 2: Create Math Wrapper Components

**New file**: `src/components/chat/ChatMessageContent/MathWrapper.tsx`

```tsx
import React from 'react'

interface MathWrapperProps {
  children: React.ReactNode
}

/**
 * InlineMath: Wraps inline math ($...$) with LTR isolation
 *
 * rehype-katex outputs: <span class="katex">...</span>
 * We wrap this to isolate it from RTL context.
 */
export function InlineMath({ children }: MathWrapperProps) {
  return (
    <span
      dir="ltr"
      className="math-inline"
      style={{
        unicodeBidi: 'isolate',
        direction: 'ltr',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  )
}

/**
 * BlockMath: Wraps display math ($$...$$) with LTR isolation
 *
 * rehype-katex outputs: <span class="katex-display"><span class="katex">...</span></span>
 * We wrap this to isolate it from RTL context.
 */
export function BlockMath({ children }: MathWrapperProps) {
  return (
    <div
      dir="ltr"
      className="math-block"
      style={{
        unicodeBidi: 'isolate',
        direction: 'ltr',
        display: 'block',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}
```

---

### Step 3: Create ChatMessageContent Component

**New file**: `src/components/chat/ChatMessageContent/index.tsx`

**Critical**: rehype-katex outputs:

- Inline: `<span class="katex">...</span>`
- Display: `<span class="katex-display"><span class="katex">...</span></span>`

We must wrap based on the **katex-display** class for block math, **katex** class (without katex-display parent) for inline.

```tsx
'use client'

import React from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { InlineMath, BlockMath } from './MathWrapper'
import { cn } from '@/utilities/ui'

interface ChatMessageContentProps {
  content: string
  className?: string
}

/**
 * Custom components for ReactMarkdown to wrap KaTeX output with RTL isolation.
 *
 * rehype-katex structure:
 * - Inline: <span class="katex">...</span>
 * - Display: <span class="katex-display"><span class="katex">...</span></span>
 */
const markdownComponents: Components = {
  span: ({ className, children, ...props }) => {
    // Block math: katex-display wrapper
    if (className?.includes('katex-display')) {
      return (
        <BlockMath>
          <span className={className} {...props}>
            {children}
          </span>
        </BlockMath>
      )
    }

    // Inline math: katex class but NOT inside katex-display
    // Check if this is a direct katex span (not nested in katex-display)
    if (className?.includes('katex') && !className?.includes('katex-display')) {
      // Only wrap if not already inside a BlockMath wrapper
      // The katex class inside katex-display will be handled by the parent
      return (
        <InlineMath>
          <span className={className} {...props}>
            {children}
          </span>
        </InlineMath>
      )
    }

    return (
      <span className={className} {...props}>
        {children}
      </span>
    )
  },
}

export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  return (
    <div className={cn('chat-message-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Problem with above approach**: The nested `<span class="katex">` inside `<span class="katex-display">` will also match the inline rule and get double-wrapped.

**Better approach - use a rehype plugin to add wrappers at AST level**:

```tsx
'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import type { Root, Element } from 'hast'
import { cn } from '@/utilities/ui'

interface ChatMessageContentProps {
  content: string
  className?: string
}

/**
 * Rehype plugin to wrap KaTeX output with RTL isolation.
 * Adds wrapper elements at the AST level before React rendering.
 */
function rehypeMathWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const className = Array.isArray(node.properties?.className)
        ? node.properties.className.join(' ')
        : String(node.properties?.className || '')

      // Block math: wrap katex-display
      if (className.includes('katex-display')) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            dir: 'ltr',
            className: ['math-block'],
            style: 'unicode-bidi: isolate; direction: ltr; display: block; text-align: center;',
          },
          children: [node],
        }
        parent.children[index] = wrapper
        return
      }

      // Inline math: wrap katex (but not if parent is katex-display)
      if (className.includes('katex') && node.tagName === 'span') {
        // Check if parent is katex-display (already handled)
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')

        if (parentClassName.includes('katex-display')) return

        const wrapper: Element = {
          type: 'element',
          tagName: 'span',
          properties: {
            dir: 'ltr',
            className: ['math-inline'],
            style: 'unicode-bidi: isolate; direction: ltr; display: inline-block;',
          },
          children: [node],
        }
        parent.children[index] = wrapper
      }
    })
  }
}

export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  return (
    <div className={cn('chat-message-content', className)}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeMathWrapper]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

---

### Step 4: Add RTL Isolation CSS

**Update**: `src/app/(frontend)/globals.css`

Add flat CSS selectors (no nesting, no @apply in component styles):

```css
/* RTL/LTR Isolation for Math - must be flat selectors */
.math-inline {
  direction: ltr;
  unicode-bidi: isolate;
  display: inline-block;
  vertical-align: middle;
}

.math-block {
  direction: ltr;
  unicode-bidi: isolate;
  display: block;
  text-align: center;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
```

---

### Step 5: Create Public Export

**New file**: `src/components/chat/index.ts`

```ts
export { ChatMessageContent } from './ChatMessageContent'
```

---

### Step 6: Update Chat Components

**ChatInterface** (`src/app/(frontend)/.../ChatInterface/index.tsx`):

```diff
+ import { ChatMessageContent } from '@/components/chat'

// Line 104:
- {msg.content}
+ <ChatMessageContent content={msg.content} />
```

**NotebookChat** (`src/app/(frontend)/.../NotebookChat/index.tsx`):

```diff
+ import { ChatMessageContent } from '@/components/chat'

// Line 85:
- {msg.content}
+ <ChatMessageContent content={msg.content} />
```

---

### Step 7: Add Tests

**New file**: `tests/unit/components/chat/ChatMessageContent.spec.tsx`

Focus on **targeted assertions**, not just snapshots:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatMessageContent } from '@/components/chat'

describe('ChatMessageContent', () => {
  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="Hello world" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })

    it('renders Hebrew text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="שלום עולם" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
    })

    it('does NOT wrap undelimited math-like text', () => {
      const { container } = render(<ChatMessageContent content="x + y = z without delimiters" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(
        <ChatMessageContent content="הנוסחה היא $E = mc^2$ והיא חשובה" />,
      )

      const inlineMath = container.querySelector('.math-inline')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.getAttribute('dir')).toBe('ltr')
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<ChatMessageContent content="נתון $x = 5$ ו-$y = 10$" />)

      const inlineMaths = container.querySelectorAll('.math-inline[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(
        <ChatMessageContent content={'הפתרון:\n\n$$x = \\frac{-b}{2a}$$'} />,
      )

      const blockMath = container.querySelector('.math-block')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.getAttribute('dir')).toBe('ltr')
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders multi-line block equations', () => {
      const { container } = render(
        <ChatMessageContent content={'$$\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}$$'} />,
      )

      const blockMath = container.querySelector('.math-block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
    })
  })

  describe('Mixed content', () => {
    it('handles Hebrew with both inline and block math', () => {
      const { container } = render(
        <ChatMessageContent content={'בעיה: מצא $x$\n\n$$x^2 = 4$$\n\nתשובה: $x = 2$'} />,
      )

      const inlineMaths = container.querySelectorAll('.math-inline[dir="ltr"]')
      const blockMaths = container.querySelectorAll('.math-block[dir="ltr"]')

      expect(inlineMaths.length).toBe(2)
      expect(blockMaths.length).toBe(1)
    })
  })

  describe('Edge cases', () => {
    it('handles empty content', () => {
      const { container } = render(<ChatMessageContent content="" />)
      expect(container.querySelector('.chat-message-content')).not.toBeNull()
    })

    it('handles math-only content', () => {
      const { container } = render(<ChatMessageContent content="$\\pi$" />)

      const inlineMath = container.querySelector('.math-inline[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
    })
  })
})
```

---

## File Structure

```
src/components/chat/
├── index.ts                          # Public exports
└── ChatMessageContent/
    ├── index.tsx                     # Main component with rehype plugin
    └── MathWrapper.tsx               # InlineMath + BlockMath (optional, for reference)

tests/unit/components/chat/
└── ChatMessageContent.spec.tsx       # Targeted assertion tests
```

---

## Files to Modify

| File                                             | Change                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/app/(frontend)/globals.css`                 | Add `@import 'katex/dist/katex.min.css'` and `.math-inline`, `.math-block` CSS |
| `src/app/(frontend)/.../ChatInterface/index.tsx` | Import and use `ChatMessageContent`                                            |
| `src/app/(frontend)/.../NotebookChat/index.tsx`  | Import and use `ChatMessageContent`                                            |

---

## Dependencies

Add `unist-util-visit` for AST traversal (if not already present):

```bash
pnpm add unist-util-visit
```

Also need types:

```bash
pnpm add -D @types/hast
```

---

## Verification

1. **Manual testing**:
   - Start dev server: `pnpm dev`
   - Navigate to chat interface
   - Send: `שלום $x^2$ עולם`
   - Send: `$$\sum_{i=1}^n i$$`
   - Verify: operators not flipped, symbols not reversed, block math centered

2. **Run tests**:

   ```bash
   pnpm vitest run tests/unit/components/chat/ChatMessageContent.spec.tsx
   ```

3. **Quality gates**:

   ```bash
   pnpm typecheck
   pnpm lint
   ```

4. **Cross-browser**: Chrome, Firefox, Safari

---

## Non-Negotiable Rules

- [ ] ALL math output wrapped in `InlineMath` OR `BlockMath` - no exceptions
- [ ] Inline and block math use DIFFERENT wrappers (span vs div)
- [ ] No heuristic math detection - only explicit `$`/`$$` delimiters
- [ ] KaTeX CSS loaded globally ONCE
- [ ] RTL isolation via `dir="ltr"` + `unicode-bidi: isolate`

---

## Definition of Done

- [ ] Global KaTeX CSS import added to globals.css
- [ ] `ChatMessageContent` component with rehype plugin for AST-level wrapping
- [ ] RTL isolation CSS (flat selectors) added
- [ ] `ChatInterface` updated
- [ ] `NotebookChat` updated
- [ ] All targeted tests passing (`.math-inline[dir="ltr"]`, `.math-block[dir="ltr"]`)
- [ ] Manual verification: Hebrew + math renders correctly
- [ ] No regression in non-math messages
- [ ] Typecheck and lint passing
