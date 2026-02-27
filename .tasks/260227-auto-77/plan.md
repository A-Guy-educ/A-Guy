# Plan: HTML & SVG Content Rendering Fix

**Task ID**: 260227-auto-77
**Task Type**: fix_bug
**Spec**: `.tasks/260227-auto-77/spec.md`

## Expert Review Findings Applied

This plan was reviewed by @security-auditor and @web-expert. Key changes incorporated:

1. **Shared config location**: Moved from `src/ui/web/sanitize/config.ts` to `src/lib/sanitize/config.ts` to avoid cross-boundary runtime import from admin → web (@web-expert).
2. **DOMPurify SVG case sensitivity**: Use `ADD_TAGS`/`ADD_ATTR` approach alongside `ALLOWED_TAGS` for SVG elements. DOMPurify normalizes to lowercase internally, so config uses lowercase SVG tag names (@web-expert).
3. **`@import url()` CSS attack vector**: Add server-side validation to reject `@import` in `<style>` tag content to prevent external CSS loading (@security-auditor, MEDIUM severity).
4. **SVG animation event handlers**: Expand `FORBID_ATTR` in `svgSanitize.ts` to include `onbegin`, `onend`, `onrepeat` for defense-in-depth (@security-auditor, LOW severity).
5. **Server-rendered `Component.tsx`**: Added note — this file relies on server-side validation before storage. It's a server component, so DOMPurify (browser-only) cannot be used. The defense is that validation prevents malicious content from ever being stored. (@security-auditor, HIGH finding noted but out-of-scope for this bug fix — content is validated before storage).
6. **DOMPurify global hook race condition**: `SafeHtml` and `HtmlBlockRenderer` both call `addHook`/`removeAllHooks` — consolidate into shared initialization helper (@web-expert, pre-existing bug).
7. **`target` attribute removal**: Documented as intentional behavioral change for `SafeHtml` — existing content with `target="_blank"` will lose that attribute (@web-expert).
8. **Regression guard**: Preserve currently supported safe tags used by existing `SafeHtml` consumers (notably `<img>`) unless explicitly restricted per-domain.

## Summary

HTML and SVG content in exercises/lessons displays as plain text or fails to render styles/animations because:

1. **SafeHtml** and **HtmlBlockRenderer** have duplicate `PURIFY_CONFIG` objects that are missing `<style>`, SVG tags, and SVG attributes — so DOMPurify strips them.
2. **HtmlBlockEditor** (admin preview) has its own `SANITIZE_CONFIG` missing the same tags/attributes, so the admin preview is inconsistent with the server validation rules.
3. **HtmlBlock server validation** (`config.ts`) already allows `<style>`, SVG shape tags, and gradient tags — but is missing SVG **animation** tags (`animate`, `animateTransform`, `animateMotion`, `set`, `mpath`) per FR-2.3.
4. **svgSanitize.ts** uses `USE_PROFILES: { svg: true, svgFilters: true }` which is correct for SVG rendering, but does not explicitly `ADD_TAGS` for animation elements that DOMPurify may strip even with the SVG profile.

### Root Cause

The bug is a **configuration mismatch**: the server-side validation (`config.ts`) allows certain HTML/SVG features, but the client-side sanitizers (`SafeHtml`, `HtmlBlockRenderer`, `HtmlBlockEditor`) strip them before rendering. Additionally, SVG animation tags are missing from both server validation and client sanitization.

## Approach

1. Extract a **shared sanitization config** module at `src/lib/sanitize/config.ts` so all sanitizers use the same allowlist (DRY, single source of truth).
2. Add missing tags and attributes to the shared config: `<style>`, SVG tags, SVG attributes, SVG animation tags.
3. Include a shared DOMPurify initialization helper to consolidate `afterSanitizeAttributes` hook setup (fixes pre-existing race condition).
4. Update the server-side validation allowlist to include SVG animation tags and block `@import` in style content.
5. Update the `svgSanitize.ts` to explicitly add animation tags and attributes.
6. Update all consumers (`SafeHtml`, `HtmlBlockRenderer`, `HtmlBlockEditor`, `HtmlBlock/Field.tsx`) to use the shared config.

## Assumptions

