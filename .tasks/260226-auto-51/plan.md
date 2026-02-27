# Plan: Loading and Error UI Enhancement

**Task ID**: 260226-auto-51
**Task Type**: implement_feature
**Spec Requirements**: FR-1, FR-2, FR-3

## Assumptions

- The `useTranslations` hook from `@/ui/web/providers/I18n` is already wrapped in the layout via `I18nProvider`, so client components in the route tree can use it.
- `error.tsx` receives `error` and `reset` props from Next.js error boundary pattern.
- Tests will validate component rendering, i18n key usage, and error recovery behavior.
- Unit tests will cover component rendering and retry behavior; a lightweight manual navigation smoke check will cover route-transition acceptance criteria.
- The lesson route is the "heaviest route" mentioned in FR-3: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/`.

---

## Step 1: Add i18n translation keys for loading and error states

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/i18n/en.json` (MODIFIED — add top-level `loading` and `error` keys)
- `src/i18n/he.json` (MODIFIED — add top-level `loading` and `error` keys)

**Exact Behavior**:
Add top-level `loading` and `error` namespaces in both translation files (matching the spec structure):

In `en.json`, add at root level:
```json
"loading": {
  "title": "Loading...",
  "description": "Please wait while the page loads"
},
"error": {
  "title": "Something went wrong",
  "description": "An error occurred while loading this page",
  "retry": "Try again"
}
```

In `he.json`, add at root level:
```json
"loading": {
  "title": "טוען...",
  "description": "אנא המתן בזמן שהדף נטען"
},
"error": {
  "title": "משהו השתבש",
  "description": "אירעה שגיאה בעת טעינת הדף",
  "retry": "נסה שוב"
}
```

**Tests** (1 test — validates both languages):
- **Test location**: `tests/unit/i18n/loading-error-keys.test.ts`
- **Test**: Import both `en.json` and `he.json`, assert that `loading.title`, `loading.description`, `error.title`, `error.description`, and `error.retry` exist as strings in both files.
- **FAIL before**: Keys don't exist yet → assertions fail.
- **PASS after**: Keys added → assertions pass.

**Acceptance Criteria**:
- [ ] `en.json` has `loading.title`, `loading.description`
- [ ] `en.json` has `error.title`, `error.description`, `error.retry`
- [ ] `he.json` has matching keys with Hebrew text
- [ ] Both JSON files are valid (parseable)

---

## Step 2: Create root `loading.tsx` with Spinner component

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/(frontend)/loading.tsx` (NEW)

**Exact Behavior**:
Create a client component that:
1. Uses `'use client'` directive
2. Imports `Spinner` from `@/ui/web/shared/Loading/Spinner`
3. Imports `useTranslations` from `@/ui/web/providers/I18n`
4. Gets translations with namespace `loading`
5. Renders a centered container (matches not-found.tsx pattern: `container py-28` with centered content)
6. Shows `<Spinner size="lg" variant="primary" />` centered
7. Shows `t('title')` as visible text below the spinner
8. Shows `t('description')` as a muted paragraph

**Component structure**:
```
<div className="container py-28">
  <div className="flex flex-col items-center justify-center gap-4">
    <Spinner size="lg" variant="primary" aria-label={t('title')} />
    <p className="text-base font-medium">{t('title')}</p>
    <p className="text-muted-foreground text-sm">{t('description')}</p>
  </div>
</div>
```

**Tests** (1-2 tests):
- **Test location**: `tests/unit/app/frontend/loading.test.tsx`
- **Test 1**: Render `Loading` component wrapped in a mock `I18nProvider`. Assert it renders a `role="status"` element (Spinner). Assert text "Loading..." appears in the document.
- **Test 2**: Assert the component renders without errors (no crash).
- **FAIL before**: File doesn't exist → import fails.
- **PASS after**: Component renders spinner and translated text.

**Acceptance Criteria**:
- [ ] `loading.tsx` exists at `src/app/(frontend)/loading.tsx`
- [ ] Has `'use client'` directive
- [ ] Renders `Spinner` component with `role="status"`
- [ ] Uses `useTranslations('loading')` for text
- [ ] Visually centered using flex layout with `container py-28`

---

## Step 3: Create root `error.tsx` with error boundary and retry

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/app/(frontend)/error.tsx` (NEW)

**Exact Behavior**:
Create a client component that:
1. Uses `'use client'` directive (required by Next.js for error.tsx)
2. Accepts `{ error, reset }` props (Next.js error boundary contract)
3. Imports `Button` from `@/ui/web/components/button`
4. Imports `useTranslations` from `@/ui/web/providers/I18n`
5. Gets translations with namespace `error`
6. Renders a centered container matching not-found.tsx pattern
7. Shows error title and description from i18n
8. Shows a "Try again" button that calls `reset()` on click
9. Optionally logs error to console in development via `useEffect`

**Component structure**:
```
<div className="container py-28">
  <div className="prose max-w-none">
    <h1 style={{ marginBottom: 0 }}>{t('title')}</h1>
    <p className="mb-4">{t('description')}</p>
  </div>
  <Button onClick={() => reset()} variant="default">
    {t('retry')}
  </Button>
</div>
```

**Props interface**:
```typescript
interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
```

