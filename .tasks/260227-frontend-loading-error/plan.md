# Plan: Add loading.tsx and error.tsx to Frontend Routes

**Task ID**: 260227-frontend-loading-error
**Task Type**: implement_feature
**Estimated Total Time**: 30-45 minutes (3 steps)

## Assumptions

1. The `useTranslations` hook is imported from `@/ui/web/providers/I18n` (confirmed from `not-found.tsx`)
2. The `Button` component is at `@/ui/web/components/button` (confirmed from `not-found.tsx`)
3. The existing `Spinner` component at `src/infra/loading/components/Spinner.tsx` should be reused for the loading page (it already has size variants, accessibility attributes, and uses design tokens)
4. Translation files are at `src/i18n/en.json` and `src/i18n/he.json`
5. The `error.tsx` must be a client component (`'use client'`) since it uses `reset()` and hooks
6. The `loading.tsx` is a Server Component (no interactivity needed) but the Spinner it uses is a client component — that's fine, Server Components can import Client Components
7. The heaviest route is the lesson page at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/` — adding a nested `loading.tsx` there is optional per spec and should be done only if we want finer-grained loading boundaries now
8. Unit tests use vitest with `@testing-library/react` in jsdom environment, as shown in existing test patterns
9. Unit tests must run against `vitest.config.unit.mts` (`pnpm test:unit` or `vitest run --config ./vitest.config.unit.mts`), because default `vitest.config.mts` only includes integration tests

---

## Step 1: Add i18n Translation Keys for Error UI

**Time**: ~10 minutes

### Files to Touch

- `src/i18n/en.json` (MODIFIED — add keys under `common.error`)
- `src/i18n/he.json` (MODIFIED — add keys under `common.error`)

### Exact Behavior

Add the following translation keys to both locale files:

**English (`en.json`)** — add inside the existing `"common"` object, after the `"notFound"` block:
```json
"error": {
  "title": "Something went wrong",
  "message": "An unexpected error occurred. Please try again.",
  "tryAgain": "Try again"
}
```

**Hebrew (`he.json`)** — add inside the existing `"common"` object, after the `"notFound"` block:
```json
"error": {
  "title": "משהו השתבש",
  "message": "אירעה שגיאה בלתי צפויה. אנא נסו שנית.",
  "tryAgain": "נסו שוב"
}
```

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/i18n/error-translations.test.ts`

```
Test 1: "en.json contains common.error.title, common.error.message, common.error.tryAgain keys"
  - Import en.json, assert common.error.title === 'Something went wrong'
  - Assert common.error.message is a non-empty string
  - Assert common.error.tryAgain === 'Try again'

Test 2: "he.json contains common.error.title, common.error.message, common.error.tryAgain keys"
  - Import he.json, assert common.error.title === 'משהו השתבש'
  - Assert common.error.message is a non-empty string
  - Assert common.error.tryAgain === 'נסו שוב'
```

### Acceptance Criteria

- [ ] `en.json` has `common.error.title`, `common.error.message`, `common.error.tryAgain`
- [ ] `he.json` has the same keys with Hebrew translations
- [ ] Both JSON files are valid (no syntax errors)
- [ ] Existing translations are untouched

---

## Step 2: Create Root `loading.tsx` for Frontend Route Group

**Time**: ~10 minutes

### Files to Touch

- `src/app/(frontend)/loading.tsx` (NEW)

### Exact Behavior

Create a Server Component that displays a centered spinner during React Suspense streaming. This file:
- Is a Next.js loading convention file — automatically wraps the route segment in `<Suspense>`
- Shows a centered spinner using the existing `Spinner` component from `@/infra/loading/components/Spinner`
- Uses Tailwind design tokens (`min-h-[50vh]`, `items-center`, `justify-center`, `text-primary`)
- Is accessible (Spinner already has `role="status"` and `aria-label="Loading"`)
- Complements (does NOT replace) the `RouteLoadingIndicator` top progress bar

Implementation pattern:
```tsx
import { Spinner } from '@/infra/loading/components/Spinner'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
```

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/frontend/loading.test.tsx`

```
Test 1: "loading.tsx renders a spinner with loading role"
  - // @vitest-environment jsdom
  - Mock '@/infra/loading/components/Spinner' to render <div role="status">Loading</div>
  - Import and render the default export from src/app/(frontend)/loading.tsx
  - Assert: element with role="status" exists in the document
  - Assert: container has a div with className containing 'flex', 'items-center', 'justify-center', 'min-h-[50vh]'

Test 2: "loading.tsx passes size='lg' and className='text-primary' to Spinner"
  - Mock Spinner with vi.fn() that captures props
  - Render Loading component
  - Assert: Spinner was called with size='lg'
  - Assert: Spinner was called with className including 'text-primary'
```

### Acceptance Criteria

- [ ] File exists at `src/app/(frontend)/loading.tsx`
- [ ] Exports a default function component
- [ ] Uses the existing `Spinner` component (not a custom CSS spinner)
- [ ] Centered layout with `min-h-[50vh]` for good visual centering
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] Uses design tokens from the design system (Tailwind classes + `text-primary` on spinner)

---

## Step 3: Create Root `error.tsx` for Frontend Route Group (+ Optional Lesson Loading)

**Time**: ~15 minutes

### Files to Touch

- `src/app/(frontend)/error.tsx` (NEW)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` (NEW)

