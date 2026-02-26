# Plan: Loading and Error UI for Frontend Routes

**Task ID**: 260226-auto-51
**Task Type**: implement_feature
**Estimated Total Time**: 30–45 minutes (3 steps)

## Assumptions

- The project uses `next-intl` for i18n (confirmed by `useTranslations` usage across codebase)
- The `I18nProvider` wraps all frontend content in the layout (confirmed in `src/app/(frontend)/layout.tsx:94`)
- The existing `Spinner` component at `src/infra/loading/components/Spinner.tsx` should be reused for consistency
- The `Button` component at `src/ui/web/components/button.tsx` is the standard design-system button
- The lesson route exists at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (confirmed)
- Tests use `@testing-library/react` with vitest and `I18nProvider` wrapper pattern (confirmed in `CourseCard.test.tsx`)

---

## Step 1: Add i18n translations for error messages (NFR-1)

**Time**: ~5 minutes

### Files to Touch

- `src/i18n/en.json` (MODIFIED — add `common.error` object around line 6–32)
- `src/i18n/he.json` (MODIFIED — add `common.error` object around line 6–32)

### Exact Behavior

Add nested keys under the existing `common` namespace in both locale files:

**English** (`en.json`):
```json
"error": {
  "title": "Something went wrong",
  "retryButton": "Try again"
}
```

**Hebrew** (`he.json`):
```json
"error": {
  "title": "משהו השתבש",
  "retryButton": "נסה שוב"
}
```

These keys sit alongside existing `common.languageSwitcher`, `common.notFound`, etc.

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/i18n/error-translations.test.ts` (NEW)

1. **Test: English error translations exist**
   - Import `en.json`, assert `en.common.error.title === 'Something went wrong'`
   - Assert `en.common.error.retryButton === 'Try again'`
   - FAILS before: `common.error` is `undefined`

2. **Test: Hebrew error translations exist**
   - Import `he.json`, assert `he.common.error.title === 'משהו השתבש'`
   - Assert `he.common.error.retryButton === 'נסה שוב'`
   - FAILS before: `common.error` is `undefined`

### Acceptance Criteria

- [x] `common.error.title` and `common.error.retryButton` exist in `en.json`
- [x] `common.error.title` and `common.error.retryButton` exist in `he.json`
- [x] Both unit tests pass
- [x] No existing i18n keys are removed or modified

---

## Step 2: Create root loading.tsx and error.tsx (FR-1, FR-2, NFR-2, NFR-3)

**Time**: ~15 minutes

### Files to Touch

- `src/app/(frontend)/loading.tsx` (NEW)
- `src/app/(frontend)/error.tsx` (NEW)

### Exact Behavior

**`loading.tsx`** — Server component (default export):
- Renders a centered container (`flex items-center justify-center min-h-[50vh]`)
- Uses the existing `Spinner` component from `@/infra/loading/components/Spinner` with `size="lg"` for visibility
- This acts as the Next.js Suspense fallback during SSR/streaming for the entire `(frontend)` route group
- Works alongside the existing `RouteLoadingIndicator` (top progress bar for client nav)

**`error.tsx`** — Client component (`'use client'`):
- Receives `{ error: Error & { digest?: string }; reset: () => void }` props (Next.js error boundary interface)
- Uses `useTranslations('common.error')` to get localized text
- Renders:
  - Outer `<div>` with `role="alert"` and `aria-live="polite"` (NFR-2: accessibility)
  - `<h2>` displaying `t('title')`
  - `<Button>` from `@/ui/web/components/button` with `variant="default"` and `onClick={reset}`, displaying `t('retryButton')`
- Layout: centered flex column with `min-h-[50vh]` and `gap-4`

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/frontend-loading.test.tsx` (NEW)

1. **Test: loading.tsx renders a spinner**
   - Import `Loading` from `@/app/(frontend)/loading`
   - Render inside jsdom environment
   - Assert an element with `role="status"` exists (the Spinner component has `role="status"`)
   - Assert an element with `aria-label="Loading"` exists
   - FAILS before: file doesn't exist, import fails

**Test file**: `tests/unit/app/frontend-error.test.tsx` (NEW)

2. **Test: error.tsx renders error message with i18n and accessibility**
   - Import `Error` from `@/app/(frontend)/error`
   - Render inside `<I18nProvider locale="en" messages={enMessages}>` with mock `error` and `reset` fn
   - Assert `role="alert"` container exists
   - Assert `aria-live="polite"` attribute is present
   - Assert text "Something went wrong" is visible (from en translations)
   - Assert a button with text "Try again" is visible
   - FAILS before: file doesn't exist, import fails

