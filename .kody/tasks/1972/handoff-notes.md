# Issue #1972 Fix: sectionIndex not displayed in failure/warning rows

## What was fixed

The lesson duplication review screen (`src/ui/admin/LessonDuplicationReview/index.tsx`) was not displaying the `sectionIndex` field in failure and warning rows — it was only used in React keys and `findIndex` calls, but never rendered as visible text.

## Changes made

### `src/ui/admin/LessonDuplicationReview/index.tsx`
- Added `sectionIndexStyle` CSS style definition (monospace, 12px, muted color)
- In failure rows (line ~646): added `<span style={sectionIndexStyle}>Section {failure.sectionIndex}</span>` between the code span and message span
- In warning rows (line ~808): added `<span style={sectionIndexStyle}>Section {w.sectionIndex}</span>` similarly

### `tests/unit/admin/lesson-duplication-review-redesign-1662.spec.ts`
- Added `Section Index Display in Failure/Warning Rows` test suite with two tests that verify `sectionIndex` appears as rendered content (not just in keys)
- Tests use regex patterns checking for `sectionIndexStyle` and `Section {failure.sectionIndex}` co-occurrence

## Bug root cause

The `FailureEntry` interface has 6 fields (`exerciseRef`, `sectionIndex`, `code`, `message`, `suggestedAction`, `resolved`). The component rendered `code` and `message` but `sectionIndex` was only used in React `key` attributes and `findIndex` comparisons — never as visible text in the row.

## Verification

All 11 unit tests pass. Quality gates (typecheck, lint) pass via `mcp__kody-verify__verify`.
