# Loading and Error UI Enhancement

## Overview
Add Next.js loading.tsx and error.tsx files to the frontend route tree to improve UX during navigation and error states.

## Requirements
- FR-1: Create `src/app/(frontend)/loading.tsx` with a loading spinner/skeleton
- FR-2: Create `src/app/(frontend)/error.tsx` with error boundary and retry functionality
- FR-3: Optionally create nested loading.tsx for the heaviest route (lesson page)

## Acceptance Criteria
- [ ] Root loading.tsx renders a spinner during server component navigation
- [ ] Root error.tsx displays graceful error message with retry button
- [ ] Error boundary catches errors and allows recovery via reset()
- [ ] Loading states visible during course → lesson → exercise navigation
- [ ] No blank screens during page transitions
- [ ] Errors display user-friendly message instead of raw Next.js error page