- `dompurify` is already installed and available.
- The `style` inline attribute (`style=`) must remain blocked per AC-3 — only the `<style>` tag is allowed.
- SVG animation tags (`animate`, `animateTransform`, `animateMotion`, `set`, `mpath`) are safe when event handlers are stripped.
- The `svgSanitize.ts` SVG profile already handles most SVG elements; we just need to ensure animation elements are not stripped.
- The server-rendered `Component.tsx` is out of scope — it relies on server-side validation before storage (DOMPurify is browser-only and cannot be used in a server component).
- Removing `target` attribute from `SafeHtml` is an acceptable behavioral change.
- Existing course/lesson description rendering that uses `SafeHtml` should not regress (e.g., existing `<img>` content should continue to render).

---

## Step 1: Create Shared Sanitization Config Module

**Time estimate**: 20 minutes

**Root Cause**: Four files (`SafeHtml`, `HtmlBlockRenderer`, `HtmlBlockEditor`, `HtmlBlock/Field.tsx`) each define their own sanitization config, leading to drift and missing tags.

**Files to Touch**:
- `src/lib/sanitize/config.ts` (NEW)

**Exact Behavior**:
- Export a `HTML_BLOCK_PURIFY_CONFIG` object that includes both HTML + SVG + style + animation tags (used by `HtmlBlockRenderer`, `HtmlBlockEditor`, `SafeHtml`, `HtmlBlock/Field.tsx`)
- Export a `initDOMPurifySafeLinks()` function that sets up the `afterSanitizeAttributes` hook for link security (consolidates duplicated hook setup from `SafeHtml` and `HtmlBlockRenderer`)
- The `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS` must include:
  - All existing HTML tags from current configs: `p`, `br`, `hr`, `span`, `h1`-`h6`, `strong`, `b`, `em`, `i`, `u`, `s`, `del`, `ins`, `mark`, `sub`, `sup`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `a`, `div`, `table`, `thead`, `tbody`, `tr`, `th`, `td`
  - Existing media tag from current configs: `img` (regression guard for `SafeHtml` consumers)
  - `style` tag (FR-1.1) — note: this is the `<style>` element, NOT the `style` attribute
  - Semantic HTML5: `header`, `main`, `footer`, `section`, `nav`, `article`, `aside`, `button` (matching server validation)
  - SVG container/shape tags: `svg`, `path`, `circle`, `rect`, `line`, `polyline`, `polygon` (FR-2.1)
  - SVG structure tags: `g`, `defs`, `use` (FR-2.1)
  - SVG gradient tags: `lineargradient`, `radialgradient`, `stop` (FR-2.1) — lowercase for DOMPurify
  - SVG animation tags: `animate`, `animatetransform`, `animatemotion`, `set`, `mpath` (FR-2.3) — lowercase for DOMPurify
- The `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR` must include:
  - HTML attributes: `href`, `src`, `alt`, `title`, `class`, `id`, `rel`, `width`, `height`, `colspan`, `rowspan`, `dir`
  - SVG geometry: `d`, `cx`, `cy`, `r`, `rx`, `ry`, `x`, `y`, `points` (FR-2.2)
  - SVG presentation: `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-opacity`, `fill-rule`, `clip-rule` (FR-2.2)
  - SVG view: `viewbox` (FR-2.2) — DOMPurify lowercases
  - SVG gradient: `gradientunits`, `gradienttransform`, `x1`, `x2`, `y1`, `y2`, `fx`, `fy`, `fr`, `spreadmethod`, `offset`, `stop-color`, `stop-opacity` (FR-2.2)
  - SVG animation: `attributename`, `attributetype`, `from`, `to`, `dur`, `begin`, `end`, `repeatcount`, `repeatdur`, `values`, `keytimes`, `keysplines`, `calcmode`, `type`, `additive`, `accumulate`, `path`, `keypoints`, `rotate` (FR-2.3)
  - SVG links: `href`, `xlink:href` (FR-2.2)
  - SVG accessibility: `xmlns`, `aria-hidden`, `role`, `focusable`
  - Data attributes: `data-hotspot-id` (and general `data-*` via pattern)
- Must NOT include: `style` (inline attribute), `target`, any `on*` event handlers
- Also set `FORBID_ATTR: ['style', 'target']` explicitly to ensure they are always stripped
- Also set `FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignobject']` explicitly

