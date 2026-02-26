# Specification: Loading and Error UI for Frontend Routes

## Overview

Add loading.tsx and error.tsx files to the frontend route tree to improve user experience during navigation and error handling.

## Requirements

### FR-1: Root Loading Component
- Create `src/app/(frontend)/loading.tsx`
- Display a loading spinner/skeleton while server components render
- Use a centered spinner with animation

### FR-2: Root Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Handle uncaught errors gracefully
- Provide a retry button to recover from errors
- Must be a client component ('use client')
- **Use i18n translations** for error messages (add to i18n files)
- **Include accessibility attributes** (role="alert" for error message)

### FR-3: Lesson Page Loading (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- Provide specific loading UI for the heaviest route (lesson pages)

### NFR-1: Internationalization Support
- Add error messages to i18n translation files:
  - `src/i18n/en.json`: Add `common.error.title` and `common.error.retryButton`
  - `src/i18n/he.json`: Add Hebrew translations
- Use `useTranslations` hook in error.tsx

### NFR-2: Accessibility
- Add `role="alert"` and `aria-live="polite"` to error message
- Add proper button label for screen readers

### NFR-3: Design System Compliance
- Use shadcn/ui Button component for retry button instead of raw `<button>`
- Use `--font-assistant` font from design tokens if displaying Hebrew text

## Acceptance Criteria

1. **Loading States**
   - [ ] Navigate between heavy pages (course → lesson → exercise)
   - [ ] Before fix: blank/frozen screen during load
   - [ ] After fix: spinner/skeleton visible during navigation

2. **Error Handling**
   - [ ] Temporarily break a server component
   - [ ] Should show graceful error UI instead of raw Next.js error page
   - [ ] Retry button should reset the error boundary

## Implementation Details

### Global Context
- **Existing loading indicator**: The layout already includes `RouteLoadingIndicator` component (`src/infra/loading/components/RouteLoadingIndicator.tsx`) which shows a top progress bar during navigation
- The `loading.tsx` provides Suspense fallback content while server components load
- These two mechanisms work together: RouteLoadingIndicator shows during client-side navigation, loading.tsx shows during SSR/hydration

### i18n Translations Required

Add to `src/i18n/en.json`:
```json
{
  "common": {
    "error": {
      "title": "Something went wrong",
      "retryButton": "Try again"
    }
  }
}
```

Add to `src/i18n/he.json`:
```json
{
  "common": {
    "error": {
      "title": "משהו השתבש",
      "retryButton": "נסה שוב"
    }
  }
}
```

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
import { Button } from '@/ui/web/components/button'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common.error')

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4" role="alert" aria-live="polite">
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <Button onClick={reset} variant="default">
        {t('retryButton')}
      </Button>
    </div>
  )
}
```

## Priority

HIGH — Major UX gap, affects every page navigation
