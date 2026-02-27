# Specification: Loading and Error Boundaries for Frontend Routes

## Overview
Add Next.js loading.tsx and error.tsx files to the frontend route tree to improve UX during navigation and error handling.

## Requirements

### FR-1: Root Loading State
- Create `src/app/(frontend)/loading.tsx` 
- Display a loading spinner/skeleton during server component rendering
- Show spinner during navigation between pages

### FR-2: Root Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Handle uncaught errors gracefully
- Provide retry functionality

### FR-3: Lesson Route Loading (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- Heavy route benefits from dedicated loading state

## Acceptance Criteria

- [ ] loading.tsx shows spinner during page navigation
- [ ] error.tsx displays error message with retry button
- [ ] Retry button successfully re-renders the page
- [ ] Loading state appears before content is ready
- [ ] Errors display graceful fallback instead of raw Next.js error
