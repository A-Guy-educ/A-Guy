# Implementation Plan: Loading and Error Boundaries

## Step 1: Create Root Loading Component
**File**: `src/app/(frontend)/loading.tsx`

Create loading.tsx with a centered spinner using Tailwind CSS animate-spin class.

## Step 2: Create Root Error Boundary
**File**: `src/app/(frontend)/error.tsx`

Create error.tsx as a client component ('use client') that:
- Accepts error and reset props
- Displays error message
- Provides retry button that calls reset()

## Step 3: Create Lesson Loading (Optional)
**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`

Create lesson-specific loading for the heaviest route.

## Verification
1. Navigate between heavy pages to see loading spinner
2. Temporarily break a server component to test error boundary
3. Verify retry button works correctly
