# Specification: HTML & SVG Content Rendering Fix

## Overview
Fix the bug where HTML and SVG content in exercises/lessons displays plain text only or fails to render styles/animations.

## Requirements

### FR-1: HTML Content Rendering
- HTML content with internal CSS (<style> tags) must render properly
- Inline styles on HTML elements must be preserved
- CSS animations (keyframes) must work correctly
- All CSS rules, layouts, and visual styling must be reflected in the rendered output

### FR-2: SVG Content Rendering
- SVG graphics must be fully visible on the page
- Vector paths must be preserved
- Colors and gradients must display correctly
- SVG animations must work (including <animate> elements and CSS animations within SVG)

### FR-3: Sanitization Compatibility
- Security sanitization must remain in place
- Sanitization should not strip legitimate CSS and SVG features needed for educational content

## Acceptance Criteria

### AC-1: HTML Rendering
- [ ] Internal <style> tags are not stripped from HTML content
- [ ] Inline style attributes are preserved
- [ ] CSS keyframe animations execute properly
- [ ] Complex CSS layouts (flexbox, grid) render correctly

### AC-2: SVG Rendering
- [ ] SVG files display without errors
- [ ] SVG gradients (linearGradient, radialGradient) render correctly
- [ ] SVG paths and shapes are visible
- [ ] SVG animations work (SMIL animations, CSS animations within SVG)

### AC-3: Verification Steps
- Add HtmlBlock with internal CSS and animations → renders correctly
- Add SvgBlock with gradients/animations → renders correctly
- View lesson with HTML source → styles and animations work
- View exercise with SVG content → vector graphics and animations display

## Suspected Files to Investigate

1. `src/ui/web/SafeHtml/index.tsx` - Sanitization logic
2. `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx` - SVG rendering
3. `src/ui/web/exerciserenderer/utils/svgSanitize.ts` - SVG sanitization
4. `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` - HTML block rendering
5. `src/server/payload/blocks/HtmlBlock/config.ts` - Server configuration
