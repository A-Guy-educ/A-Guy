# Implementation Plan

## Step 1: Create Root Loading Component
- File: `src/app/(frontend)/loading.tsx`
- Implementation: Export default function returning spinner div with animate-spin class

## Step 2: Create Root Error Boundary
- File: `src/app/(frontend)/error.tsx`
- Implementation: Client component with Error type props, display error message and retry button

## Step 3: (Optional) Create Lesson Loading Component
- File: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- Implementation: Same spinner pattern for heaviest route

## Step 4: Verify
- Test navigation between pages for loading spinner
- Temporarily break a component to test error boundary
