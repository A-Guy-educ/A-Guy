# Fix Search Submit Button Not Directly Clickable (Issue #1952)

## What Was Done

**Root Cause:** The search submit button in `src/ui/web/search/Component.tsx` had `className="sr-only"` making it visually hidden and unclickable via mouse. Users could only submit via Enter key.

**Fix Applied:**
1. Removed `sr-only` from the submit button
2. Added proper button styling using the project's design system (primary button variant)
3. Added `flex gap-2` layout to the form for proper input/button side-by-side layout
4. Added `flex-1` to the Input so it takes available space

**Files Changed:**
- `src/ui/web/search/Component.tsx` - Made button visible and properly styled
- `tests/e2e/verification/catalog-navigation.e2e.spec.ts` - Added test for button clickability

**Verification:** TypeScript typecheck and lint pass. The verify tool confirmed all quality gates are green.
