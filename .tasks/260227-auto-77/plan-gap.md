# Plan Gap Analysis: 260227-auto-77

## Summary

- Gaps Found: 7
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Missing FR-2.2 `xlink:href` coverage in shared config

**Severity:** High  
**Issue:** The plan’s shared DOMPurify allowlist included `href` but did not explicitly include `xlink:href`, which is required by FR-2.2 for SVG link/reference support.  
**Fix Applied:** Updated Step 1 to require `xlink:href` in `ALLOWED_ATTR` and added a dedicated test assertion.

### Gap 2: Regression risk for existing `SafeHtml` image content

**Severity:** High  
**Issue:** The plan’s consolidated tag list omitted `img`, despite current `SafeHtml` usage and existing sanitizer behavior allowing it. This could break existing course/lesson description rendering.  
**Fix Applied:** Added `img` to shared allowlist requirements and added regression-test coverage in Step 1.

### Gap 3: Hook-race fix was incomplete (`removeAllHooks` cleanup pattern)

**Severity:** High  
**Issue:** The plan still described per-component cleanup semantics, which can reintroduce global hook race conditions when using DOMPurify hooks across multiple components.  
**Fix Applied:** Revised Steps 1–3 to require idempotent one-time hook init and explicitly avoid `removeAllHooks()` in component unmount paths.

### Gap 4: SVG tag/attribute case mismatch in `svgSanitize` plan

**Severity:** Medium  
**Issue:** Step 4 mixed camelCase (`animateTransform`, `attributeName`, etc.) despite prior note that DOMPurify normalization relies on lowercase consistency.  
**Fix Applied:** Updated Step 4 to use lowercase `ADD_TAGS`/`ADD_ATTR` entries and normalized `foreignobject` casing guidance.

### Gap 5: Incomplete SVG motion-path coverage in sanitizer tests

**Severity:** Medium  
**Issue:** Step 4 did not include tests for `mpath` href preservation and malicious href stripping, leaving FR-2.3 and AC-3 validation incomplete for motion path references.  
**Fix Applied:** Added Step 4 tests for internal `mpath` href preservation and `javascript:` stripping.

### Gap 6: Admin-preview consistency tests did not validate `HtmlBlockField`

**Severity:** Medium  
**Issue:** Plan focused on `HtmlBlockEditor` config usage but lacked explicit test coverage for `HtmlBlock/Field.tsx` sanitization behavior, which is part of admin preview consistency and security.  
**Fix Applied:** Added a new test file (`tests/unit/ui/admin/html-block-field-sanitize.test.ts`) and two targeted tests.

### Gap 7: Spec environment coverage (browser/device matrix) missing from execution plan

**Severity:** Medium  
**Issue:** Spec requires validation across Chrome/Safari/Firefox and desktop/mobile, but the plan lacked an explicit manual verification step.  
**Fix Applied:** Added Step 8 with cross-browser + mobile QA and parity checks between admin preview and frontend rendering.

## Changes Made to Plan

- Added expert finding + assumption to protect existing `SafeHtml` behavior (`img` regression guard).
- Updated Step 1 allowlists to include `img` and `xlink:href`.
- Updated Step 1 hook helper requirements to be idempotent and avoid `removeAllHooks()` cleanup races.
- Updated Step 1 tests to include `img` and `xlink:href` checks.
- Updated Step 2 and Step 3 implementation instructions to use idempotent hook init without global cleanup.
- Updated Step 4 sanitizer config details to lowercase DOMPurify-compatible names and include `href`/`xlink:href`.
- Expanded Step 4 tests with `mpath` internal-ref and malicious-ref cases.
- Added Step 6 admin field-level sanitization test coverage.
- Added Step 8 manual cross-browser/mobile verification aligned to spec environment.
- Updated verification command list to include the new admin field test.
- Corrected summary consistency in test-count rows and verification wording.
