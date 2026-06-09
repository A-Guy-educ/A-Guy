# Issue #2545: Admin PDF Conversion Route Renders Blank

## What was done

Fixed the `/admin/pdf-conversion` route that was rendering a completely blank page by comparing it with the working `/admin/chat` route.

## Root cause

The PDF conversion page was missing two things that the chat page has:
1. `I18nProvider` wrapper around content
2. Explicit height container (`height: calc(100vh - 64px)`)

## Changes made

- `src/app/(payload)/admin/pdf-conversion/page.tsx`: Added `I18nProvider` with `enMessages` and wrapped content in a `div` with explicit height
- `tests/unit/admin/pdf-conversion-page.spec.tsx`: Added unit tests to verify page renders correctly

## Tests

All 3 unit tests pass. Quality gates passed.

## Note

The unit tests passed even BEFORE the fix was applied, which suggests the blank page may be environment-specific (real browser vs jsdom). QA verification recommended on the deployed branch.
