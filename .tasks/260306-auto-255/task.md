# Task

## Issue Title

Bug: global-error.tsx uses hardcoded English strings and inline styles
## Description

The global error page `src/app/global-error.tsx` has hardcoded English strings ("Something went wrong!", "Try again") and uses inline `style={{}}` attributes instead of Tailwind classes. This violates the project's DESIGN_SYSTEM.md styling conventions and lacks accessibility attributes.

## Current Behavior

- `"Something went wrong!"` and `"Try again"` are hardcoded in English
- Uses inline `style={{}}` instead of Tailwind utility classes
- Missing `role="alert"` and `aria-live` accessibility attributes
- Inconsistent styling compared to the rest of the app

## Expected Behavior

- Replace inline styles with Tailwind utility classes (e.g., `className="flex flex-col items-center justify-center min-h-screen"`)
- Add `role="alert"` for screen reader accessibility
- Style the button consistently with the rest of the application using Tailwind
- Since this renders outside the i18n provider, hardcoded strings are acceptable but should at least be in both languages with basic browser language detection via `navigator.language`

## Files to Change

- `src/app/global-error.tsx`

## Complexity

Easy — single file, replace inline styles with Tailwind classes and add accessibility attributes.

## Labels

bug, accessibility, ui
