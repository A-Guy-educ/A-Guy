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

### FR-3: Lesson Page Loading (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- Provide specific loading UI for the heaviest route (lesson pages)

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
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Priority

HIGH — Major UX gap, affects every page navigation
