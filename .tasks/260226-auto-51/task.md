# Task

## Issue Title

[HIGH] Enhancement: Add loading.tsx and error.tsx to frontend routes
## Description
The `src/app/(frontend)/` route tree has **no `loading.tsx` or `error.tsx` files** anywhere. This means:
- No loading UI during server component rendering or navigation (blank screen)
- Unhandled errors show the raw Next.js error page instead of a graceful fallback

## Files to Create
- `src/app/(frontend)/loading.tsx` — Root loading skeleton/spinner
- `src/app/(frontend)/error.tsx` — Root error boundary with retry
- Optionally: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` for the heaviest route

## Suggested Implementation
```tsx
// loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
```

```tsx
// error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Steps to Test
1. Navigate between heavy pages (course → lesson → exercise)
2. Before fix: blank/frozen screen during load
3. After fix: spinner/skeleton visible during navigation
4. For error.tsx: temporarily break a server component → should show graceful error UI

## Priority
HIGH — Major UX gap, affects every page navigation
