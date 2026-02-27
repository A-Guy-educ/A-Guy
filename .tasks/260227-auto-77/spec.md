# Bug Report: HTML & SVG Content Rendering Failure

## Overview

HTML and SVG content in exercises/lessons displays plain text only or fails to render styles/animations. This is a critical bug affecting students who cannot view rich or interactive educational content.

## Requirements

### HTML Rendering
- FR-1: HTML content should render as a complete "HTML Compiler"
- FR-2: All CSS rules should be preserved and applied
- FR-3: Layouts should be maintained
- FR-4: CSS animations (including keyframes) should function properly
- FR-5: Internal CSS (<style> tags) should be preserved
- FR-6: Inline styles should be preserved

### SVG Rendering
- FR-7: SVG graphics should be fully visible
- FR-8: Vector paths should be preserved
- FR-9: Colors and gradients should be preserved
- FR-10: Internal SVG animations should function properly

## Acceptance Criteria

### HTML Acceptance Criteria
- [ ] HTML content renders as rendered HTML, not plain text
- [ ] CSS styling is applied to HTML elements
- [ ] CSS animations play correctly
- [ ] Internal <style> tags are not stripped
- [ ] Inline styles are preserved

### SVG Acceptance Criteria
- [ ] SVG images display correctly
- [ ] Vector paths render properly
- [ ] Gradients are preserved
- [ ] SVG animations (e.g., <animate> elements) work
- [ ] Complex SVG properties are not removed

## Suspected Areas

1. **Sanitization Logic**: `src/ui/web/SafeHtml/index.tsx` - Likely stripping <style>, <animate>, and specific attributes
2. **SVG Sanitizer**: `src/ui/web/exerciserenderer/utils/svgSanitize.ts` - Too restrictive for advanced SVG features
3. **HTML Renderer**: `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx`
4. **SVG Renderer**: `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx`
5. **Server Config**: `src/server/payload/blocks/HtmlBlock/config.ts`

## Scope & Impact

- **Affects**: All users (Students cannot view rich or interactive educational content)
- **Blocking**: Yes (Critical for technical and interactive course materials)
- **Regression**: No
