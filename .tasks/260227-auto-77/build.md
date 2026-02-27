# Build Agent Report: 260227-auto-77

## Changes

- **Created shared sanitization config module** (`src/lib/sanitize/config.ts`): Exports `HTML_BLOCK_PURIFY_CONFIG` with all required tags (style, SVG, SVG animation) and attributes, plus `initDOMPurifySafeLinks()` helper function for idempotent hook initialization.

- **Updated HtmlBlockRenderer** (`src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx`): Removed local `PURIFY_CONFIG` and replaced with shared `HTML_BLOCK_PURIFY_CONFIG`; uses idempotent `initDOMPurifySafeLinks()` instead of per-component hook setup.

- **Updated SafeHtml** (`src/ui/web/SafeHtml/index.tsx`): Removed local `PURIFY_CONFIG` and replaced with shared config; uses idempotent hook initialization.

- **Updated svgSanitize** (`src/ui/web/exerciserenderer/utils/svgSanitize.ts`): Added SVG animation tags (animate, animatetransform, animatemotion, set, mpath, style) to ADD_TAGS; added SVG animation attributes to ADD_ATTR; expanded FORBID_ATTR to include SVG animation event handlers (onbegin, onend, onrepeat, onfocusin, onfocusout, onactivate).

- **Updated server-side validation** (`src/server/payload/blocks/HtmlBlock/config.ts`): Added SVG animation tags (animate, animatetransform, animatemotion, set, mpath) to allowedTags and svgGeometryTags; added SVG animation attributes to svgAttrs; added mpath href validation (must start with #); added @import blocking in style tags.

- **Updated HtmlBlockEditor** (`src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx`): Removed local SANITIZE_CONFIG and replaced with shared `HTML_BLOCK_PURIFY_CONFIG`.

- **Updated HtmlBlockField** (`src/ui/admin/HtmlBlock/Field.tsx`): Added DOMPurify sanitization using `HTML_BLOCK_PURIFY_CONFIG` before rendering preview content.

## Tests Written

- `tests/unit/lib/sanitize/config.test.ts` - Verifies shared config has correct ALLOWED_TAGS (style, SVG, animation), ALLOWED_ATTR (including xlink:href, animation attributes), FORBID_ATTR (style, target), and FORBID_TAGS (script, iframe, etc.)
- `tests/unit/ui/web/html-block-renderer-sanitize.test.ts` - Verifies sanitizer preserves SVG elements, gradients, animation elements; strips scripts, event handlers, inline styles, javascript: URLs
- `tests/unit/exercise-renderer/svgSanitize.test.ts` (modified) - Added 10 new tests for SVG animation elements (animate, animateTransform, animateMotion, set, mpath), style in SVG, gradient preservation, and security (onbegin/onend stripping, javascript: href blocking)

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (2595 tests pass)
