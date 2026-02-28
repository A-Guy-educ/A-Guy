# Build Agent Report: 260227-auto-77

## Changes

- **src/ui/web/SafeHtml/index.tsx** - Added `'style'` to ALLOWED_TAGS and `'id'` to ALLOWED_ATTR in DOMPurify config to preserve internal CSS and id attributes
- **src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx** - Added `'style'` to ALLOWED_TAGS and `'id'` to ALLOWED_ATTR in DOMPurify config
- **src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx** - Added `'style'` to ALLOWED_TAGS in SANITIZE_CONFIG (already had 'id')
- **src/ui/web/exerciserenderer/utils/svgSanitize.ts** - Replaced USE_PROFILES with custom ALLOWED_TAGS and ALLOWED_ATTR to support SMIL animations (`<animate>`, `<animateTransform>`, `<set>`, `<mpath>`), CSS animations within SVG (`<style>`), and `<use>` element references with href/xlink:href attributes

## Tests Written

- **tests/unit/ui/SafeHtml.test.tsx** - Tests for SafeHtml component preserving style tags and id attributes
- **tests/unit/exerciserenderer/HtmlBlockRenderer.test.tsx** - Tests for HtmlBlockRenderer preserving style tags and id attributes
- **tests/unit/admin/HtmlBlockEditor.test.tsx** - Tests for HtmlBlockEditor preserving style tags during sanitization
- **tests/unit/exercise-renderer/svgSanitize.test.ts** - Extended with tests for SMIL animation elements, href attributes, and gradients (added 11 new tests to existing test file)

## Quality

- TypeScript: PASS
- Lint: PASS

## Summary

Fixed HTML and SVG content rendering in exercises/lessons by updating DOMPurify sanitization configs:

1. **HTML Style Tags**: Added `'style'` to ALLOWED_TAGS in SafeHtml, HtmlBlockRenderer, and HtmlBlockEditor to preserve internal CSS
2. **HTML ID Attributes**: Added `'id'` to ALLOWED_ATTR in SafeHtml and HtmlBlockRenderer for CSS styling hooks
3. **SVG Animations**: Replaced USE_PROFILES with custom config to preserve SMIL animation elements (`<animate>`, `<animateTransform>`, `<set>`, `<mpath>`)
4. **SVG Use Elements**: Added `href` and `xlink:href` to ALLOWED_ATTR for referencing elements
