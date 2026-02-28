# Bug Fix Specification: HTML & SVG Content Rendering Failure

## Overview

Fix the rendering issue where HTML content with CSS styles/animations and SVG content with paths/gradients/animations display as plain text or fail to render properly.

## Requirements

1. **HTML Rendering**: Content should render as a complete "HTML Compiler" with full CSS support
   - Internal CSS (`<style>` tags) must be preserved
   - Inline styles must be preserved
   - CSS animations (keyframes) must work

2. **SVG Rendering**: Graphics should be fully visible
   - Vector paths must be preserved
   - Colors must be preserved
   - Internal animations must work
   - Gradients must render correctly

## Suspected Root Causes

- **Sanitization Logic**: `src/ui/web/SafeHtml/index.tsx` — Likely stripping `<style>`, `<animate>`, and specific attributes
- **SVG Components**: 
  - `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx`
  - `src/ui/web/exerciserenderer/utils/svgSanitize.ts` — Custom sanitizer may be too restrictive
- **Renderers**: `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx`
- **Server Config**: `src/server/payload/blocks/HtmlBlock/config.ts`

## Acceptance Criteria

1. HTML blocks with internal CSS render with all styles applied
2. HTML blocks with CSS animations animate correctly
3. SVG files display with all vector paths visible
4. SVG animations play correctly
5. SVG gradients render properly
6. No security vulnerabilities introduced (XSS prevention still works)