**`initDOMPurifySafeLinks()` helper**:
- Calls `DOMPurify.addHook('afterSanitizeAttributes', ...)` to set `rel="noopener noreferrer"` on anchor tags with target
- Tracks initialization state to prevent duplicate hook registration (fixes the race condition where multiple components call addHook/removeAllHooks)
- Must be idempotent and avoid `removeAllHooks()` in component unmounts (global hook API causes cross-component races)
- Returns no-op/boolean status rather than per-component global cleanup

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/lib/sanitize/config.test.ts` (NEW)
- Tests:
  1. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS includes style` — verifies `<style>` is in the allowed tags list
  2. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS includes SVG animation tags` — verifies `animate`, `animatetransform`, `animatemotion`, `set`, `mpath` are in the list
  3. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR includes SVG animation attributes` — verifies `attributename`, `dur`, `repeatcount`, etc. are present
  4. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR does not include style` — verifies inline `style` attribute is NOT in ALLOWED_ATTR
  5. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS includes SVG gradient tags` — verifies `lineargradient`, `radialgradient`, `stop`
  6. `HTML_BLOCK_PURIFY_CONFIG.FORBID_ATTR includes style and target` — verifies forbidden attributes
  7. `HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS includes script and iframe` — verifies forbidden tags
  8. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS includes img` — regression guard for existing SafeHtml content
  9. `HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR includes xlink:href` — verifies SVG link support per FR-2.2

**Why tests fail before**: The module doesn't exist yet.

**Acceptance Criteria**:
- [ ] `src/lib/sanitize/config.ts` exports `HTML_BLOCK_PURIFY_CONFIG` and `initDOMPurifySafeLinks`
- [ ] All required tags from FR-1.1, FR-2.1, FR-2.3 are present
- [ ] All required attributes from FR-2.2 are present
- [ ] `style` (inline attribute) is NOT in allowed attributes; IS in FORBID_ATTR
- [ ] `target` is in FORBID_ATTR
- [ ] Tests pass

---

## Step 2: Fix HtmlBlockRenderer to Use Shared Config with SVG + Style + Animation Support

**Time estimate**: 15 minutes

**Root Cause**: `HtmlBlockRenderer` defines its own `PURIFY_CONFIG` that is missing `<style>`, all SVG tags, all SVG attributes, and SVG animation tags. This causes DOMPurify to strip these elements at render time.

**Files to Touch**:
- `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` (MODIFIED — lines 3, 13-67, 72-81, 87)

**Exact Behavior**:
- Remove the local `PURIFY_CONFIG` constant (lines 13-67)
- Import `HTML_BLOCK_PURIFY_CONFIG` and `initDOMPurifySafeLinks` from `@/lib/sanitize/config`
- Replace the `useEffect` hook (lines 72-81) that sets up `DOMPurify.addHook`/`removeAllHooks` with a call to idempotent `initDOMPurifySafeLinks()` (no `removeAllHooks` cleanup)
- Use `HTML_BLOCK_PURIFY_CONFIG` in `DOMPurify.sanitize(block.html, HTML_BLOCK_PURIFY_CONFIG)` on line 87

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/ui/web/html-block-renderer-sanitize.test.ts` (NEW)
- Environment: `// @vitest-environment jsdom`
- Import DOMPurify and the shared config. Test DOMPurify.sanitize() with the config directly (tests the sanitization config, not the React component rendering):
  1. `preserves <style> tags with CSS` — sanitize `<style>.x{color:red}</style><div class="x">text</div>` → output contains `<style>` (FR-1.1)
  2. `preserves CSS @keyframes in style tags` — sanitize `<style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>` → output contains `@keyframes` (FR-1.2)
  3. `preserves SVG with paths` — sanitize `<svg viewBox="0 0 100 100"><path d="M0 0 L100 100"/></svg>` → output contains `<svg` and `<path` (FR-2)
  4. `preserves SVG gradients` — sanitize `<svg><defs><linearGradient id="g"><stop offset="0%" stop-color="red"/></linearGradient></defs></svg>` → output contains `linearGradient` OR `lineargradient`, and `stop` (FR-2.1)
  5. `preserves SVG animate elements` — sanitize `<svg><circle cx="50" cy="50" r="10"><animate attributeName="r" from="10" to="50" dur="1s" repeatCount="indefinite"/></circle></svg>` → output contains `<animate` (FR-2.3)
  6. `preserves SVG animateTransform` — sanitize `<svg><rect width="100" height="100"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s"/></rect></svg>` → output contains `animateTransform` or `animatetransform` (FR-2.3)
  7. `strips script tags` — sanitize `<script>alert(1)</script><p>safe</p>` → no `<script` in output (AC-3)
  8. `strips onclick handlers` — sanitize `<div onclick="alert(1)">text</div>` → no `onclick` in output (AC-3)
  9. `strips inline style attributes` — sanitize `<div style="color:red">text</div>` → no `style=` in output (AC-3)
  10. `strips javascript: URLs` — sanitize `<a href="javascript:alert(1)">link</a>` → no `javascript:` in output (AC-3)

