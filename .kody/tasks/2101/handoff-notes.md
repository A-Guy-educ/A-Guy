# Issue #2101: HtmlBlock Remove HTML Sanitization Restrictions

## What was done

**Server** (`src/server/payload/blocks/HtmlBlock/validate-html.ts`):
- Replaced the complex validation (tag allowlist, attribute restrictions, href URL validation) with a minimal pass-through that only blocks:
  - Dangerous tags: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<meta>`, `<base>`, `<link>`, `<title>`
  - Inline event handlers (`on*=` patterns)
  - `javascript:` URLs in href/src
- Added security comment noting this is admin-only content

**Client** (`src/ui/admin/QuillField/index.tsx`):
- Removed `DOMPurify` import and `SANITIZE_CONFIG`
- Removed DOMPurify sanitization call in `handleToggleSource()` - content now passes through unchanged
- Added security comment noting this is admin-only content

**Tests** (`tests/unit/blocks/html-block-validation.test.ts`):
- Rewrote test file to reflect new behavior
- Kept tests for remaining restrictions (dangerous tags, event handlers, javascript: URLs)
- Added tests for newly allowed features (style, details/summary, dir, external URLs, form elements, etc.)

## Root Cause
The original validation was too restrictive for admin content creators who needed to use `<details>/<summary>`, `style` attributes, `dir` attributes, and other valid HTML.

## Key Security Note
This change only affects the **admin** HtmlBlock. Content displayed to students still goes through proper escaping/sanitization on the client-side rendering path.