### Exact Behavior

#### error.tsx

Create a Client Component (`'use client'`) that serves as the error boundary for the `(frontend)` route segment:
- Uses `useTranslations('common.error')` from `@/ui/web/providers/I18n` for i18n (matches `not-found.tsx` pattern)
- Uses `Button` from `@/ui/web/components/button` (matches `not-found.tsx` pattern)
- Receives `{ error, reset }` props (Next.js error boundary contract)
- Displays error title, message, and a retry button
- Uses Tailwind for layout — centered vertically with `min-h-[50vh]`

Implementation pattern:
```tsx
'use client'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.error')

  return (
    <div className="container flex flex-col items-center justify-center min-h-[50vh] gap-4" data-error-digest={error.digest}>
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground">{t('message')}</p>
      <Button onClick={() => reset()}>{t('tryAgain')}</Button>
    </div>
  )
}
```

#### Lesson loading.tsx

Optional enhancement (allowed by spec): create a loading page for the heaviest route (lesson page with exercises, PDF viewer, etc.):
- Same pattern as root loading.tsx — centered Spinner
- Placed at the deeply nested lesson route for finer-grained loading boundaries

Implementation pattern:
```tsx
import { Spinner } from '@/infra/loading/components/Spinner'

export default function LessonLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
```

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/frontend/error.test.tsx`

```
Test 1: "error.tsx renders translated title and message"
  - // @vitest-environment jsdom
  - Mock '@/ui/web/providers/I18n' → useTranslations returns a function mapping:
    'title' → 'Something went wrong', 'message' → 'An error occurred', 'tryAgain' → 'Try again'
  - Mock '@/ui/web/components/button' → Button renders a <button> with children
  - Import and render default export with { error: new Error('test'), reset: vi.fn() }
  - Assert: text 'Something went wrong' is in the document
  - Assert: text 'An error occurred' is in the document
  - Assert: a button with text 'Try again' exists

Test 2: "error.tsx calls reset() when Try Again button is clicked"
  - Same mocks as Test 1
  - Render with reset = vi.fn()
  - Click the 'Try again' button (fireEvent.click)
  - Assert: reset was called exactly once

Test 3: "error.tsx includes error digest attribute when provided"
  - Same mocks as Test 1
  - Render with error = Object.assign(new Error('test error'), { digest: 'abc123' })
  - Assert: container has data-error-digest='abc123'

Test 4 (optional, only if lesson loading file is added): "lesson loading.tsx renders a spinner"
  - Mock Spinner component
  - Import and render default export from the lesson loading.tsx
  - Assert: spinner element is rendered
```

### Acceptance Criteria

- [ ] `src/app/(frontend)/error.tsx` exists with `'use client'` directive
- [ ] Uses `Button` from `@/ui/web/components/button` (not raw `<button>`)
- [ ] Uses `useTranslations('common.error')` from `@/ui/web/providers/I18n`
- [ ] Receives and uses `error` and `reset` props correctly
- [ ] Optional: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` exists (if we implement the optional enhancement)
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] All user-facing text comes from i18n translations (no hardcoded strings)

---

## Verification Commands

After all steps are complete, run:

```bash
# Type check
pnpm tsc --noEmit

# Unit tests
pnpm vitest run --config ./vitest.config.unit.mts tests/unit/i18n/error-translations.test.ts tests/unit/app/frontend/loading.test.tsx tests/unit/app/frontend/error.test.tsx

# Lint
pnpm lint
```

## Files Summary

| File | Status | Step |
|------|--------|------|
| `src/i18n/en.json` | MODIFIED | 1 |
| `src/i18n/he.json` | MODIFIED | 1 |
| `tests/unit/i18n/error-translations.test.ts` | NEW | 1 |
| `src/app/(frontend)/loading.tsx` | NEW | 2 |
| `tests/unit/app/frontend/loading.test.tsx` | NEW | 2 |
| `src/app/(frontend)/error.tsx` | NEW | 3 |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` | NEW (OPTIONAL) | 3 |
| `tests/unit/app/frontend/error.test.tsx` | NEW | 3 |

## Spec Requirement Traceability

| Requirement | Step | How Verified |
|-------------|------|--------------|
| Add `loading.tsx` to frontend routes | 2, 3 | File existence + render test |
| Add `error.tsx` to frontend routes | 3 | File existence + render test with reset |
| Optional lesson-route loading boundary | 3 | File existence + render test (if implemented) |
| Uses shadcn/ui Button component | 3 | Import assertion in test mock |
| Uses i18n translations for all user-facing text | 1, 3 | Translation key tests + render tests |
| Loading.tsx uses design tokens | 2 | Tailwind classes + `text-primary` assertion |
| TypeScript compilation passes | All | `pnpm tsc --noEmit` |
| Unit tests pass | All | `vitest run --config ./vitest.config.unit.mts ...` |
