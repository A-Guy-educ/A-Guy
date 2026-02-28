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
- [ ] Inline style attributes are preserved (Note: intentionally blocked by server for security)
- [ ] CSS keyframe animations execute properly
- [ ] Complex CSS layouts (flexbox, grid) render correctly
- [ ] `id` attribute is preserved for CSS styling hooks

### AC-2: SVG Rendering
- [ ] SVG files display without errors
- [ ] SVG gradients (linearGradient, radialGradient) render correctly
- [ ] SVG paths and shapes are visible
- [ ] SVG animations work (SMIL animations: <animate>, <animateTransform>, <set>)
- [ ] SVG <use> element references work with href attributes

### AC-4: Code Changes Required
- [ ] SafeHtml: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
- [ ] HtmlBlockRenderer: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
- [ ] HtmlBlockEditor: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
- [ ] svgSanitize: Add animation elements and href attributes for SVG use elements

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
6. `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` - Admin editor

## Gaps Identified

### Gap 1: HTML Style Tag Not Allowed in Frontend (CRITICAL)
- **Location**: SafeHtml, HtmlBlockRenderer, HtmlBlockEditor
- **Issue**: Server config (config.ts line 161) allows `<style>` tag, but frontend DOMPurify configs do NOT include `'style'` in ALLOWED_TAGS
- **Result**: Internal CSS (<style> tags) are stripped when rendering HTML content
- **Fix Required**: Add `'style'` to ALLOWED_TAGS in all frontend sanitization configs

### Gap 2: ID Attribute Missing in Some Frontend Configs (MEDIUM)
- **Location**: SafeHtml, HtmlBlockRenderer
- **Issue**: `id` attribute is missing from ALLOWED_ATTR but is used for styling hooks
- **Fix Required**: Add `'id'` to ALLOWED_ATTR in SafeHtml and HtmlBlockRenderer

### Gap 3: SVG Animation Elements Stripped (HIGH)
- **Location**: svgSanitize.ts
- **Issue**: Using `USE_PROFILES: { svg: true, svgFilters: true }` strips SMIL animation elements:
  - `<animate>`, `<animateTransform>`, `<set>`, `<mpath>`
- **Result**: SVG animations don't render
- **Fix Required**: Add animation elements to allowed list or use custom config

### Gap 4: Inline Style Attribute Blocked (CONFLICT)
- **Location**: Server config explicitly blocks inline styles
- **Note**: Server config (line 269-270) intentionally blocks `style` attribute. The spec requirements mention inline styles should work, but this conflicts with server security. The fix should focus on `<style>` tags working properly.

### Gap 5: SVG Use Element Missing Attributes (MEDIUM)
- **Location**: svgSanitize.ts
- **Issue**: `<use>` element needs `href`, `xlink:href`, `requiredFeatures` for referencing animated elements
- **Fix Required**: Add these attributes to ADD_ATTR in svgSanitize

## Required Changes to Spec

### FR-1: HTML Content Rendering (Updated)
- HTML content with internal CSS (<style> tags) must render properly
- **NOTE**: Inline `style` attribute is intentionally blocked by server config for security
- All internal CSS rules, layouts, and visual styling must be reflected via `<style>` tags
