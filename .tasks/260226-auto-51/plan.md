# Implementation Plan: Loading and Error UI Enhancement

## Step 1: Create Root Loading Component
**File**: `src/app/(frontend)/loading.tsx`

```tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
```

## Step 2: Create Root Error Boundary
**File**: `src/app/(frontend)/error.tsx`

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

## Step 3: Create Lesson Route Loading (Optional)
**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`

Can reuse the same loading pattern or create a more detailed skeleton for the lesson content.

## Verification Steps

1. **Test Loading States**:
   - Navigate between heavy pages (course → lesson → exercise)
   - Before fix: blank/frozen screen during load
   - After fix: spinner/skeleton visible during navigation

2. **Test Error Handling**:
   - Temporarily break a server component
   - Should show graceful error UI instead of raw Next.js error page
   - Click retry button to verify recovery works
