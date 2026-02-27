# Loading and Error States Specification

## Overview
Add Next.js special files (`loading.tsx` and `error.tsx`) to the frontend route tree to improve UX during navigation and error handling.

## Requirements

### Loading States (FR-1)
- Root `loading.tsx` at `src/app/(frontend)/loading.tsx` must show a spinner/skeleton during server component rendering
- Optional: Lesson page `loading.tsx` for the heaviest route

### Error Handling (FR-2)
- Root `error.tsx` at `src/app/(frontend)/error.tsx` must display graceful error fallback with retry functionality

## Acceptance Criteria

1. Navigation between pages shows loading spinner instead of blank screen
2. Unhandled errors display user-friendly error UI instead of raw Next.js error page
3. Error boundary includes a retry button that calls the `reset` function
4. Loading component uses Tailwind CSS classes matching design system
5. Error component is a client component ('use client')
