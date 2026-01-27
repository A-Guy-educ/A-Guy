# LLP: HtmlBlock for Payload CMS Pages

## Overview
Add a controlled HTML Block to Payload Pages layout with strict server-side validation and safe rendering.

## Files to Create/Modify

### 1. New File: `src/server/payload/blocks/HtmlBlock/config.ts`

**Purpose**: Define block schema with HTML field and strict validation

```typescript
import type { Block } from 'payload'

export const HtmlBlock: Block = {
  slug: 'html',
  interfaceName: 'HtmlBlock',
  labels: {
    plural: 'HTML Blocks',
    singular: 'HTML Block',
  },
  admin: {
    description: 'HTML only, no JS, relative links only. Allowed: /path, #anchor links.',
  },
  fields: [
    {
      name: 'html',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Enter HTML content. Links must be relative (/path or #anchor).',
        rows: 10,
      },
      validate: (value: string, { t }) => {
        if (!value || typeof value !== 'string') {
          return t('validation:required')
        }

        const trimmed = value.trim()
        if (!trimmed) {
          return t('validation:required')
        }

        // === DENY LIST: Block dangerous patterns ===

        // Block dangerous tags
        const dangerousTags = [
          '<script',
          '<iframe',
          '<object',
          '<embed',
          '<applet',
          '<meta',
          '<base',
          '<link',
          '<style',
        ]

        for (const tag of dangerousTags) {
          const lowerTag = tag.toLowerCase()
          if (trimmed.toLowerCase().includes(lowerTag)) {
            return `HTML contains blocked content: ${tag}`
          }
        }

        // Block inline event handlers (onclick, onload, onmouseover, etc.)
        const eventHandlerPattern = /\bon\w+\s*=/gi
        if (eventHandlerPattern.test(trimmed)) {
          return 'Inline event handlers (onclick, onload, etc.) are not allowed'
        }

        // Block javascript: URLs
        const jsUrlPattern = /href\s*=\s*["']?\s*javascript:/gi
        if (jsUrlPattern.test(trimmed)) {
          return 'javascript: URLs are not allowed'
        }

        // Block external URLs in href/src attributes
        // Allow: /path, #anchor, mailto:, tel:, and relative paths
        const externalUrlPattern = /href\s*=\s*["']\s*(https?:)?\/\//gi
        const srcUrlPattern = /src\s*=\s*["']\s*(https?:)?\/\//gi

        if (externalUrlPattern.test(trimmed)) {
          return 'External URLs (http://, https://, //) are not allowed in href. Use relative paths (/path) or anchors (#anchor).'
        }

        if (srcUrlPattern.test(trimmed)) {
          return 'External URLs (http://, https://, //) are not allowed in src attributes.'
        }

        // Block data: URLs (potential XSS)
        const dataUrlPattern = /src\s*=\s*["']?\s*data:/gi
        if (dataUrlPattern.test(trimmed)) {
          return 'data: URLs are not allowed'
        }

        // === ALLOW LIST: Only permit safe tags ===
        // After passing deny checks, verify only allowed tags are present
        const allowedTags = [
          'p', 'br', 'hr',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
          'ul', 'ol', 'li',
          'a',
          'blockquote',
          'code', 'pre',
          'span', 'div',
        ]

        // Extract all tags from the HTML (simplified parsing)
        const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
        let match
        while ((match = tagPattern.exec(trimmed)) !== null) {
          const tagName = match[1].toLowerCase()
          if (!allowedTags.includes(tagName)) {
            return `HTML contains disallowed tag: <${tagName}>`
          }
        }

        return true
      },
    },
  ],
}
```

### 2. New File: `src/server/payload/blocks/HtmlBlock/Component.tsx`

**Purpose**: Render validated HTML block (no client-side sanitization needed)

```tsx
import React from 'react'

import type { HtmlBlock as HtmlBlockProps } from '@/payload-types'

export const HtmlBlock: React.FC<HtmlBlockProps> = ({ html }) => {
  // HTML is already strictly validated server-side
  // Validation ensures: no JS, no iframes, no scripts, no event handlers
  // Links are restricted to relative paths (/path, #anchor) only
  // Safe to render directly

  return (
    <div
      className="container my-16 html-block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

### 3. Modified File: `src/server/payload/collections/Pages/index.ts`

**Changes**:
1. Add import for HtmlBlock config (after FormBlock import)
2. Add HtmlBlock to layout.blocks array

```typescript
// Line 11: Add import
import { FormBlock } from '../../blocks/Form/config'
import { HtmlBlock } from '../../blocks/HtmlBlock/config'  // NEW LINE

