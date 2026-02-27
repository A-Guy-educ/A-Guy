# Specification: HTML & SVG Content Rendering Fix

## Overview
Fix the bug where HTML and SVG content in exercises/lessons displays plain text only or fails to render styles/animations.

## Requirements

### FR-1: HTML Content Rendering
- HTML content with internal CSS (<style>), inline styles, and CSS animations (keyframes) must render completely
- The content should function as a complete "HTML Compiler" reflecting all CSS rules, layouts, and animations

### FR-2: SVG Content Rendering
- SVG graphics must be fully visible
- All vector paths, colors, and internal animations must be preserved
- Gradients and complex SVG properties must render correctly

### FR-3: Sanitization Balance
- Maintain security by sanitizing malicious code
- Allow legitimate CSS and SVG features to pass through sanitization
- Ensure <style>, <animate>, gradients, and related attributes are not incorrectly stripped

## Acceptance Criteria

### AC-1: HTML Rendering Test
- [ ] Add HtmlBlock with internal CSS <style> tags
- [ ] Add CSS animations using @keyframes
- [ ] View in frontend - all styling and animations must work
- [ ] Verify layout and positioning are preserved

### AC-2: SVG Rendering Test
- [ ] Add SvgBlock or upload .svg file with paths
- [ ] Include gradients in SVG
- [ ] Include animations (<animate> tags)
- [ ] View in frontend - all elements must be visible and animated

### AC-3: Security
- [ ] Malicious scripts are still blocked
- [ ] XSS vulnerabilities are prevented
- [ ] Only safe HTML/SVG features are allowed through

## Environment
- Environment: dev / preview / prod
- Browser: All Browsers (Chrome/Safari/Firefox)
- Device: Desktop & Mobile

## Suspected Areas (for investigation)
1. src/ui/web/SafeHtml/index.tsx - Sanitization logic
2. src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx - SVG component
3. src/ui/web/exerciserenderer/utils/svgSanitize.ts - Custom SVG sanitizer
4. src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx - HTML renderer
5. src/server/payload/blocks/HtmlBlock/config.ts - Server config
