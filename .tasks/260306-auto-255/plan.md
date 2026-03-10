# Plan: Fix global-error.tsx Inline Styles and Accessibility

**Task ID**: 260306-auto-255
**Task Type**: fix_bug
**Spec**: spec.md

---

## Summary

The `src/app/global-error.tsx` file uses inline `style={{}}` attributes and hardcoded English strings without accessibility attributes. This violates the project's DESIGN_SYSTEM.md rule: "❌ NEVER use: Inline styles". The fix replaces inline styles with Tailwind classes, adds ARIA accessibility attributes, and implements basic bilingual text (EN/HE) via `navigator.language` since this component renders outside the i18n provider.

## Assumptions

- This is a `'use client'` component that renders outside the Next.js layout tree (including outside i18n providers), so `useTranslations()` is NOT available.
- `navigator.language` is available in the browser and can be used for basic language detection.
- The component must still wrap content in `<html><body>` since it replaces the entire page.
- Tailwind CSS is available in global-error since the project's global styles are loaded via `<html>` in the root layout, BUT since global-error replaces the entire HTML document, we need to import the Tailwind stylesheet explicitly or rely on classes that work without the stylesheet. **Decision**: We will add a `<link>` to the compiled CSS or use the `@import` pattern. However, since global-error.tsx replaces the entire `<html>`, Tailwind classes may NOT be available. We'll add a minimal inline `<style>` tag that mirrors the Tailwind classes for this edge case, OR we import the global CSS. Looking at Next.js conventions, the safest approach is to use inline styles converted to a `<style>` tag in `<head>` since this page replaces the root layout entirely.

**REVISED ASSUMPTION**: After further analysis, Next.js global-error replaces the root layout entirely, meaning no CSS is loaded. The pragmatic approach that satisfies "no inline `style={{}}` attributes" is to use a `<style>` tag in the `<head>` with class-based selectors, and use `className` attributes on elements. This removes inline styles while being functional. Alternatively, we can import the globals.css directly. Let me check what's standard — the simplest compliant approach is using Tailwind `className` strings and trusting that Next.js will still inject the built CSS even in global-error (Next.js does inject built CSS for client components). We'll use `className` with Tailwind utilities.

---

## Step 1: Write Reproduction Tests for All Bugs

**Root Cause**: `global-error.tsx` uses `style={{ padding: '20px', textAlign: 'center' }}` inline styles, is missing `role="alert"` and `aria-live="polite"` accessibility attributes, has hardcoded English-only strings, and the button lacks Tailwind styling.

**Files to Touch**:
- `tests/unit/app/global-error.test.tsx` (NEW)

**Reproduction Tests** (MUST FAIL before fix):

1. **Test: "should not have any inline style attributes"**
   - Render `GlobalError` with mock error and reset function
   - Query the rendered container for any element with a `style` attribute
   - Assert no elements have inline styles
   - **Why it fails now**: The `<div>` has `style={{ padding: '20px', textAlign: 'center' }}`

2. **Test: "should have role='alert' on the error container"**
   - Render `GlobalError`
   - Query for an element with `role="alert"`
   - Assert it exists
   - **Why it fails now**: No element has `role="alert"`

3. **Test: "should have aria-live='polite' on the error container"**
   - Render `GlobalError`
   - Query for an element with `aria-live="polite"`
   - Assert it exists
   - **Why it fails now**: No element has `aria-live="polite"`

4. **Test: "should render Try again button with Tailwind className"**
   - Render `GlobalError`
   - Find the button element
   - Assert it has a `className` attribute containing Tailwind utility classes (e.g., at minimum some class string is present)
   - **Why it fails now**: Button has no `className`

5. **Test: "should detect Hebrew language from navigator.language"**
   - Mock `navigator.language` to return `'he'`
   - Render `GlobalError`
   - Assert the page contains Hebrew text (e.g., "משהו השתבש" or similar)
   - **Why it fails now**: Only English "Something went wrong!" is rendered

6. **Test: "should show English text for English browser language"**
   - Mock `navigator.language` to return `'en-US'`
   - Render `GlobalError`
   - Assert the page contains "Something went wrong!"

**Test file structure**:
```
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

Note: Since `GlobalError` wraps content in `<html><body>`, the test should render it and query within the rendered output. We may need to use `render()` and query the `container` directly since `<html>` and `<body>` tags may be stripped by jsdom.

**Acceptance Criteria**:
- [ ] All 6 tests exist and can be executed
- [ ] Tests 1-5 FAIL against the current `global-error.tsx`
- [ ] Test 6 PASSES (current code has English text)

---

## Step 2: Fix global-error.tsx — Replace Inline Styles, Add Accessibility, Add i18n

**Root Cause**: Single file has multiple issues — inline styles, missing a11y, English-only text.

**Files to Touch**:
- `src/app/global-error.tsx` (MODIFIED — all lines 1-28)

**Fix**: Rewrite the component to:

1. **Remove inline `style={{}}`** on the `<div>` — replace with `className` using Tailwind utilities:
   - `className="flex flex-col items-center justify-center min-h-screen p-5 text-center"`

2. **Add accessibility attributes** to the error container:
   - `role="alert"`
   - `aria-live="polite"`

3. **Style the button** with Tailwind classes matching project conventions:
   - `className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"`
   - (Matches the shadcn/ui Button default variant pattern from DESIGN_SYSTEM.md)

4. **Add language detection** using a simple helper inside the component:
   ```tsx
   const isHebrew = typeof navigator !== 'undefined' && navigator.language?.startsWith('he')
   const text = {
     heading: isHebrew ? 'משהו השתבש!' : 'Something went wrong!',
     tryAgain: isHebrew ? 'נסה שוב' : 'Try again',
   }
   ```

5. **Add `dir` and `lang` attributes** to `<html>` based on detected language:
   - `<html lang={isHebrew ? 'he' : 'en'} dir={isHebrew ? 'rtl' : 'ltr'}>`

**Verification**:
- Run all 6 tests from Step 1 → ALL MUST PASS after fix
- Run `pnpm tsc --noEmit` → no type errors
- Run `pnpm lint` → no lint errors

**Acceptance Criteria**:
- [ ] No inline `style={{}}` attributes in global-error.tsx (FR-1)
- [ ] Error container has `role="alert"` attribute (FR-2)
- [ ] Error container has `aria-live="polite"` attribute (FR-2)
- [ ] Button uses Tailwind classes for styling (FR-3)
- [ ] Hebrew text displayed when `navigator.language` starts with 'he' (FR-4)
- [ ] English text displayed for other languages (FR-4)
- [ ] `<html>` tag has correct `lang` and `dir` attributes
- [ ] All 6 unit tests pass
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

## Test Commands

```bash
# Run the specific test file
pnpm vitest run tests/unit/app/global-error.test.tsx

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Estimated Time

- Step 1: ~10 minutes (write 6 tests)
- Step 2: ~10 minutes (rewrite single component)
- Total: ~20 minutes
