# Loading and Error UI Enhancement

## Overview
Add Next.js loading.tsx and error.tsx files to the frontend route tree to improve UX during navigation and error states.

## Requirements
- FR-1: Create `src/app/(frontend)/loading.tsx` with a loading spinner/skeleton
- FR-2: Create `src/app/(frontend)/error.tsx` with error boundary and retry functionality
- FR-3: Optionally create nested loading.tsx for the heaviest route (lesson page)

## Implementation Details

### Available Components
- **Spinner**: `src/ui/web/shared/Loading/Spinner.tsx` - Use for loading states
- **Skeleton**: `src/ui/web/shared/Loading/Skeleton.tsx` - Use for placeholder content
- **Button**: `src/ui/web/components/button` - Use for retry/action buttons

### i18n Requirements
Add the following translations to `src/i18n/en.json` and `src/i18n/he.json`:

```json
{
  "loading": {
    "title": "Loading...",
    "description": "Please wait while the page loads"
  },
  "error": {
    "title": "Something went wrong",
    "description": "An error occurred while loading this page",
    "retry": "Try again"
  }
}
```

### Pattern Requirements
- All loading.tsx and error.tsx files should use `'use client'` directive
- Use translations via `useTranslations` hook from `@/ui/web/providers/I18n`
- Match existing UI patterns from `not-found.tsx` (container, centering, etc.)
- Loading states should be non-blocking and visually centered

### Existing Infrastructure
Note: There's an existing client-side `RouteLoadingIndicator` component in the layout that shows a progress bar during route transitions. This is separate from the Next.js loading.tsx which shows during Server Component data fetching.

## Acceptance Criteria
- [ ] Root loading.tsx renders a spinner during server component navigation
- [ ] Root error.tsx displays graceful error message with retry button
- [ ] Error boundary catches errors and allows recovery via reset()
- [ ] Loading states visible during course → lesson → exercise navigation
- [ ] No blank screens during page transitions
- [ ] Errors display user-friendly message instead of raw Next.js error page
- [ ] All UI text uses i18n translations
- [ ] UI matches existing patterns (shadcn/ui, container styling)
