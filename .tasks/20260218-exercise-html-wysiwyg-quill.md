# Plan: WYSIWYG HTML Block for Exercise Content Editor

**Date**: 2026-02-18
**Editor**: Quill.js via `react-quill-new`
**Storage**: HTML string
**Scope**: Exercise blocks only (Pages HtmlBlock unchanged)
**Sanitization**: Both server-side (Zod validation) and frontend (DOMPurify)

---

## Goal

Add a WYSIWYG HTML content block to the exercise editor so content authors can create rich formatted content (headings, bold, italic, lists, links, images, code blocks, blockquotes) using a visual editor (Quill.js) instead of writing raw Markdown or HTML. The block stores its data as an **HTML string**, and the frontend renders it safely with sanitization.

**What this is NOT:**

- We are NOT modifying the existing Pages `HtmlBlock` (the code-editor one stays as-is)
- We are NOT replacing the existing `rich_text` (Markdown) block -- the HTML block is a new option alongside it
- We are NOT using Payload's Lexical editor for this -- we're using Quill.js

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN (Payload CMS)                       │
│                                                             │
│  ExerciseContentEditor                                      │
│    ├── BlockTypeSelector  ← adds "HTML Block" option        │
│    ├── BlockList                                            │
│    │   ├── RichTextEditor (existing markdown blocks)        │
│    │   ├── HtmlBlockEditor (NEW - Quill WYSIWYG)           │
│    │   │   ├── Quill toolbar (bold, italic, headings...)   │
│    │   │   ├── Quill editor area (snow theme)             │
│    │   │   └── Source HTML toggle (raw HTML view)         │
│    │   └── Question editors (existing)                      │
│    └── JSONInspector (existing)                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ saves JSON: { blocks: [..., { type: "html", html: "<p>...</p>" }, ...] }
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE (MongoDB)                         │
│                                                             │
│  exercises.content.blocks[] includes:                       │
│    { id: "def", type: "html",                              │
│      html: "<h2>Formatted</h2><p>Content here</p>" }        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│                                                             │
│  ExerciseRenderer                                           │
│    ├── RichTextRenderer (existing)                          │
│    ├── HtmlBlockRenderer (NEW - DOMPurify → innerHTML)      │
│    └── Question renderers (existing)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies to Add

| Package                | Purpose                                                              | Note                           |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------ |
| `react-quill-new`      | React wrapper for Quill.js (maintained fork, TS built-in, React 18+) | ~238K weekly downloads, v3.8.3 |
| `isomorphic-dompurify` | HTML sanitization (works server + client)                            | For frontend rendering         |
| `@types/dompurify`     | TypeScript types for DOMPurify                                       | Dev dependency                 |

**NOT needed**: `react-quill` (unmaintained, 4 years old) or `quill` directly (bundled by `react-quill-new`).

**Important**: Quill requires the browser DOM. Since the admin editor is a `'use client'` component, this is fine. Use `next/dynamic` with `ssr: false`.

---

## Step-by-Step Implementation (12 Steps)

### Step 1: Install Dependencies

```bash
pnpm add react-quill-new isomorphic-dompurify
pnpm add -D @types/dompurify
```

---

### Step 2: Define the HtmlBlock Type

**File**: `src/shared/exercise-content/types.ts`

Add after the `SvgBlock` interface:

```typescript
// ---------------------------------
// HTML Block (WYSIWYG rich content)
// ---------------------------------
export interface HtmlBlock {
  id: string
  type: 'html'
  html: string // Sanitized HTML string from Quill
}
```

Add `HtmlBlock` to the `ContentBlock` union:

```typescript
export type ContentBlock =
  | RichTextBlock
  | ... // existing types
  | HtmlBlock               // ADD
```

**Junior tip**: The `ContentBlock` union type tells TypeScript "a block can be any one of these types". Adding `HtmlBlock` here makes `type: 'html'` a valid block.

---

### Step 3: Add Zod Validation Schema

**File**: `src/server/payload/collections/Exercises/schemas.ts`

Add after `SvgBlockSchema`:

```typescript
// ---------------------------------
// Zod: HTML Block (WYSIWYG content stored as sanitized HTML string)
// ---------------------------------

// Blocklist of dangerous HTML patterns (server-side defense-in-depth)
const DANGEROUS_HTML_PATTERNS = [
  /<script\b/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<applet\b/i,
  /\bon\w+\s*=/i, // inline event handlers (onclick, onload, etc.)
  /javascript\s*:/i, // javascript: URLs
]

export const HtmlBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('html'),
    html: z
      .string()
      .min(1, 'HTML content is required')
      .refine(
        (html) => !DANGEROUS_HTML_PATTERNS.some((pattern) => pattern.test(html)),
        'HTML contains blocked content (scripts, event handlers, or javascript: URLs)',
      ),
  })
  .strict()
```

Add `HtmlBlockSchema` to `ContentBlockSchema` discriminated union.

**Junior tip**: The `.refine()` adds a custom validation rule. Even though Quill doesn't produce `<script>` tags, someone could paste malicious HTML in source view or manipulate the API directly. This server-side check is our second line of defense.

