# Specification: Fix global-error.tsx Inline Styles and Accessibility

## Overview

Fix the global error page component to use Tailwind CSS classes instead of inline styles and add proper accessibility attributes.

## Requirements

### FR-1: Replace Inline Styles with Tailwind Classes
- Remove all `style={{}}` inline style attributes
- Use Tailwind utility classes for styling (e.g., `className="flex flex-col items-center justify-center min-h-screen"`)

### FR-2: Add Accessibility Attributes
- Add `role="alert"` to the error container for screen reader announcements
- Add `aria-live="polite"` to indicate the error message region

### FR-3: Style Button Consistently
- Apply Tailwind classes to the "Try again" button
- Match the styling conventions used elsewhere in the application

### FR-4: Language Detection (Optional Enhancement)
- Since the component renders outside the i18n provider, implement basic browser language detection
- Display text in both English and Hebrew based on `navigator.language`

## Acceptance Criteria

- [ ] No inline `style={{}}` attributes in global-error.tsx
- [ ] Error container has `role="alert"` attribute
- [ ] Error container has `aria-live="polite"` attribute
- [ ] Button uses Tailwind classes for styling
- [ ] Text displays in the appropriate language based on browser settings
- [ ] Code follows project's Tailwind styling conventions from DESIGN_SYSTEM.md
