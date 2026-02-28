# Bug Fix Plan: HTML & SVG Content Rendering

## Rerun Context
This is a rerun of the task. The previous plan was not executed. No new feedback was provided - the rerun request indicates the existing plan should proceed.

## Root Cause Summary
HTML `<style>` tags are stripped by frontend DOMPurify configs because they're not in ALLOWED_TAGS. SVG animations are stripped because USE_PROFILES.svg does not include SMIL animation elements.

---

## Step 1: Fix HTML Style Tag in SafeHtml Component

**Root Cause**: `SafeHtml/index.tsx` does not include `'style'` in ALLOWED_TAGS, causing internal CSS (`<style>` tags) to be stripped from HTML content.

**Files to Touch**:
- `src/ui/web/SafeHtml/index.tsx` (MODIFIED - lines 7-59)

**Reproduction Test**:
- Test location: `tests/unit/ui/SafeHtml.test.tsx` (NEW)
- Test: HTML with `<style>` tag should preserve the style block
- Test content: `<div id="test"><style>#test { color: red; }</style></div>`
- Why it fails: Currently returns `<div id="test"></div>` - style tag stripped

**Fix**:
```typescript
// Add to ALLOWED_TAGS array
'style',

// Add to ALLOWED_ATTR array  
'id',
```

**Verification**:
- Run reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS (style tag preserved)

---

## Step 2: Fix HTML Style Tag in HtmlBlockRenderer

**Root Cause**: `HtmlBlockRenderer/index.tsx` does not include `'style'` in ALLOWED_TAGS, causing internal CSS to be stripped when rendering HTML blocks in exercises.

**Files to Touch**:
- `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` (MODIFIED - lines 14-66)

**Reproduction Test**:
- Test location: `tests/unit/exerciserenderer/HtmlBlockRenderer.test.tsx` (NEW)
- Test: HTML block with `<style>` tag and keyframe animations should render
- Test content: `<style>@keyframes fade { from { opacity: 0; } } .fade { animation: fade 1s; }</style><div class="fade">Animated</div>`
- Why it fails: Style tag stripped, animations won't work

**Fix**:
```typescript
// Add to ALLOWED_TAGS array
'style',

// Add to ALLOWED_ATTR array
'id',
```

**Verification**:
- Run reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS

---

## Step 3: Fix HTML Style Tag in HtmlBlockEditor

**Root Cause**: `HtmlBlockEditor.tsx` does not include `'style'` in ALLOWED_TAGS, causing internal CSS to be stripped when sanitizing in the admin panel.

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` (MODIFIED - lines 38-92)

**Note**: This file already has `'id'` in ALLOWED_ATTR (line 84) - only need to add `'style'` tag.

**Reproduction Test**:
- Test location: `tests/unit/admin/HtmlBlockEditor.test.tsx` (NEW)
- Test: HTML with `<style>` tag should be preserved after sanitization
- Why it fails: Style tag stripped

**Fix**:
```typescript
// Add to ALLOWED_TAGS array
'style',
```

**Verification**:
- Run reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS

---

## Step 4: Fix SVG Animation Elements in svgSanitize

**Root Cause**: `svgSanitize.ts` uses `USE_PROFILES: { svg: true }` which strips SMIL animation elements (`<animate>`, `<animateTransform>`, `<set>`, `<mpath>`). Also missing attributes needed for `<use>` element references.

**Files to Touch**:
- `src/ui/web/exerciserenderer/utils/svgSanitize.ts` (MODIFIED - lines 8-16)

**Reproduction Test**:
- Test location: `tests/unit/exerciserenderer/svgSanitize.test.ts` (NEW)
- Test: SVG with `<animate>` element should preserve the animation
- Test content: `<svg><circle r="50"><animate attributeName="fill" from="red" to="blue" dur="1s"/></circle></svg>`
- Why it fails: animate element stripped

**Fix**:
Replace USE_PROFILES with custom ALLOWED_TAGS to include animation elements:

```typescript
export function sanitizeSvg(svgMarkup: string): string {
  if (!svgMarkup) return ''
  if (typeof window === 'undefined') return svgMarkup
  
  return DOMPurify.sanitize(svgMarkup, {
    ALLOWED_TAGS: [
      'svg', 'g', 'defs', 'desc', 'title', 'symbol', 'use',
      'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
      'text', 'tspan', 'textPath',
      'linearGradient', 'radialGradient', 'stop',
      'animate', 'animateTransform', 'set', 'mpath', // SMIL animations
      'style', // CSS animations within SVG
    ],
    ALLOWED_ATTR: [
      'viewBox', 'width', 'height', 'x', 'y', 'fill', 'stroke', 'stroke-width',
      'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry',
      'transform', 'gradientUnits', 'gradientTransform',
      'offset', 'stop-color', 'stop-opacity',
      'href', 'xlink:href', // For <use> element references
      'requiredFeatures', 'preserveAspectRatio',
      // Animation attributes
      'attributeName', 'from', 'to', 'dur', 'begin', 'end', 'repeatCount',
      'values', 'keyTimes', 'keySplines',
      'transformType', 'additive', 'accumulate',
      'data-hotspot-id', // Existing custom attribute
    ],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover'],
  })
}
```

**Verification**:
- Run reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS

---

## Acceptance Criteria Summary

After all fixes:
- [ ] HTML with `<style>` tags renders properly (SafeHtml)
- [ ] HTML blocks with internal CSS work in exercises (HtmlBlockRenderer)
- [ ] Admin editor preserves style tags (HtmlBlockEditor)
- [ ] SVG animations (SMIL) render correctly
- [ ] SVG `<use>` element references work with href attributes
- [ ] CSS keyframe animations in HTML work
- [ ] `id` attribute preserved for CSS styling hooks