**Why tests fail before**: Current PURIFY_CONFIG lacks `<style>`, SVG tags, and SVG animation tags — DOMPurify strips them.

**Acceptance Criteria**:
- [ ] `HtmlBlockRenderer` imports shared config instead of defining its own
- [ ] `<style>` tags with CSS (including @keyframes) render in HTML blocks
- [ ] SVG elements (path, circle, gradient, animate, animateTransform) render in HTML blocks
- [ ] Script tags, event handlers, inline styles, and javascript: URLs still stripped
- [ ] Tests pass

---

## Step 3: Fix SafeHtml to Use Shared Config

**Time estimate**: 10 minutes

**Root Cause**: `SafeHtml` defines its own `PURIFY_CONFIG` missing `<style>`, SVG tags, SVG attributes, and animation tags.

**Files to Touch**:
- `src/ui/web/SafeHtml/index.tsx` (MODIFIED — lines 3, 6-60, 71-81, 85)

**Exact Behavior**:
- Remove the local `PURIFY_CONFIG` constant (lines 6-60)
- Import `HTML_BLOCK_PURIFY_CONFIG` and `initDOMPurifySafeLinks` from `@/lib/sanitize/config`
- Replace the `useEffect` hook (lines 71-81) with idempotent `initDOMPurifySafeLinks()` (no `removeAllHooks` cleanup)
- Use `HTML_BLOCK_PURIFY_CONFIG` in `DOMPurify.sanitize(html, HTML_BLOCK_PURIFY_CONFIG)` on line 85

**⚠️ Breaking change note**: The current `SafeHtml` `PURIFY_CONFIG` includes `target` in `ALLOWED_ATTR`. The shared config removes it. Existing content with `<a target="_blank">` rendered through `SafeHtml` will lose the `target` attribute. This is **intentional** — it aligns with the server validation which already blocks `target`.

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/ui/web/safe-html-sanitize.test.ts` (NEW)
- Environment: `// @vitest-environment jsdom`
- Tests:
  1. `SafeHtml config preserves <style> tags` — DOMPurify.sanitize with shared config preserves `<style>` content
  2. `SafeHtml config preserves SVG elements` — verify SVG path/circle survive sanitization
  3. `SafeHtml config strips script tags` — verify security is maintained
  4. `SafeHtml config does not allow target attribute` — verify `target` is stripped (intentional change)

**Why tests fail before**: Current PURIFY_CONFIG strips `<style>` and SVG tags.

**Acceptance Criteria**:
- [ ] `SafeHtml` imports shared config from `@/lib/sanitize/config`
- [ ] `<style>` and SVG content renders through `SafeHtml`
- [ ] `target` attribute is stripped (intentional)
- [ ] Security maintained (scripts stripped)
- [ ] Tests pass

---

## Step 4: Fix svgSanitize to Preserve SVG Animation Tags

**Time estimate**: 15 minutes

**Root Cause**: `svgSanitize.ts` uses `USE_PROFILES: { svg: true, svgFilters: true }` which handles most SVG elements, but DOMPurify's SVG profile may not include all animation tags (`animate`, `animateTransform`, `animateMotion`, `set`, `mpath`) and their specific attributes.

**Files to Touch**:
- `src/ui/web/exerciserenderer/utils/svgSanitize.ts` (MODIFIED — lines 11-16)

