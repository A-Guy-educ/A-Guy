# Gap Analysis: 260227-auto-77

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Style Tag in SafeHtml and HtmlBlockRenderer

**Severity:** Critical
**Location:** 
- src/ui/web/SafeHtml/index.tsx (line 7-45)
- src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx (line 14-52)

**Issue:** Both components have `<style>` missing from ALLOWED_TAGS. The server-side validation in HtmlBlock/config.ts explicitly allows `<style>` tags (line 161), but the frontend sanitization strips them completely. This is why CSS animations and internal styles don't render.

**Fix Applied:** Added FR-1.1 requiring `<style>` tag support and updated AC-1 to explicitly test internal CSS.

### Gap 2: Missing SVG Tags in SafeHtml and HtmlBlockRenderer

**Severity:** High
**Location:** 
- src/ui/web/SafeHtml/index.tsx (line 7-45)
- src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx (line 14-52)

**Issue:** Neither component allows any SVG tags. The server config (HtmlBlock/config.ts lines 172-186) allows svg, path, circle, rect, line, polyline, polygon, g, defs, lineargradient, radialgradient, stop, use - but frontend strips all SVG content. This affects inline SVGs in HtmlBlock.

**Fix Applied:** Added FR-2.1 listing required SVG tags and updated AC-2 to verify inline SVG rendering.

### Gap 3: Missing SVG Attributes in SafeHtml and HtmlBlockRenderer

**Severity:** High
**Location:** 
- src/ui/web/SafeHtml/index.tsx (line 46-59)
- src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx (line 53-66)

**Issue:** SafeHtml/ HtmlBlockRenderer don't allow SVG-specific attributes (viewBox, fill, stroke, d, cx, cy, r, x, y, width, height, gradientTransform, etc.). Even if SVG tags were added, attributes like gradients would be stripped. The server config lists these attributes (lines 214-254) but frontend doesn't.

**Fix Applied:** Added FR-2.2 listing required SVG attributes and updated AC-2 to test gradient rendering.

### Gap 4: SVG Sanitizer Missing Animation Tags

**Severity:** High
**Location:** src/ui/web/exerciserenderer/utils/svgSanitize.ts

**Issue:** The svgSanitize function uses DOMPurify with `USE_PROFILES: { svg: true, svgFilters: true }` which is restrictive. SVG animation tags like `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`, `<mpath>` are not explicitly allowed. This prevents SVG animations from rendering.

**Fix Applied:** Added FR-2.3 specifically for SVG animation support and updated AC-2 to verify animations work.

### Gap 5: Admin Editor Configuration Mismatch

**Severity:** Medium
**Location:** src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx (line 38-92)

**Issue:** The admin editor (HtmlBlockEditor) also has restrictive sanitization that doesn't allow `<style>` or SVG tags. While the server validation allows them during save, the editor's preview won't show them correctly. This is separate from the rendering bug but contributes to the user experience issue.

**Fix Applied:** Added NR-1 (Non-functional requirement) about admin editor consistency with server validation.

### Gap 6: Incomplete Acceptance Criteria

**Severity:** Medium
**Location:** spec.md Acceptance Criteria section

**Issue:** The acceptance criteria don't specify:
- Exact tags/attributes that must be allowed
- Testing for CSS keyframes
- Testing for SVG gradients specifically
- Testing for SVG animations specifically

**Fix Applied:** Updated AC-1 and AC-2 with more specific test scenarios.

## Changes Made to Spec

### Added Requirements

- **FR-1.1**: Allow `<style>` tags in HTML sanitization
- **FR-1.2**: Support CSS animations via `@keyframes` within style tags
- **FR-2.1**: Allow SVG tags: svg, path, circle, rect, line, polyline, polygon, g, defs, linearGradient, radialGradient, stop, use, animate, animateTransform, animateMotion
- **FR-2.2**: Allow SVG attributes: viewBox, fill, stroke, d, cx, cy, r, x, y, width, height, gradientTransform, offset, stop-color, stop-opacity, gradientUnits, x1, x2, y1, y2, fx, fy, fr, spreadMethod, href, xlink:href, clip-rule, fill-rule, stroke-opacity
- **FR-2.3**: Allow SVG animation elements: animate, animateTransform, animateMotion, set, mpath

### Added Non-Functional Requirements

- **NR-1**: Admin editor preview should match server validation rules for consistent UX

### Updated Acceptance Criteria

- **AC-1**: Added specific tests for:
  - Internal CSS in `<style>` tags
  - CSS animations with `@keyframes`
  - Layout and positioning preservation
- **AC-2**: Added specific tests for:
  - Inline SVG with paths
  - SVG gradients (linear and radial)
  - SVG animations (<animate> tags)
- Added new **AC-4**: Verify admin editor preview matches rendered output