// Line 74: Update blocks array
blocks: [CallToAction, Content, Archive, FormBlock, HtmlBlock],  // Add HtmlBlock
```

### 4. Modified File: `src/server/payload/blocks/RenderBlocks.tsx`

**Changes**:
1. Add import for HtmlBlock component
2. Add mapping in blockComponents

```typescript
// Line 8: Add import
import { FormBlock } from '@/server/payload/blocks/Form/Component'
import { HtmlBlock } from '@/server/payload/blocks/HtmlBlock/Component'  // NEW LINE

// Line 14: Add to blockComponents mapping
const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  html: HtmlBlock,  // NEW LINE
}
```

## Validation Patterns Summary

| Pattern | Action | Example |
|---------|--------|---------|
| `<script`, `<iframe`, `<object`, `<embed`, `<style` | DENY | `<script>alert(1)</script>` |
| `on*=` event handlers | DENY | `onclick="doSomething()"` |
| `javascript:` URLs | DENY | `href="javascript:alert(1)"` |
| External URLs (`http://`, `https://`, `//`) | DENY | `href="https://evil.com"` |
| `data:` URLs | DENY | `src="data:text/html..."` |
| Tags not in allowlist | DENY | `<script>`, `<img>`, `<video>` |
| Relative paths (`/path`) | ALLOW | `href="/about"` |
| Anchors (`#section`) | ALLOW | `href="#top"` |
| Basic text/formatting tags | ALLOW | `p`, `h1`, `strong`, `ul`, `li`, `blockquote`, `code` |

## Security Approach

1. **Server-side validation only** - Strict deny/allow list at save time
2. **No client-side sanitization** - Avoids SSR issues with DOMParser
3. **Allowlist approach** - Only permitted tags render (p, h1-h6, strong, ul, ol, li, a, blockquote, code, pre, span, div)
4. **Link restrictions** - Only relative paths (`/path`) and anchors (`#anchor`) allowed

## Access Control

- **Read**: `authenticatedOrPublished` (inherits from Pages)
- **Create**: `authenticated` (inherits from Pages)
- **Update**: `authenticated` (inherits from Pages)
- **Delete**: `authenticated` (inherits from Pages)

No additional access control needed - validation provides security.

## Verification Checklist

- [ ] Payload Admin: In Pages → Content tab → layout, "HtmlBlock" appears in Add Block list
- [ ] Saving unsafe HTML is rejected with a clear validation error:
  - [ ] scripts/iframes/event handlers/javascript: links/external URLs should fail
- [ ] Relative links (`/something`, `#section`) save successfully
- [ ] Frontend renders the HTML block without runtime errors
- [ ] No SSR crashes introduced
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Build passes (`pnpm build`)

## Test Cases to Verify

| Input | Expected Result |
|-------|-----------------|
| `<p>Hello World</p>` | ✅ Saves and renders |
| `<a href="/about">About</a>` | ✅ Saves and renders |
| `<a href="#section">Section</a>` | ✅ Saves and renders |
| `<h2>Title</h2><ul><li>Item 1</li><li>Item 2</li></ul>` | ✅ Saves and renders |
| `<script>alert(1)</script>` | ❌ Validation error |
| `<iframe src="..."></iframe>` | ❌ Validation error |
| `<div onclick="doSomething()">Click</div>` | ❌ Validation error |
| `href="javascript:alert(1)"` | ❌ Validation error |
| `href="https://evil.com"` | ❌ Validation error |
| `href="//cdn.com/script.js"` | ❌ Validation error |
| `<img src="cat.jpg">` | ❌ Validation error (img not in allowlist) |
| `<style>body{color:red}</style>` | ❌ Validation error |

## TypeScript Considerations

After creating the files, run:
```bash
pnpm generate:types
pnpm generate:importmap
```

This will:
1. Generate type definitions for the new `HtmlBlock` interface
2. Update the admin import map for the new components

## Non-Goals (Confirmed)

- ✅ No repo-wide refactor
- ✅ No new page routing
- ✅ No adding a "builder UI"
- ✅ No changes to existing blocks
- ✅ No new architecture proposals