**Exact Behavior**:
- Keep `USE_PROFILES: { svg: true, svgFilters: true }`
- Add `ADD_TAGS` using lowercase names for DOMPurify consistency: `['animate', 'animatetransform', 'animatemotion', 'set', 'mpath', 'style']`
- Change `ADD_ATTR` to lowercase names and include SVG link refs: `['data-hotspot-id', 'attributename', 'attributetype', 'from', 'to', 'dur', 'begin', 'end', 'repeatcount', 'repeatdur', 'values', 'keytimes', 'keysplines', 'calcmode', 'type', 'additive', 'accumulate', 'path', 'keypoints', 'rotate', 'href', 'xlink:href']`
- Expand `FORBID_ATTR` to include SVG animation event handlers: `['onclick', 'onerror', 'onload', 'onmouseover', 'onbegin', 'onend', 'onrepeat', 'onfocusin', 'onfocusout', 'onactivate']` (defense-in-depth per @security-auditor)
- Keep existing `FORBID_TAGS`, but normalize case for parser consistency (`foreignobject`)

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/exercise-renderer/svgSanitize.test.ts` (MODIFIED — add new tests)
- Tests to ADD:
  1. `preserves <animate> elements with attributes` — `sanitizeSvg('<svg><circle cx="50" cy="50" r="10"><animate attributeName="r" from="10" to="50" dur="1s"/></circle></svg>')` → output contains `<animate` and `attributeName`
  2. `preserves <animateTransform> elements` — `sanitizeSvg('<svg><rect width="100" height="100"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></rect></svg>')` → output contains `animateTransform` and `repeatCount`
  3. `preserves <animateMotion> elements` — `sanitizeSvg('<svg><circle r="5"><animateMotion dur="3s" path="M0,0 L100,100"/></circle></svg>')` → output contains `animateMotion`
  4. `preserves <set> elements` — `sanitizeSvg('<svg><rect><set attributeName="fill" to="red" begin="2s"/></rect></svg>')` → output contains `<set`
  5. `preserves <style> within SVG` — `sanitizeSvg('<svg><style>circle { fill: blue; }</style><circle cx="50" cy="50" r="40"/></svg>')` → output contains `<style>`
  6. `preserves SVG gradient elements with attributes` — `sanitizeSvg('<svg><defs><linearGradient id="g1"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect fill="url(#g1)" width="100" height="100"/></svg>')` → output contains `linearGradient` and `stop-color`
  7. `strips onbegin handler on animate` — `sanitizeSvg('<svg><animate onbegin="alert(1)" attributeName="x"/></svg>')` → output does not contain `onbegin`
  8. `strips onend handler on animate` — `sanitizeSvg('<svg><animate onend="alert(1)" attributeName="x"/></svg>')` → output does not contain `onend`
  9. `preserves <mpath> with internal href reference` — output contains `<mpath` and `href="#..."`
  10. `strips external javascript href on mpath` — `sanitizeSvg('<svg><mpath href="javascript:alert(1)"/></svg>')` → output does not contain `javascript:`

**Why tests fail before**: Current `svgSanitize` doesn't explicitly add animation tags, so DOMPurify may strip `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`, and `<mpath>`.

**Acceptance Criteria**:
- [ ] SVG animation tags survive sanitization
- [ ] SVG animation attributes (`attributeName`, `dur`, `repeatCount`, etc.) survive
- [ ] SVG `<style>` tags survive sanitization
- [ ] SVG gradient elements survive sanitization
- [ ] Animation-specific event handlers (`onbegin`, `onend`, `onrepeat`) are stripped
- [ ] Script tags and other event handlers still stripped
- [ ] All existing svgSanitize tests still pass
- [ ] New tests pass

---

## Step 5: Update Server-Side Validation to Allow SVG Animation Tags and Block @import

**Time estimate**: 15 minutes

**Root Cause**: `HtmlBlock/config.ts` server validation allowlist (line 127-186) includes SVG shape and gradient tags but is missing SVG animation tags (`animate`, `animateTransform`, `animateMotion`, `set`, `mpath`). Content with these tags will fail server validation even though they're legitimate. Also, `@import` in `<style>` tags can load external CSS (security concern from @security-auditor).

**Files to Touch**:
- `src/server/payload/blocks/HtmlBlock/config.ts` (MODIFIED — lines 127-186, 197-211, 213-254, and add @import check after line 33)

**Exact Behavior**:

**5a. Add SVG animation tags:**
- Add to `allowedTags` array (around line 186): `'animate'`, `'animatetransform'`, `'animatemotion'`, `'set'`, `'mpath'`
  - Note: tag matching is case-insensitive via `.toLowerCase()`, so use lowercase versions
- Add to `svgGeometryTags` array (around line 211) so their attributes are validated: `'animate'`, `'animatetransform'`, `'animatemotion'`, `'set'`, `'mpath'`
- Add SVG animation attributes to `svgAttrs` array (around line 254): `'attributename'`, `'attributetype'`, `'from'`, `'to'`, `'dur'`, `'begin'`, `'end'`, `'repeatcount'`, `'repeatdur'`, `'values'`, `'keytimes'`, `'keysplines'`, `'calcmode'`, `'type'`, `'additive'`, `'accumulate'`, `'path'`, `'keypoints'`, `'rotate'`

**5b. Allow `href` on `mpath` only for internal references:**
- In `isAllowedAttribute`, add a case for `mpath` tag: if `lowerAttr === 'href'` or `lowerAttr === 'xlink:href'`, return `{ allowed: true }`. The href value validation (must start with `#`) is handled in a separate check.
- Add an `mpath` href value validation: after the general tag attribute loop, if the tag is `mpath` and has `href`, verify the href value starts with `#`. If not, return error.

