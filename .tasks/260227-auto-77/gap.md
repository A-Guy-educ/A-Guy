# Gap Analysis: 260227-auto-77

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: HTML Style Tag Not Allowed in Frontend (CRITICAL)

**Severity:** Critical
**Location:** 
- `src/ui/web/SafeHtml/index.tsx` (lines 7-45)
- `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` (lines 14-67)
- `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` (lines 39-92)

**Issue:** Server config (`src/server/payload/blocks/HtmlBlock/config.ts` line 161) explicitly allows `<style>` tag, but all frontend DOMPurify configs do NOT include `'style'` in `ALLOWED_TAGS`. This causes internal CSS to be completely stripped when rendering HTML content.

**Fix Applied:** 
- Added `'style'` to ALLOWED_TAGS in SafeHtml, HtmlBlockRenderer, and HtmlBlockEditor
- Updated spec AC-1 and added AC-4 to document required code changes

---

### Gap 2: ID Attribute Missing in Some Frontend Configs (MEDIUM)

**Severity:** Medium
**Location:** 
- `src/ui/web/SafeHtml/index.tsx` (lines 46-60)
- `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` (lines 53-67)

**Issue:** The `id` attribute is missing from `ALLOWED_ATTR` in SafeHtml and HtmlBlockRenderer, but is commonly used for CSS styling hooks and JavaScript interactions.

**Fix Applied:**
- Added `'id'` to ALLOWED_ATTR in spec requirements (AC-1)

---

### Gap 3: SVG Animation Elements Stripped (HIGH)

**Severity:** High
**Location:** `src/ui/web/exerciserenderer/utils/svgSanitize.ts` (lines 11-16)

**Issue:** Using `USE_PROFILES: { svg: true, svgFilters: true }` is too restrictive. It strips SMIL animation elements:
- `<animate>`
- `<animateTransform>`
- `<set>`
- `<mpath>`

**Fix Applied:**
- Updated spec AC-2 to specifically mention SMIL animations
- Added AC-4 documenting the need to add animation elements to svgSanitize

---

### Gap 4: Inline Style Attribute Blocked - CONFLICT (HIGH)

**Severity:** High
**Location:** `src/server/payload/blocks/HtmlBlock/config.ts` (lines 269-270)

**Issue:** The spec requirements (FR-1) mention "inline styles on HTML elements must be preserved", but the server config explicitly blocks `style` attribute for security reasons. This is an intentional security decision documented in the admin description: "No style=, target=, or on*= attributes allowed."

**Fix Applied:**
- Updated spec FR-1 and AC-1 to clarify that inline `style` attribute is intentionally blocked by server
- Focus the fix on `<style>` tags working properly instead of inline styles

---

### Gap 5: SVG Use Element Missing Attributes (MEDIUM)

**Severity:** Medium
**Location:** `src/ui/web/exerciserenderer/utils/svgSanitize.ts` (lines 11-16)

**Issue:** The `<use>` element needs additional attributes for referencing animated elements:
- `href` (modern SVG)
- `xlink:href` (legacy SVG)
- `requiredFeatures`

**Fix Applied:**
- Added AC-4 documenting the need to add href attributes to svgSanitize

---

## Changes Made to Spec

- **Updated AC-1 (HTML Rendering):** Added note about inline styles being intentionally blocked, added `id` attribute preservation requirement
- **Updated AC-2 (SVG Rendering):** Added explicit mention of SMIL animations, added `<use>` element requirements
- **Added AC-4 (Code Changes Required):** Documented exact changes needed for each file:
  - SafeHtml: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
  - HtmlBlockRenderer: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
  - HtmlBlockEditor: Add 'style' to ALLOWED_TAGS, add 'id' to ALLOWED_ATTR
  - svgSanitize: Add animation elements and href attributes
- **Updated Suspected Files:** Added `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx`
- **Added Gaps Section:** Documented all 5 gaps with severity, locations, and required fixes

---

## No Gaps Found

If no gaps are identified, write:

```markdown
# Gap Analysis: <task-id>

## Summary

- Gaps Found: 0
- Spec Revised: No

No gaps identified. The spec is complete and aligned with codebase patterns.
```
