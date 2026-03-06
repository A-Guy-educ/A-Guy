# Specification: Fix global-error.tsx

## Overview

Fix the global error page component to use Tailwind CSS classes instead of inline styles, add accessibility attributes, and support basic i18n via browser language detection.

## Requirements

1. **Replace inline styles with Tailwind utility classes**
   - Use `className="flex flex-col items-center justify-center min-h-screen"` for the container
   - Style the button consistently with the rest of the application using Tailwind

2. **Add accessibility attributes**
   - Add `role="alert"` to the error message container for screen reader support
   - Add appropriate `aria-live` attribute

3. **Language support**
   - Since this renders outside the i18n provider, use basic browser language detection via `navigator.language`
   - Display text in English ("Something went wrong!", "Try again") or Hebrew based on browser language
   - Support: 'en' and 'he' locales

## Acceptance Criteria

- [ ] Inline `style={{}}` attributes replaced with Tailwind classes
- [ ] `role="alert"` added to error container
- [ ] Error message displays in correct language based on `navigator.language`
- [ ] Button styled consistently with rest of application using Tailwind
- [ ] File compiles without TypeScript errors

## Files to Change

- `src/app/global-error.tsx`