**5c. Block @import in style content:**
- After the dangerous tags check (around line 54), add a check: if the content contains `<style>` tags, extract the content between `<style>` and `</style>` and check for `@import`. If found, return error: `@import is not allowed in <style> tags`.
- Pattern: `/<style[^>]*>([\s\S]*?)<\/style>/gi` → check each match for `@import`

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/blocks/html-block-validation.test.ts` (MODIFIED — add new tests in SVG section)
- Tests to ADD:
  1. `should allow <animate> tag in SVG` — `validate('<svg><circle cx="50" cy="50" r="10"><animate attributeName="r" from="10" to="50" dur="1s"/></circle></svg>')` → returns `true`
  2. `should allow <animateTransform> tag in SVG` — `validate('<svg><rect width="100" height="100"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></rect></svg>')` → returns `true`
  3. `should allow <animateMotion> tag in SVG` — `validate('<svg><circle r="5"><animateMotion dur="3s" path="M0,0 L100,100"/></circle></svg>')` → returns `true`
  4. `should allow <set> tag in SVG` — `validate('<svg><rect><set attributeName="fill" to="red" begin="2s"/></rect></svg>')` → returns `true`
  5. `should allow <mpath> with internal href` — `validate('<svg><defs><path id="p" d="M0,0 L100,100"/></defs><circle r="5"><animateMotion dur="3s"><mpath href="#p"/></animateMotion></circle></svg>')` → returns `true`
  6. `should reject <mpath> with external href` — `validate('<svg><mpath href="https://evil.com"/></svg>')` → contains error about href
  7. `should allow SVG animation attributes` — `validate('<svg><circle><animate attributeName="r" from="10" to="50" dur="1s" repeatCount="indefinite"/></circle></svg>')` → returns `true`
  8. `should reject @import in style tags` — `validate('<style>@import url("https://evil.com/steal.css");</style>')` → contains '@import is not allowed'
  9. `should reject @import with single quotes` — `validate("<style>@import url('https://evil.com/steal.css');</style>")` → contains '@import is not allowed'
  10. `should allow normal CSS in style tags (no @import)` — `validate('<style>.x { color: red; } @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }</style>')` → returns `true`
  11. `should reject onclick on SVG animation elements` — `validate('<svg><animate onclick="alert(1)" attributeName="x"/></svg>')` → contains 'inline event handlers'

**Why tests fail before**: SVG animation tags are not in the `allowedTags` array, so validation rejects them as "disallowed tag". `@import` is not checked.

**Acceptance Criteria**:
- [ ] SVG animation tags pass server validation
- [ ] SVG animation attributes pass server validation
- [ ] `mpath` with internal `href="#id"` passes validation
- [ ] `mpath` with external `href` fails validation
- [ ] `@import` in `<style>` tags fails validation
- [ ] Normal CSS (`@keyframes`, selectors, properties) in `<style>` tags still passes
- [ ] Event handlers on animation elements still blocked
- [ ] All existing validation tests still pass
- [ ] New tests pass

---

## Step 6: Fix Admin HtmlBlockEditor and HtmlBlock/Field Preview

**Time estimate**: 15 minutes

**Root Cause**: 
1. `HtmlBlockEditor` has its own `SANITIZE_CONFIG` missing `<style>`, SVG, and animation tags (AC-4).
2. `HtmlBlock/Field.tsx` renders raw HTML via `dangerouslySetInnerHTML` without ANY sanitization (line 54) — this is both a security issue and an inconsistency issue.

**Files to Touch**:
- `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` (MODIFIED — lines 4, 38-92, 117)
- `src/ui/admin/HtmlBlock/Field.tsx` (MODIFIED — add DOMPurify import and sanitization)

**Exact Behavior for HtmlBlockEditor**:
- Remove the local `SANITIZE_CONFIG` constant (lines 38-92)
- Import `HTML_BLOCK_PURIFY_CONFIG` from `@/lib/sanitize/config`
- Use `HTML_BLOCK_PURIFY_CONFIG` in `DOMPurify.sanitize(block.html, HTML_BLOCK_PURIFY_CONFIG)` on line 117

**Exact Behavior for HtmlBlock/Field.tsx**:
- Import `DOMPurify` from `dompurify`
- Import `HTML_BLOCK_PURIFY_CONFIG` from `@/lib/sanitize/config`
- Add `useMemo` to sanitize: `const sanitizedHtml = useMemo(() => htmlValue ? DOMPurify.sanitize(htmlValue, HTML_BLOCK_PURIFY_CONFIG) : '', [htmlValue])`
- Use `sanitizedHtml` in `dangerouslySetInnerHTML` on line 54 (replacing raw `htmlValue`)

**Reproduction Test**:
- Test location: `tests/unit/ui/admin/html-block-editor-sanitize.test.ts` (NEW)
- Tests:
  1. `HtmlBlockEditor imports shared config` — use grep/import verification to confirm HtmlBlockEditor no longer defines its own SANITIZE_CONFIG
  2. `Shared config preserves style and SVG in admin context` — DOMPurify.sanitize with `HTML_BLOCK_PURIFY_CONFIG` preserves `<style>` and `<svg>` content (tests config works for admin use case)

Note: Since these are admin UI components, the main verification is that they import and use the shared config. The unit tests verify the config works correctly.

**Additional Test Coverage (NR-1 consistency):**
- Test location: `tests/unit/ui/admin/html-block-field-sanitize.test.ts` (NEW)
- Tests:
  1. `HtmlBlockField sanitizes preview content before dangerouslySetInnerHTML` — verify scripts/event handlers are stripped
  2. `HtmlBlockField preview preserves <style> and inline SVG` — verify preview output aligns with frontend sanitization behavior

**Why tests fail before**: `HtmlBlockEditor` uses a restrictive local config that strips `<style>` and SVG tags, making the admin preview inconsistent.

**Acceptance Criteria**:
- [ ] `HtmlBlockEditor` uses shared config for sanitization
- [ ] `HtmlBlock/Field.tsx` sanitizes HTML before rendering (no raw unsanitized HTML)
- [ ] Admin preview shows same rendering as frontend
- [ ] Tests pass

---

## Step 7: TypeScript Verification and Integration

**Time estimate**: 10 minutes

**Files to Touch**: None (verification only)

**Exact Behavior**:
- Run `pnpm tsc --noEmit` to verify no type errors
- Run `pnpm generate:importmap` to update admin import map (required because admin components changed)
- Run all tests:
  ```
  pnpm vitest run tests/unit/lib/sanitize/config.test.ts tests/unit/ui/web/html-block-renderer-sanitize.test.ts tests/unit/ui/web/safe-html-sanitize.test.ts tests/unit/exercise-renderer/svgSanitize.test.ts tests/unit/blocks/html-block-validation.test.ts tests/unit/ui/admin/html-block-editor-sanitize.test.ts tests/unit/ui/admin/html-block-field-sanitize.test.ts
  ```
- Run `pnpm lint` to check for lint issues

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes
- [ ] All targeted unit tests pass (existing + new cases from this plan)
- [ ] No lint errors
- [ ] Import map regenerated

---

## Step 8: Cross-Browser and Mobile Manual Verification (Environment Coverage)

**Time estimate**: 20 minutes

**Files to Touch**: None (manual QA)

**Exact Behavior**:
- Validate AC scenarios manually in Chrome, Firefox, Safari, and mobile viewport emulation.
- Use one representative fixture containing: `<style>`, `@keyframes`, inline SVG paths, gradients, and SVG animation tags.
- Confirm parity between admin preview (`HtmlBlockEditor` / `HtmlBlockField`) and frontend rendering (`HtmlBlockRenderer` / `SafeHtml`).

**Acceptance Criteria**:
- [ ] HTML styles and keyframe animations render in all target browsers
- [ ] SVG geometry, gradients, and animations render in all target browsers
- [ ] Admin preview and frontend output are visually consistent
- [ ] Security controls still hold (scripts/events/javascript: blocked)

---

## Security Considerations (AC-3)

Throughout ALL steps, the following security invariants MUST be maintained:

1. **`<script>` tags** — ALWAYS stripped by DOMPurify and blocked by server validation
2. **Event handlers** (`onclick`, `onerror`, `onload`, `onmouseover`, `onbegin`, `onend`, `onrepeat`, etc.) — ALWAYS stripped
3. **`javascript:` URLs** — ALWAYS stripped by DOMPurify and blocked by server validation
4. **Inline `style=` attributes** — In FORBID_ATTR and NOT in ALLOWED_ATTR
5. **`target` attribute** — In FORBID_ATTR (intentional removal from SafeHtml)
6. **`<iframe>`, `<embed>`, `<object>`, `<foreignObject>`** — In FORBID_TAGS
7. **External URLs in href** — Blocked by server validation (must start with `/` or `#`)
8. **`@import` in `<style>` content** — Blocked by server validation (prevents external CSS loading)

