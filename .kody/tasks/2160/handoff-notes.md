# Fix #2160: Thin white strip at the top of homepage

## What was done

Added `background-color: hsl(var(--background))` to the `html` CSS rule in `src/app/(frontend)/globals.css` (line 263).

## Root cause

The `html` element had no explicit background color set (only `scroll-behavior: smooth`). While the `body` has `background-color: hsl(var(--background))` and `margin: 0`, when there's any rendering gap between the viewport edge and the body's painted area (e.g., due to margin collapse), the browser's default white background shows through, creating a thin white strip at the very top. Setting an explicit background on `html` ensures any such gap blends with the body's background.

## Files changed

- `src/app/(frontend)/globals.css` — added `background-color: hsl(var(--background))` to html rule (line 263)

## Test

- `tests/e2e/homepage-top-gap.e2e.spec.ts` — E2E test that asserts `getComputedStyle(document.body).marginTop === 0`
- Quality gates verified: typecheck, lint, and tests all pass
