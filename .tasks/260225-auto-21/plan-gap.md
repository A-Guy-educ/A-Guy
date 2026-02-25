# Plan Gap Analysis: 260225-auto-21

## Summary

- Gaps Found: 3
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Missing Translation Keys for Expand/Collapse

**Severity:** Critical
**Issue:** `spec.md` NFR-003 explicitly requires `sections.expand` and `sections.collapse` translation keys, but `plan.md` Step 2 did not include them in the proposed `en.json` and `he.json` content.
**Fix Applied:** Added `sections.expand` and `sections.collapse` with appropriate English and Hebrew values to the i18n JSON in Step 2 of `plan.md`.

### Gap 2: Incorrect RTL Chevron Direction Logic

**Severity:** Critical
**Issue:** `spec.md` NFR-004 defines specific LTR/RTL chevron rotation behavior (down → right for LTR, down → left for RTL on expand). `plan.md` Step 3 incorrectly assumed `data-[state=open]:rotate-180` (vertical rotation) was sufficient, which does not meet the horizontal rotation requirement.
**Fix Applied:** Modified Step 3 of `plan.md` to indicate that custom logic or a wrapper component will be needed for the `ChevronDown` icon to achieve the specified LTR/RTL-aware horizontal rotation.

### Gap 3: Unnecessary Profile Picture Translation Key

**Severity:** Medium
**Issue:** `spec.md` FR-002 and acceptance criterion 68 state "no profile picture - not available". However, `plan.md` Step 2 included a `profilePicture` translation key, which is unnecessary if no profile picture is displayed (only an initials-based `UserAvatar`).
**Fix Applied:** Removed the `profilePicture` key from the proposed i18n JSON in Step 2 of `plan.md`.

## Changes Made to Plan

- **Updated Step 2**: Added `sections.expand` and `sections.collapse` translation keys to `src/i18n/en.json` and `src/i18n/he.json`.
- **Updated Step 2**: Removed the `profilePicture` translation key from `src/i18n/en.json` and `src/i18n/he.json`.
- **Updated Step 3**: Revised the "Chevron + RTL" behavior description to specify the need for custom, locale-aware chevron rotation logic.