---

### Step 4: Add Default Factory

**File**: `src/shared/exercise-content/defaults.ts`

Add `HtmlBlock` to the import and add factory in `ExerciseBlockDefaults`:

```typescript
import type { ..., HtmlBlock } from './types'

// Inside ExerciseBlockDefaults, add:
html: (): HtmlBlock => ({
  id: generateId(),
  type: 'html',
  html: '',
}),
```

**Junior tip**: This factory is called when the user clicks "Add Block" and selects "HTML Block". It creates a new block with a unique ID and empty HTML.

---

### Step 5: Add "HTML Block" to BlockTypeSelector

**File**: `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx`

Add `Code` to lucide-react import, then add to `blockTypes` array:

```typescript
{
  type: 'html',
  label: 'HTML Block',
  description: 'Rich WYSIWYG content (headings, lists, images, links)',
  icon: <Code size={20} />,
},
```

**Junior tip**: The `type: 'html'` must match the key in `ExerciseBlockDefaults`.

---

### Step 6: Create the Quill WYSIWYG Editor Component (Admin)

**New file**: `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx`

Key implementation details:

```typescript
'use client'

import type { HtmlBlock } from '@/shared/exercise-content/types'
import dynamic from 'next/dynamic'
import React, { useState, useMemo } from 'react'

// Dynamic import - Quill requires browser DOM, cannot run server-side
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

// Quill toolbar configuration
const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ direction: 'rtl' }],        // RTL support for Hebrew
    ['clean'],                       // Remove formatting
  ],
}

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block',
  'link', 'image', 'direction',
]

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange }) => {
  const [showSource, setShowSource] = useState(false)

  // Memoize modules to prevent Quill re-initialization
  const modules = useMemo(() => QUILL_MODULES, [])

  const handleChange = (html: string) => {
    // Quill outputs '<p><br></p>' for empty content - normalize
    const normalized = html === '<p><br></p>' ? '' : html
    onChange({ ...block, html: normalized })
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, html: e.target.value })
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <button
          type="button"
          className={`html-editor-source-toggle ${showSource ? 'html-editor-source-toggle--active' : ''}`}
          onClick={() => setShowSource(!showSource)}
        >
          {showSource ? 'Visual Editor' : 'HTML Source'}
        </button>
      </div>

      {showSource ? (
        <textarea
          className="html-block-source-textarea"
          value={block.html}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={block.html}
          onChange={handleChange}
          modules={modules}
          formats={QUILL_FORMATS}
          placeholder="Start typing your content here..."
        />
      )}
    </div>
  )
}
```

**Key notes**:

- `dynamic(() => import('react-quill-new'), { ssr: false })` -- Quill accesses `document` and `window` which don't exist on the server.
- `useMemo` on modules is critical -- if modules object changes identity on each render, Quill destroys and recreates the editor.
- The `{ direction: 'rtl' }` toolbar option supports Hebrew content.

---

### Step 7: Add CSS for the Editor

**File**: `src/ui/admin/ExerciseContentEditor/index.css` (append)

Need to import Quill's snow theme CSS. Add to the HtmlBlockEditor component:

```typescript
import 'react-quill-new/dist/quill.snow.css'
```

And add scoped styles:

```css
/* ─── HTML Block Editor ─── */
.html-block-editor {
  border: 1px solid var(--theme-elevation-150);
  border-radius: 4px;
  overflow: hidden;
}

.html-block-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--theme-elevation-50);
  border-bottom: 1px solid var(--theme-elevation-150);
}

.html-block-editor-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-elevation-500);
}

.html-editor-source-toggle {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: var(--theme-elevation-100);
  border: 1px solid var(--theme-elevation-200);
  border-radius: 3px;
  cursor: pointer;
}

.html-editor-source-toggle--active {
  background: var(--theme-elevation-200);
}

.html-block-source-textarea {
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  border: none;
  resize: vertical;
  background: var(--theme-elevation-0);
  color: var(--theme-text);
}

/* Quill theme overrides */
.html-block-editor .ql-toolbar {
  border: none;
  border-bottom: 1px solid var(--theme-elevation-150);
  background: var(--theme-elevation-50);
}

.html-block-editor .ql-container {
  border: none;
  min-height: 200px;
  font-size: 1rem;
}

.html-block-editor .ql-editor {
  min-height: 180px;
  padding: 1rem;
}
```

---

### Step 8: Wire HtmlBlockEditor into ExerciseContentEditor

**File**: `src/ui/admin/ExerciseContentEditor/index.tsx`

Three changes:

**8a.** Add import:

```typescript
import { HtmlBlockEditor } from './editors/HtmlBlockEditor'
```

**8b.** Update `getBlockTypeLabel`:

```typescript
if (block.type === 'html') return 'HTML Block'
```

**8c.** Update `BlockList` rendering. Add `isHtml` check alongside `isRichText`:

```typescript
const isRichText = block.type === 'rich_text'
const isHtml = block.type === 'html'

// Then: isRichText ? (...) : isHtml ? ( ...HtmlBlockEditor... ) : ( ...question blocks... )
```

