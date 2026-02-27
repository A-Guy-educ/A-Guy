# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue
[HIGH] Enhancement: Add loading.tsx and error.tsx to frontend routes

## Description
The `src/app/(frontend)/` route tree has **no `loading.tsx` or `error.tsx` files** anywhere. This means:
- No loading UI during server component rendering or navigation (blank screen)
- Unhandled errors show the raw Next.js error page instead of a graceful fallback

## Context (from Gap Analysis)

### Existing Infrastructure
1. **RouteLoadingIndicator**: Already exists at `src/infra/loading/components/RouteLoadingIndicator.tsx` - provides client-side navigation loading indicator (top progress bar)
2. **global-error.tsx**: Exists at `src/app/global-error.tsx` - provides Sentry integration for root-level errors
3. **not-found.tsx**: Already exists in `src/app/(frontend)/` - provides 404 UI

### Important Notes
- The new `loading.tsx` is for **React Suspense streaming** during server component rendering - this complements (not replaces) the RouteLoadingIndicator
- The new `error.tsx` is for the **route segment** - different from global-error.tsx which wraps the entire app
- The codebase uses **i18n translations** and **shadcn/ui** components - these should be used

## Files to Create
- `src/app/(frontend)/loading.tsx` — Root loading skeleton/spinner
- `src/app/(frontend)/error.tsx` — Root error boundary with retry
- Optionally: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` for the heaviest route

## Suggested Implementation (UPDATED)

### loading.tsx
```tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
```

### error.tsx
```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'  // Use shadcn/ui Button

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.error')

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2>{t('title')}</h2>
      <p>{t('message')}</p>
      <Button onClick={reset}>{t('tryAgain')}</Button>
    </div>
  )
}
```

### Translation Keys to Add
Add to `src/i18n/en.json` and `src/i18n/he.json`:
```json
"common": {
  "error": {
    "title": "Something went wrong",
    "message": "An unexpected error occurred. Please try again.",
    "tryAgain": "Try again"
  }
}
```

## Steps to Test
1. Navigate between heavy pages (course → lesson → exercise)
2. Before fix: blank/frozen screen during load
3. After fix: spinner/skeleton visible during navigation
4. For error.tsx: temporarily break a server component → should show graceful error UI

## Priority
HIGH — Major UX gap, affects every page navigation

## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
- [ ] Uses shadcn/ui Button component (not raw `<button>`)
- [ ] Uses i18n translations for all user-facing text
- [ ] Loading.tsx uses design tokens from the design system
