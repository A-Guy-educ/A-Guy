# Loading and Error Boundary Implementation Specification

## Overview
Add Next.js special files `loading.tsx` and `error.tsx` to the frontend route tree to improve user experience during navigation and error states.

## Requirements

### FR-1: Root Loading UI
- Create `src/app/(frontend)/loading.tsx`
- Display a loading spinner/skeleton during server component rendering
- Ensure the spinner is visually centered with minimum height of 50vh

### FR-2: Root Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Must be a client component ('use client')
- Display a user-friendly error message
- Include a retry button that calls the reset function
- Minimum height of 50vh with centered content

### FR-3: Lesson Route Loading (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- This is the heaviest route in the application
- Should have a loading skeleton appropriate for lesson content

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

## Acceptance Criteria

- [ ] loading.tsx renders a centered spinner on all (frontend) routes during navigation
- [ ] error.tsx displays graceful fallback UI when errors occur
- [ ] Error boundary includes a working retry button
- [ ] Loading states appear when navigating between heavy pages (course → lesson → exercise)
- [ ] Optional: lesson-specific loading.tsx provides appropriate skeleton for lesson content
