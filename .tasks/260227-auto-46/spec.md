# Specification: Loading and Error Boundaries for Frontend Routes

## Overview
Add Next.js loading.tsx and error.tsx files to the frontend route tree to improve UX during navigation and error handling.

> **Note**: The layout already includes a `<RouteLoadingIndicator />` component for client-side navigation loading. The loading.tsx is supplementary - it handles SSR navigation transitions and initial route loading states.

## Requirements

### FR-1: Root Loading State
- Create `src/app/(frontend)/loading.tsx`
- Use the existing design system `Spinner` component from `@/ui/web/shared/Loading/Spinner.tsx`
- Display a loading spinner during server component rendering
- Show spinner during navigation between pages

### FR-2: Root Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Must be a client component (include `'use client'` directive)
- Handle uncaught errors gracefully
- Provide retry functionality using `reset()` prop from Next.js error boundary

### FR-3: Lesson Route Loading (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- Heavy route benefits from dedicated loading state

### FR-4: Internationalization (i18n) Support
- loading.tsx must use translations from `common` namespace
- error.tsx must use translations for error messages
- Use `useTranslations` from `@/ui/web/providers/I18n` (same pattern as not-found.tsx)

## Acceptance Criteria

- [ ] loading.tsx shows spinner during page navigation
- [ ] loading.tsx uses i18n translations for "Loading..." text
- [ ] loading.tsx uses the design system `Spinner` component with proper ARIA label
- [ ] error.tsx displays error message with retry button
- [ ] error.tsx is a client component ('use client' directive)
- [ ] error.tsx uses i18n translations for error messages
- [ ] Retry button successfully re-renders the page using `reset()` function
- [ ] Loading state appears before content is ready
- [ ] Errors display graceful fallback instead of raw Next.js error
