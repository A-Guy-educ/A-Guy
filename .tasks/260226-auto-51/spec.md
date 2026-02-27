# Loading and Error UI Enhancement Specification

## Overview
Add Next.js loading.tsx and error.tsx files to the frontend route tree to improve user experience during navigation and error states.

## Requirements

### FR-1: Root Loading UI
- Create `src/app/(frontend)/loading.tsx`
- Display a loading spinner/skeleton during server component rendering
- Should be visible during any navigation between pages

### FR-2: Root Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Handle uncaught errors gracefully with a user-friendly message
- Include a retry mechanism to allow users to recover from errors

### FR-3: Lesson Route Loading UI (Optional)
- Create `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`
- This is the heaviest route in the application and would benefit from a dedicated loading state

## Acceptance Criteria

### AC-1: Loading States
- [ ] Navigate between heavy pages (course → lesson → exercise)
- [ ] Loading spinner/skeleton is visible during navigation
- [ ] No blank/frozen screens during page loads

### AC-2: Error Handling
- [ ] Temporarily break a server component
- [ ] User sees graceful error UI instead of raw Next.js error page
- [ ] Retry button successfully reloads the page/component

### AC-3: Implementation
- [ ] All files use proper TypeScript
- [ ] Loading component uses Tailwind CSS for styling
- [ ] Error component is marked 'use client' for client-side interactivity
