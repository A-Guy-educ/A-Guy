# Bug: XSS via unsanitized dangerouslySetInnerHTML in FormulaSheetContent

## Bug Description

`FormulaSheetContent` in `src/ui/web/shared/FormulaSheetViewer/FormulaSheetContent.tsx` renders HTML blocks using `dangerouslySetInnerHTML` without any sanitization:

```tsx
// Line 51-58
if (block.blockType === 'html' && 'html' in block) {
  return (
    <div
      key={block.id ?? index}
      className="rich-text-content"
      dangerouslySetInnerHTML={{ __html: block.html }}  // NO SANITIZATION
    />
  )
}
```

Unlike `HtmlBlockRenderer` and `SafeHtml` (which use DOMPurify), this component passes the raw `block.html` value directly to the DOM.

## Impact

**Stored XSS vulnerability**. If an admin enters or an attacker injects malicious HTML (e.g., `<img onerror="...">` or `<script>`) into a formula sheet's HTML block, it will execute in every student's browser session where that formula sheet is displayed. A compromised admin account or SSRF attack against the CMS API could exploit this.

## Suggested Fix

Use the existing `SafeHtml` component, matching the pattern used in `HtmlBlockRenderer`:

```tsx
import { SafeHtml } from '@/ui/web/SafeHtml'

// Replace the dangerouslySetInnerHTML div with:
<SafeHtml key={block.id ?? index} html={block.html} className="rich-text-content" />
```

## Complexity

Medium — requires importing and wiring up an existing sanitization component, plus verifying the change doesn't break formula rendering.