3. **Test: error.tsx retry button calls reset**
   - Render error component with a mock `reset` function
   - Click the "Try again" button
   - Assert `reset` was called exactly once
   - FAILS before: file doesn't exist, import fails

### Acceptance Criteria

- [x] `src/app/(frontend)/loading.tsx` exports a default component that renders a spinner
- [x] `src/app/(frontend)/error.tsx` exports a default client component
- [x] Error component has `role="alert"` and `aria-live="polite"` (NFR-2)
- [x] Error component uses `useTranslations('common.error')` for i18n (NFR-1)
- [x] Error component uses `Button` from design system (NFR-3)
- [x] Retry button calls `reset()` to recover from error
- [x] All 3 tests pass
- [x] `pnpm tsc --noEmit` passes

---

## Step 3: Create lesson-level loading.tsx (FR-3)

**Time**: ~10 minutes

### Files to Touch

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` (NEW)

### Exact Behavior

- Server component (default export)
- Provides a lesson-specific loading skeleton that is more informative than the generic spinner
- Renders a centered container with the `Spinner` component from `@/infra/loading/components/Spinner` with `size="lg"`
- This file ensures the heaviest route (lesson pages with PDF viewer, exercises, chat) has its own Suspense boundary so navigation feels snappy
- Structurally similar to the root loading.tsx but scoped to the lesson route segment

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/lesson-loading.test.tsx` (NEW)

1. **Test: lesson loading.tsx renders a spinner**
   - Import `Loading` from the lesson loading path
   - Render inside jsdom
   - Assert an element with `role="status"` exists (Spinner has `role="status"`)
   - FAILS before: file doesn't exist, import fails

2. **Test: lesson loading.tsx is a valid React component**
   - Import and verify it renders without throwing
   - Assert the rendered output contains a container element
   - FAILS before: file doesn't exist, import fails

### Acceptance Criteria

- [x] `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` exists and exports default
- [x] Uses the existing `Spinner` component for consistency
- [x] Both tests pass
- [x] `pnpm tsc --noEmit` passes

---

## Final Verification

After all steps complete, run:

```bash
pnpm tsc --noEmit          # TypeScript check — no errors
pnpm vitest run tests/unit/i18n/error-translations.test.ts tests/unit/app/frontend-loading.test.tsx tests/unit/app/frontend-error.test.tsx tests/unit/app/lesson-loading.test.tsx  # All tests pass
pnpm lint                   # No lint errors in new files
```

## Summary of All New Files

| File | Type | Spec Req |
|------|------|----------|
| `src/app/(frontend)/loading.tsx` | NEW | FR-1 |
| `src/app/(frontend)/error.tsx` | NEW | FR-2, NFR-1, NFR-2, NFR-3 |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` | NEW | FR-3 |
| `src/i18n/en.json` | MODIFIED | NFR-1 |
| `src/i18n/he.json` | MODIFIED | NFR-1 |
| `tests/unit/i18n/error-translations.test.ts` | NEW | Test |
| `tests/unit/app/frontend-loading.test.tsx` | NEW | Test |
| `tests/unit/app/frontend-error.test.tsx` | NEW | Test |
| `tests/unit/app/lesson-loading.test.tsx` | NEW | Test |

## Key Implementation Notes for Build Agent

1. **Reuse existing Spinner**: Import from `@/infra/loading/components/Spinner` — do NOT create a new spinner with raw CSS. The existing component already has proper `role="status"` and `aria-label="Loading"` attributes.

2. **Button import path**: Use `import { Button } from '@/ui/web/components/button'` — this is the project's shadcn/ui button.

3. **i18n JSON editing**: Only ADD the `error` key inside the existing `common` object. Do NOT rewrite the entire file. Use surgical edits.

4. **error.tsx MUST be client component**: Add `'use client'` directive at the top. This is required by Next.js for error boundaries.

5. **Test environment**: All `.test.tsx` files need `// @vitest-environment jsdom` comment at top to enable DOM APIs.

6. **Test wrapper pattern**: Follow the pattern in `CourseCard.test.tsx` — wrap components in `<I18nProvider locale="en" messages={enMessages}>`.

7. **No import map regeneration needed**: These are app route files and i18n files, not Payload admin components.