**Tests** (2 tests):
- **Test location**: `tests/unit/app/frontend/error.test.tsx`
- **Test 1**: Render `ErrorPage` with mock `error` and `reset` props inside I18nProvider. Assert "Something went wrong" text appears. Assert "Try again" button exists.
- **Test 2**: Render, click "Try again" button, assert `reset` mock function was called once.
- **FAIL before**: File doesn't exist → import fails.
- **PASS after**: Component renders error message and retry button works.

**Acceptance Criteria**:
- [ ] `error.tsx` exists at `src/app/(frontend)/error.tsx`
- [ ] Has `'use client'` directive
- [ ] Accepts `error` and `reset` props
- [ ] Renders error title and description from i18n
- [ ] Renders a retry `Button` that calls `reset()` when clicked
- [ ] Matches `not-found.tsx` visual layout pattern (container, prose)

---

## Step 4: Create nested `loading.tsx` for lesson route (FR-3)

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` (NEW)

**Exact Behavior**:
Create a client component similar to the root loading.tsx but with a content-specific skeleton layout:
1. Uses `'use client'` directive
2. Imports `Spinner` from `@/ui/web/shared/Loading/Spinner`
3. Imports `Skeleton` from `@/ui/web/shared/Loading/Skeleton`
4. Imports `useTranslations` from `@/ui/web/providers/I18n`
5. Gets translations with namespace `loading`
6. Renders a centered spinner with translated loading title/description and skeleton content placeholders that resemble the lesson page layout (title skeleton, content skeleton blocks)

**Component structure**:
```
<div className="container py-28">
  <div className="flex flex-col items-center justify-center gap-4">
    <Spinner size="lg" variant="primary" aria-label={t('title')} />
    <p className="text-base font-medium">{t('title')}</p>
    <p className="text-muted-foreground text-sm">{t('description')}</p>
    <div className="w-full max-w-2xl space-y-4 mt-8">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" variant="text" />
      <Skeleton className="h-4 w-5/6" variant="text" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
</div>
```

**Tests** (1 test):
- **Test location**: `tests/unit/app/frontend/lesson-loading.test.tsx`
- **Test 1**: Render the lesson `Loading` component wrapped in I18nProvider. Assert it renders a `role="status"` element (Spinner), translated loading text (title or description), and multiple skeleton elements (at least 3 elements with `animate-pulse` class).
- **FAIL before**: File doesn't exist → import fails.
- **PASS after**: Component renders spinner + skeleton placeholders.

**Acceptance Criteria**:
- [ ] `loading.tsx` exists at the lesson route path
- [ ] Has `'use client'` directive
- [ ] Renders `Spinner` and multiple `Skeleton` elements
- [ ] Uses i18n translations for accessible labels
- [ ] Provides a content-specific skeleton layout (not just a spinner)

---

## Step 5: Validate TypeScript compilation and run all tests

**Time estimate**: 5 minutes

**Files to Touch**: None (validation only)

**Exact Behavior**:
1. Run `pnpm tsc --noEmit` to ensure all new files compile without TypeScript errors
2. Run the targeted new test files to confirm all new tests pass
3. Run `pnpm lint` to confirm no lint violations
4. Perform a manual smoke check in the browser for course → lesson → exercise navigation and verify loading UI appears (no blank state), then trigger an error boundary scenario and verify retry recovery UX.

**Tests**: All tests from Steps 1-4 must pass.

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes with no errors
- [ ] All unit tests pass
- [ ] `pnpm lint` passes (or only pre-existing warnings)
- [ ] No blank screens during page transitions (loading states shown)
- [ ] Error states display user-friendly messages instead of raw Next.js errors

---

## Test Infrastructure Notes

### Test Setup
All tests use `vitest` and `@testing-library/react`. The I18nProvider needs to be wrapped around components under test with English messages loaded from `src/i18n/en.json`.

### Test Helper Pattern
Create a shared render helper if one doesn't exist:
```typescript
import { I18nProvider } from '@/ui/web/providers/I18n'
import en from '@/i18n/en.json'

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <I18nProvider locale="en" messages={en}>
      {ui}
    </I18nProvider>
  )
}
```

### Test Commands
```bash
# Run all new tests
pnpm vitest run tests/unit/i18n/loading-error-keys.test.ts
pnpm vitest run tests/unit/app/frontend/loading.test.tsx
pnpm vitest run tests/unit/app/frontend/error.test.tsx
pnpm vitest run tests/unit/app/frontend/lesson-loading.test.tsx

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Summary of All Files

| File | Status | Step |
|------|--------|------|
| `src/i18n/en.json` | MODIFIED | 1 |
| `src/i18n/he.json` | MODIFIED | 1 |
| `src/app/(frontend)/loading.tsx` | NEW | 2 |
| `src/app/(frontend)/error.tsx` | NEW | 3 |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` | NEW | 4 |
| `tests/unit/i18n/loading-error-keys.test.ts` | NEW | 1 |
| `tests/unit/app/frontend/loading.test.tsx` | NEW | 2 |
| `tests/unit/app/frontend/error.test.tsx` | NEW | 3 |
| `tests/unit/app/frontend/lesson-loading.test.tsx` | NEW | 4 |
