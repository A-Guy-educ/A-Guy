# Plan Gap Analysis: 260223-auto-18

## Summary

- Gaps Found: 5
- Plan Revised: Yes

## Gaps Identified

### Gap 1: FR-003 Positioning Classes Conflict (`right-4` in `dialog.tsx`)

**Severity:** Critical
**Issue:** The original `plan.md` proposed changing `right-4` to `end-4` in `src/ui/web/components/dialog.tsx`. This directly contradicted `spec.md` (FR-003, Special Cases/Guardrails) which explicitly states, "DO NOT CHANGE `right-4` and `top-4` when used for absolute positioned elements like dialog close buttons."
**Fix Applied:** The `dialog.tsx` modification in Step 2 was reverted to preserve `right-4`. The Allowlist in Step 1 and the main Allowlist section were updated to explicitly include `right-4` and `top-4` as exceptions.

### Gap 2: FR-006 Floats and Clears Missing from Action Steps

**Severity:** High
**Issue:** While the "Mapping Reference" section of `plan.md` correctly listed logical equivalents for `float-left`, `float-right`, `clear-left`, and `clear-right`, no action steps in the plan explicitly targeted these classes for refactoring. A grep search confirmed no existing instances of these physical classes in the codebase.
**Fix Applied:** The lint test in Step 1 was updated to include regex patterns for these classes, ensuring they are not introduced in the future. The "Mapping Reference" was also confirmed to include these.

### Gap 3: FR-007 Directional Gradients and Transforms Missing from Action Steps

**Severity:** High
**Issue:** The original `plan.md` did not explicitly address `bg-gradient-to-r` or specific `translate-x-*` instances that required `ltr:/rtl:` variants as per `spec.md` (FR-007). A grep search identified `bg-gradient-to-r` in `page.tsx` and `translate-x-full` in `NotebookWorkspace/index.tsx` as needing bidirectional variants.
**Fix Applied:** A new Step 7 was added to specifically address `bg-gradient-to-r` in `page.tsx` and `translate-x-0`/`translate-x-full` in `NotebookWorkspace/index.tsx` with `ltr:/rtl:` prefixes. The lint test in Step 1 was updated to scan for these patterns, and the main Allowlist was updated with explicit entries for these cases.

### Gap 4: NFR-001 Incomplete Component Coverage (`src/app/(frontend)`)

**Severity:** Critical
**Issue:** The original `plan.md` focused exclusively on components in `src/ui/web/` and `src/ui/cody/`, completely overlooking the `src/app/(frontend)` components explicitly listed in `spec.md` (NFR-001) that contained physical directional classes.
**Fix Applied:** A new Step 7 was added to the plan, dedicated to refactoring all identified components within the `src/app/(frontend)` directory. This includes `CourseCard`, `BackToCourses`, `ViewToggle`, `NotebookWorkspace`, and `AskContent`.

### Gap 5: Lint Test Scope Incomplete

**Severity:** High
**Issue:** The lint test defined in Step 1 of the original `plan.md` only covered `src/ui/web/**/*.tsx` and `src/ui/cody/**/*.tsx`, omitting `src/app/(frontend)/**/*.tsx`.
**Fix Applied:** The scope of the lint test in Step 1 was expanded to include `src/app/(frontend)/**/*.tsx`, ensuring comprehensive coverage across all relevant frontend components.

## Changes Made to Plan

- Updated Step 1 (`Create RTL lint test + utility mapping`):
  - Expanded the scope of the lint test to include `src/app/(frontend)/**/*.tsx`.
  - Modified the regex for `physical positioning classes` to explicitly exclude `right-4` and `left-2`.
  - Added new lint tests for `physical float/clear classes` and `directional gradients/transforms`.
  - Updated the Allowlist to explicitly include `right-4`, `top-4`, `left-2`, `translate-x-0` (for `NotebookWorkspace`), `translate-x-full` (for `NotebookWorkspace`), `bg-gradient-to-r`, and `border-l` (for `NotebookWorkspace`) with their respective reasons.
- Updated Step 2 (`Refactor shared UI components and shadcn primitives`):
  - Reverted the change for `dialog.tsx` `right-4` to preserve it, in line with the spec's guardrails.
  - Updated the Acceptance Criteria for `dialog.tsx` to reflect the preservation of `right-4`.
- Added Step 7 (`Refactor frontend app components and handle gradients/transforms`):
  - Created a new step to address all `src/app/(frontend)` components listed in the spec.
  - Included specific modifications for `mr-2`, `pl-0`, `ml-6`, `right-0`, `border-l`, `bg-gradient-to-r`, and `translate-x-*` classes within these components.
- Updated `Mapping Reference (for build agent)`:
  - Ensured `float-left`, `float-right`, `clear-left`, `clear-right` are present.
- Updated `DO NOT CHANGE (Allowlist)`:
  - Expanded with detailed entries for `right-4`, `top-4`, `left-2`, `bg-gradient-to-r`, and `translate-x-*` with `ltr:/rtl:` guidance for `NotebookWorkspace`, and `border-l` for `NotebookWorkspace`.