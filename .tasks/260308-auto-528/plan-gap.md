# Plan Gap Analysis: 260308-auto-528

## Summary

- Gaps Found: 8
- Plan Revised: Yes

## Gaps Identified

### Gap 1: RichText rendering contradicted spec LaTeX requirement

**Severity:** Critical  
**Issue:** The plan proposed rendering formula-sheet richText with Payload `RichText`, while spec explicitly requires MathMarkdown-based rendering for LaTeX clarity.  
**Fix Applied:** Updated Step 4 to render richText via `MathMarkdown` using a dedicated lexical extraction helper.

### Gap 2: Locale fallback behavior was too broad

**Severity:** High  
**Issue:** The plan described bidirectional fallback (`he↔en`), but spec requires `he → en → hide` only.  
**Fix Applied:** Updated Step 3 locale rules and tests to enforce one-way fallback only.

### Gap 3: Public visibility vs admin-only collection access was unresolved

**Severity:** Critical  
**Issue:** FormulaSheets are admin-only, but students must see linked sheets in published lessons. The plan lacked secure privileged-read design constraints.  
**Fix Applied:** Added secure resolver/API design: published-lesson gating via `overrideAccess: false`, privileged formula-sheet read via `overrideAccess: true`, and whitelisted DTO response.

### Gap 4: Missing governance validation for naming convention

**Severity:** Medium  
**Issue:** Spec requires naming pattern `[Course Code] - [Topic] - [Version]`, but plan had no enforcement mechanism.  
**Fix Applied:** Added Step 1 validation hook + integration test for invalid naming.

### Gap 5: Missing 5MB PDF constraint enforcement

**Severity:** High  
**Issue:** Spec limits sheet PDFs to 5MB, but existing media limits are broader and plan had no formula-sheet-specific validation.  
**Fix Applied:** Added Step 1 validation for linked PDF type/size and dedicated tests.

### Gap 6: Edge cases incomplete (empty richText / missing PDF)

**Severity:** High  
**Issue:** Plan did not fully encode spec edge behavior for empty richText (hide button) and broken PDF (show load error).  
**Fix Applied:** Added resolver rules, API DTO status signaling, UI behavior, and tests for both edge cases.

### Gap 7: Chat-state persistence and mobile PDF interaction lacked explicit verification

**Severity:** High  
**Issue:** Spec acceptance requires preserving chat input/scroll and mobile PDF zoom/scroll support; plan tests were insufficient.  
**Fix Applied:** Added unit tests for chat state persistence and an E2E test for mobile PDF zoom/scroll.

### Gap 8: Migration plan allowed placeholder content

**Severity:** Medium  
**Issue:** Plan previously deferred actual 471 content with placeholder text, conflicting with FR-004 intent.  
**Fix Applied:** Updated Step 6 to require actual Figma payload seeding, onInit wiring, and non-empty-content validation test.

## Changes Made to Plan

- Updated assumptions to remove placeholder migration and align richText rendering with MathMarkdown.
- Expanded Step 1 with concrete validation scope and new hook file path.
- Updated Step 3 to define secure resolver/API behavior, strict precedence, one-way locale fallback, and whitelisted DTO response.
- Expanded Step 4 with richText extraction helper, persistence expectations, and mobile PDF E2E coverage.
- Refined Step 5 to verification-first scope with conditional file edits only if missing wiring is discovered.
- Updated Step 6 migration behavior to seed real 471 content and integrate safely with `onInit`.
- Extended Step 7 quality gate commands to include targeted integration/unit/E2E runs.
- Corrected and expanded Test Summary and spec traceability mappings to match revised coverage.