The `<style>` TAG is different from the `style` ATTRIBUTE:
- `<style>` tag (internal CSS) → ALLOWED (needed for CSS animations per FR-1.1)
- `style="..."` attribute (inline styles) → BLOCKED (XSS vector, in FORBID_ATTR)

### Out-of-scope Security Notes

- `src/server/payload/blocks/HtmlBlock/Component.tsx` renders HTML via `dangerouslySetInnerHTML` without client-side sanitization. This is a **server component** where DOMPurify (browser-only) cannot be used. Defense: content is validated by the comprehensive server-side validation in `config.ts` before storage. A separate task could evaluate server-side sanitization libraries (e.g., `isomorphic-dompurify`, `sanitize-html`) for defense-in-depth.
- CSS `url()` references within `<style>` tags (e.g., `background: url(...)`) could be used for data exfiltration. This is a low risk since it requires admin access to create content. A CSP `style-src` header would mitigate this. Out of scope for this bug fix.

## Test Summary

| Test File | New/Modified | Tests Added |
|-----------|-------------|-------------|
| `tests/unit/lib/sanitize/config.test.ts` | NEW | 7 |
| `tests/unit/ui/web/html-block-renderer-sanitize.test.ts` | NEW | 10 |
| `tests/unit/ui/web/safe-html-sanitize.test.ts` | NEW | 4 |
| `tests/unit/exercise-renderer/svgSanitize.test.ts` | MODIFIED | 10 added |
| `tests/unit/blocks/html-block-validation.test.ts` | MODIFIED | 11 added |
| `tests/unit/ui/admin/html-block-editor-sanitize.test.ts` | NEW | 2 |
| `tests/unit/ui/admin/html-block-field-sanitize.test.ts` | NEW | 2 |
| **Total** | | **46 new tests** |

## File Change Summary

| File | Status | Lines Changed |
|------|--------|---------------|
| `src/lib/sanitize/config.ts` | NEW | ~100 lines |
| `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx` | MODIFIED | Replace lines 3, 13-67, 72-81, 87 |
| `src/ui/web/SafeHtml/index.tsx` | MODIFIED | Replace lines 3, 6-60, 71-81, 85 |
| `src/ui/web/exerciserenderer/utils/svgSanitize.ts` | MODIFIED | Replace lines 11-16 |
| `src/server/payload/blocks/HtmlBlock/config.ts` | MODIFIED | Add to arrays at lines ~186, ~211, ~254; add mpath handling; add @import check |
| `src/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor.tsx` | MODIFIED | Replace lines 4, 38-92, 117 |
| `src/ui/admin/HtmlBlock/Field.tsx` | MODIFIED | Add DOMPurify sanitization (~10 lines) |