The HTML block gets the same block controls (move up/down, duplicate, delete) as other blocks.

---

### Step 9: Create Frontend HTML Renderer

**New file**: `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx`

```typescript
import DOMPurify from 'isomorphic-dompurify'

interface HtmlBlockRendererProps {
  block: {
    type: 'html'
    html: string
  }
}

const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'div', 'section',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'target', 'rel', 'width', 'height',
    'colspan', 'rowspan', 'dir',
  ],
}

export function HtmlBlockRenderer({ block }: HtmlBlockRendererProps) {
  if (!block.html?.trim()) return null

  const cleanHtml = DOMPurify.sanitize(block.html, PURIFY_CONFIG)

  return (
    <div
      className="html-block-content"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}
```

**Junior tip**: `DOMPurify.sanitize()` strips any HTML tags/attributes not in our allowlist.

---

### Step 10: Wire Renderer into ExerciseRenderer

**File**: `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`

Add import and rendering branch after the `rich_text` handler:

```typescript
import { HtmlBlockRenderer } from '../blocks/HtmlBlockRenderer'

// Inside content.blocks.map, after rich_text check:
if (block.type === 'html') {
  return (
    <div
      key={block.id}
      className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed"
    >
      <HtmlBlockRenderer block={block} />
    </div>
  )
}
```

**Junior tip**: The `prose` class from Tailwind Typography applies nice default styles to raw HTML.

---

### Step 11: Update Renderer Types

**File**: `src/ui/web/exerciserenderer/types.ts`

Add the HtmlBlock type and update the ContentBlock union:

```typescript
export interface HtmlBlock {
  id: string
  type: 'html'
  html: string
}

// Update ContentBlock union:
export type ContentBlock = RichTextBlock | HtmlBlock | QuestionBlock
```

---

### Step 12: Generate Types and Validate

```bash
pnpm generate:types
pnpm generate:importmap
pnpm tsc --noEmit
pnpm lint
```

---

## File Map

### New Files (2)

| File                                                             | Purpose                       |
| ---------------------------------------------------------------- | ----------------------------- |
| `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` | Quill WYSIWYG editor (admin)  |
| `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` | Safe HTML renderer (frontend) |

### Modified Files (9)

| File                                                       | Change                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `package.json`                                             | Add `react-quill-new`, `isomorphic-dompurify`, `@types/dompurify` |
| `src/shared/exercise-content/types.ts`                     | Add `HtmlBlock` interface + union                                 |
| `src/server/payload/collections/Exercises/schemas.ts`      | Add `HtmlBlockSchema` + dangerous pattern validation + union      |
| `src/shared/exercise-content/defaults.ts`                  | Add `html` factory function                                       |
| `src/ui/admin/ExerciseContentEditor/BlockTypeSelector.tsx` | Add "HTML Block" option                                           |
| `src/ui/admin/ExerciseContentEditor/index.tsx`             | Import + render HtmlBlockEditor                                   |
| `src/ui/admin/ExerciseContentEditor/index.css`             | Add Quill editor styles                                           |
| `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`   | Import + render HtmlBlockRenderer                                 |
| `src/ui/web/exerciserenderer/types.ts`                     | Add HtmlBlock type + union                                        |

---

## Testing Checklist

1. **Admin - Block Creation**: Add Block -> "HTML Block" -> empty Quill editor appears
2. **Admin - WYSIWYG**: Bold, italic, headings, lists, blockquote, code, link, image, undo/redo all work
3. **Admin - RTL**: Direction toggle works for Hebrew content
4. **Admin - Source Toggle**: WYSIWYG -> Source -> WYSIWYG round-trips correctly
5. **Admin - Save**: Changes persist after reload, JSON has `{ type: 'html', html: '...' }`
6. **Admin - Block ops**: Move up/down, duplicate, delete all work
7. **Frontend - Rendering**: HTML renders with proper typography in `prose` container
8. **Frontend - Sanitization**: `<script>alert('xss')</script>` in source view gets stripped
9. **Server - Validation**: Zod rejects blocks with `<script>`, `onclick=`, `javascript:` patterns
10. **Dark mode**: Both admin editor and frontend rendering look correct

---

## Risks & Open Questions

| Risk                                   | Mitigation                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Quill SSR crash (requires DOM)         | `next/dynamic` with `ssr: false`                                        |
| XSS from stored HTML                   | Defense-in-depth: Zod regex blocklist on server + DOMPurify on frontend |
| Quill CSS conflicts with Payload admin | Scope styles with `.html-block-editor` wrapper                          |
| Bundle size (~43KB gzipped for Quill)  | Only loaded in admin, not frontend                                      |

| Open Question                                                       | Recommendation                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Image uploads: prompt for URL or integrate with Payload Media?      | Start with URL prompt, add Media integration as follow-up |
| Should existing `rich_text` blocks have a "convert to HTML" option? | Not in v1, consider later                                 |
| Quill's `<p><br></p>` empty state vs our `min(1)` Zod check?        | Normalize in `handleChange` before it reaches the schema  |
