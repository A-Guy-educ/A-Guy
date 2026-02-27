# Specification: HTML & SVG Content Rendering Fix

## Overview
Fix the bug where HTML and SVG content in exercises/lessons displays plain text only or fails to render styles/animations.

## Requirements

### FR-1: HTML Content Rendering
- HTML content with internal CSS (<style>), inline styles, and CSS animations (keyframes) must render completely
- The content should function as a complete "HTML Compiler" reflecting all CSS rules, layouts, and animations

### FR-1.1: Style Tag Support
- The `<style>` tag must be allowed in sanitization
- This is required for internal CSS and @keyframes animations
- Files affected: SafeHtml, HtmlBlockRenderer (currently missing from ALLOWED_TAGS)

### FR-1.2: CSS Animation Support  
- CSS animations using @keyframes within style tags must render
- All standard CSS animation properties must be preserved (animation-name, animation-duration, animation-timing-function, animation-delay, animation-iteration-count, animation-direction, animation-fill-mode, animation-play-state)

### FR-2: SVG Content Rendering
- SVG graphics must be fully visible
- All vector paths, colors, and internal animations must be preserved
- Gradients and complex SVG properties must render correctly

### FR-2.1: SVG Tag Support
- The following SVG tags must be allowed in HTML sanitization:
  - Container: svg
  - Shapes: path, circle, rect, line, polyline, polygon
  - Structure: g, defs, use
  - Gradients: linearGradient, radialGradient, stop
  - Animation: animate, animateTransform, animateMotion, set, mpath

### FR-2.2: SVG Attribute Support
- The following SVG attributes must be allowed:
  - Geometry: d, cx, cy, r, rx, ry, x, y, width, height, points
  - Presentation: fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-opacity, fill-rule, clip-rule
  - View: viewBox
  - Gradient: gradientUnits, gradientTransform, x1, x2, y1, y2, fx, fy, fr, spreadmethod, offset, stop-color, stop-opacity
  - Links: href, xlink:href

### FR-2.3: SVG Animation Support
- SVG animation elements must render correctly:
  - `<animate>` for attribute animations
  - `<animateTransform>` for transform animations  
  - `<animateMotion>` for motion paths
  - `<set>` for delayed attribute setting
  - `<mpath>` for motion path references

### FR-3: Sanitization Balance
- Maintain security by sanitizing malicious code
- Allow legitimate CSS and SVG features to pass through sanitization
- Ensure <style>, <animate>, gradients, and related attributes are not incorrectly stripped

## Non-Functional Requirements

### NR-1: Admin Editor Consistency
- Admin editor preview (HtmlBlockEditor) should have sanitization consistent with server validation rules
- Users should be able to preview their content accurately before saving

## Acceptance Criteria

### AC-1: HTML Rendering Test
- [ ] Add HtmlBlock with internal CSS `<style>` tags
- [ ] Add CSS animations using @keyframes
- [ ] Verify CSS properties like animation, transform, transition work
- [ ] View in frontend - all styling and animations must work
- [ ] Verify layout and positioning are preserved

### AC-2: SVG Rendering Test
- [ ] Add SvgBlock or upload .svg file with paths
- [ ] Include inline SVG in HtmlBlock with paths
- [ ] Include gradients in SVG (linearGradient, radialGradient)
- [ ] Include animations (<animate> tags)
- [ ] View in frontend - all elements must be visible and animated
- [ ] Verify SVG transforms and animations work

### AC-3: Security
- [ ] Malicious scripts are still blocked
- [ ] XSS vulnerabilities are prevented
- [ ] Only safe HTML/SVG features are allowed through
- [ ] Event handlers (onclick, onerror, onload, onmouseover) are blocked
- [ ] javascript: URLs are blocked
- [ ] Inline style attributes remain blocked (style= must not be allowed)

### AC-4: Admin Editor Preview
- [ ] HtmlBlockEditor preview shows same result as frontend render
- [ ] CSS styles visible in editor preview
- [ ] SVG elements visible in editor preview

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
