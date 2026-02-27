# Plan: Loading and Error Boundaries for Frontend Routes

**Task ID**: 260227-auto-46
**Task Type**: implement_feature
**Estimated Steps**: 4 (10-20 min each)

## Expert Review Notes

**Web Expert validation** confirmed:
- `loading.tsx` as `'use client'` works because `I18nProvider` in `layout.tsx` wraps `{children}`, so the context is always available.
- `RouteLoadingIndicator` (thin top-bar) and `loading.tsx` (Suspense spinner) are complementary and don't conflict.
- Use `min-h-[50vh]` instead of `min-h-screen` since Header/Footer are rendered by the layout.
- Use `size="lg"` or `size="xl"` for the Spinner to be visible as a full-page loading state.
- Do NOT expose `error.message` in UI (security risk) — only show generic translated messages.
- Pass translated `aria-label` to Spinner (don't rely on hardcoded English default).

## Assumptions

1. The Spinner component at `src/ui/web/shared/Loading/Spinner.tsx` is the canonical loading indicator (uses CVA, has `role="status"`, `aria-label` prop).
2. The i18n pattern from `not-found.tsx` is the reference: `'use client'` + `useTranslations('common.xxx')` from `@/ui/web/providers/I18n`.
3. The `Button` component from `@/ui/web/components/button` follows shadcn patterns and is the standard button.
4. New i18n keys go under the `common` namespace in `src/i18n/en.json` and `src/i18n/he.json`.
5. `loading.tsx` must be a client component since it uses `useTranslations` (which requires `useContext`).
6. Tests use vitest with `@testing-library/react`, `jsdom` environment (`// @vitest-environment jsdom` comment), and are in `tests/unit/`.

---

## Step 1: Add i18n Translation Keys for Loading and Error States

**Time**: ~10 min
**Spec refs**: FR-4

### Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `src/i18n/en.json` | MODIFIED | Add `common.loading` and `common.error` inside the existing `common` object (near `notFound` for discoverability) |
| `src/i18n/he.json` | MODIFIED | Add `common.loading` and `common.error` inside the existing `common` object (same structure as English) |

### Exact Behavior

Add two new sub-namespaces under `common`:

**`common.loading`** namespace:
- `label` — The accessible text shown next to spinner and used as Spinner aria-label

**`common.error`** namespace:
- `title` — Error page heading
- `message` — Error description text (generic, no exposed error details)
- `retry` — Retry button label
- `goHome` — Home link label

### English additions (en.json) — insert inside `common` object after `notFound`:

```json
"loading": {
  "label": "Loading..."
},
"error": {
  "title": "Something went wrong",
  "message": "An unexpected error occurred. Please try again.",
  "retry": "Try again",
  "goHome": "Go home"
}
```

### Hebrew additions (he.json) — insert inside `common` object after `notFound`:

```json
"loading": {
  "label": "טוען..."
},
"error": {
  "title": "משהו השתבש",
  "message": "אירעה שגיאה בלתי צפויה. אנא נסה שוב.",
  "retry": "נסה שוב",
  "goHome": "חזרה לדף הבית"
}
```

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/i18n/loading-error-keys.test.ts`

```
Test 1: "en.json should have common.loading.label key"
  - Import `src/i18n/en.json` directly in test (project pattern)
  - Traverse to common.loading.label
  - Expect it to equal "Loading..."
  - FAILS before: key doesn't exist → value is undefined

Test 2: "en.json should have all common.error keys (title, message, retry, goHome)"
  - Use imported en.json messages object
  - Traverse to common.error
  - Expect all four keys to be non-empty strings
  - FAILS before: common.error is undefined

Test 3: "he.json should have common.loading.label key"
  - Import `src/i18n/he.json` directly in test
  - Expect common.loading.label to be a non-empty string and not equal the English value (validates actual Hebrew)
  - FAILS before: key doesn't exist

Test 4: "he.json should have all common.error keys matching en.json structure"
  - Use imported en.json + he.json objects
  - Verify he.json has all keys that en.json has under common.error
  - Verify each value is a non-empty string
  - FAILS before: common.error doesn't exist in he.json
```

### Acceptance Criteria

- [x] `common.loading.label` exists in both en.json and he.json
- [x] `common.error.title`, `common.error.message`, `common.error.retry`, `common.error.goHome` exist in both files
- [x] Hebrew translations are actual Hebrew text (not English placeholders)

---

## Step 2: Create Loading States (`loading.tsx`)

**Time**: ~15 min
**Spec refs**: FR-1, FR-3, FR-4

### Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `src/app/(frontend)/loading.tsx` | NEW | Root frontend loading boundary |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` | NEW | Lesson route loading (FR-3) |
| `tests/unit/app/loading.test.tsx` | NEW | Tests for loading component |

### Exact Behavior

**`src/app/(frontend)/loading.tsx`** — Default export, client component:

```
'use client'

Imports:
- Spinner from '@/ui/web/shared/Loading/Spinner'
- useTranslations from '@/ui/web/providers/I18n'

Component:
- Call useTranslations('common.loading')
- Return:
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
    <Spinner size="lg" variant="muted" aria-label={t('label')} />
    <p className="text-sm text-muted-foreground">{t('label')}</p>
  </div>
```

Key design decisions:
- `min-h-[50vh]` instead of `min-h-screen` because Header/Footer from layout surround this
- `size="lg"` for page-level visibility (h-8 w-8)
- `variant="muted"` for subtle, non-dominant appearance
- `gap-4` for RTL-safe spacing between spinner and text
- Translated `aria-label` passed explicitly (not using hardcoded English default)

**`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx`** — Identical standalone copy of the root loading component. Cannot import from app router special files, so this is a duplicate. Same content as root `loading.tsx`.

**How it works**: Next.js automatically wraps `page.tsx` in a `<Suspense fallback={<Loading />}>` boundary when `loading.tsx` exists as a sibling. During SSR transitions, the loading component is shown as the fallback.

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/loading.test.tsx`

```
// @vitest-environment jsdom

Setup: Create a wrapper that renders I18nProvider with messages containing common.loading.label

Test 1: "loading.tsx renders Spinner with translated accessible label"
  - Render the Loading component inside I18nProvider with { common: { loading: { label: "Loading..." } } }
  - Expect element with role="status" to be in the document
  - Expect aria-label attribute to be "Loading..."
  - FAILS before: import of loading.tsx fails (file doesn't exist)

Test 2: "loading.tsx renders visible loading text"
  - Same setup as Test 1
  - Expect screen.getByText("Loading...") to be visible
  - FAILS before: file doesn't exist

Test 3: "loading.tsx is a client component"
  - Read src/app/(frontend)/loading.tsx as string via fs.readFileSync
  - Expect the file content to start with 'use client' (first non-empty line)
  - FAILS before: file doesn't exist

Test 4: "lesson loading.tsx exists and is a client component"
  - Read the lesson-level loading.tsx via fs.readFileSync
  - Expect file to exist and start with 'use client'
  - FAILS before: file doesn't exist
```

### Acceptance Criteria

- [x] `loading.tsx` shows Spinner component (role="status" element present)
- [x] `loading.tsx` uses i18n translations for "Loading..." text via `useTranslations('common.loading')`
- [x] `loading.tsx` uses the design system `Spinner` component with translated ARIA label
- [x] Loading state renders as centered spinner with visible text
- [x] Lesson route has its own `loading.tsx` (FR-3)
- [x] Both files are client components

---

## Step 3: Create Root Error Boundary (`error.tsx`)

**Time**: ~15 min
**Spec refs**: FR-2, FR-4

### Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `src/app/(frontend)/error.tsx` | NEW | Root error boundary |
| `tests/unit/app/error.test.tsx` | NEW | Tests for error component |

### Exact Behavior

**`src/app/(frontend)/error.tsx`** — Default export, client component:

```
'use client'

Imports:
- useEffect from 'react'
- Link from 'next/link'
- Button from '@/ui/web/components/button'
- useTranslations from '@/ui/web/providers/I18n'

Props: { error: Error & { digest?: string }, reset: () => void }

Component:
- useEffect(() => { console.error('Page error:', error) }, [error])
- Call useTranslations('common.error')
- Return:
  <div className="container py-28">
    <div className="prose max-w-none">
      <h1 style={{ marginBottom: 0 }}>{t('title')}</h1>
      <p className="mb-4">{t('message')}</p>
    </div>
    <div className="flex gap-3">
      <Button onClick={() => reset()}>
        {t('retry')}
      </Button>
      <Button asChild variant="outline">
        <Link href="/">{t('goHome')}</Link>
      </Button>
    </div>
  </div>
```

Key design decisions:
- Same layout pattern as `not-found.tsx` (container py-28, prose max-w-none) for visual consistency
- `style={{ marginBottom: 0 }}` on h1 to match not-found.tsx pattern
- Does NOT expose `error.message` to the user (security: could contain sensitive server info)
- Logs error to console for debugging via useEffect
- `reset()` is called on button click to re-render the route segment
- "Go home" link as secondary action with outline variant
- `flex gap-3` is RTL-safe

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/app/error.test.tsx`

```
// @vitest-environment jsdom

Setup: Create wrapper with I18nProvider containing common.error translations

Test 1: "error.tsx renders error title and message"
  - Provide messages: { common: { error: { title: "Something went wrong", message: "An unexpected error occurred. Please try again.", retry: "Try again", goHome: "Go home" } } }
  - Render ErrorPage with error={new Error('test')} and reset={vi.fn()}
  - Expect screen.getByText("Something went wrong") to be in the document
  - Expect screen.getByText("An unexpected error occurred. Please try again.") to be in the document
  - FAILS before: file doesn't exist, import fails

Test 2: "error.tsx renders retry button that calls reset()"
  - Same setup as Test 1
  - const resetMock = vi.fn()
  - Render with reset={resetMock}
  - fireEvent.click(screen.getByText("Try again"))
  - Expect resetMock to have been called once
  - FAILS before: file doesn't exist

Test 3: "error.tsx renders go home link pointing to /"
  - Same setup
  - const link = screen.getByText("Go home").closest('a')
  - Expect link to have attribute href="/"
  - FAILS before: file doesn't exist

Test 4: "error.tsx is a client component"
  - Read src/app/(frontend)/error.tsx as string
  - Expect first line to contain 'use client'
  - FAILS before: file doesn't exist

Test 5: "error.tsx logs error to console on mount"
  - const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  - Render with error={new Error('test error')}
  - Expect console.error to have been called
  - Restore spy
  - FAILS before: file doesn't exist

Test 6: "error.tsx does NOT render the raw error message in the DOM"
  - Render with error={new Error('sensitive-server-info-xyz')}
  - Expect screen.queryByText('sensitive-server-info-xyz') to be null
  - This validates we don't expose error.message in UI (security)
  - FAILS before: file doesn't exist
```

### Acceptance Criteria

- [x] `error.tsx` displays translated error title and description
- [x] `error.tsx` provides retry button using `reset()` prop
- [x] `error.tsx` is a client component (`'use client'` directive)
- [x] `error.tsx` uses i18n translations for all visible text
- [x] Retry button calls `reset()` to re-render the page
- [x] "Go home" link navigates to `/`
- [x] Raw error message is NOT exposed in the DOM (security)
- [x] Error is logged to console for debugging

---

## Step 4: Validate Runtime App Router Behavior (Navigation + Error Fallback)

**Time**: ~10 min
**Spec refs**: FR-1, FR-2, AC: loading appears before content is ready, graceful fallback shown instead of raw Next.js error

### Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `.tasks/260227-auto-46/plan.md` | MODIFIED | Add explicit runtime verification gate to close spec coverage gap not fully provable with isolated unit tests |

### Exact Behavior

Perform manual verification in local dev (`pnpm dev`) because Next.js route segment loading/error boundaries are runtime framework behavior:

1. Navigate between frontend pages (for example `/courses` → `/courses/[courseSlug]`)
   - Confirm root `loading.tsx` renders spinner + translated text while server components stream.
2. Navigate to a lesson route (`/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]`)
   - Confirm lesson-specific `loading.tsx` appears before lesson content is ready.
3. Trigger an uncaught error in frontend route tree (dev-only validation path)
   - Confirm `src/app/(frontend)/error.tsx` fallback renders translated title/message + retry button.
   - Confirm clicking retry invokes `reset()` and attempts re-render.
4. Validate no raw Next.js crash output is shown to users in the route UI fallback.

### Acceptance Criteria

- [x] Runtime navigation shows loading fallback before content is ready
- [x] Runtime route errors show translated graceful fallback (not raw framework error screen)
- [x] Retry action in runtime context attempts route segment re-render

---

## File Summary

| File | Action | Step |
|------|--------|------|
| `src/i18n/en.json` | MODIFIED | 1 |
| `src/i18n/he.json` | MODIFIED | 1 |
| `tests/unit/i18n/loading-error-keys.test.ts` | NEW | 1 |
| `src/app/(frontend)/loading.tsx` | NEW | 2 |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading.tsx` | NEW | 2 |
| `tests/unit/app/loading.test.tsx` | NEW | 2 |
| `src/app/(frontend)/error.tsx` | NEW | 3 |
| `tests/unit/app/error.test.tsx` | NEW | 3 |
| `manual runtime verification (no artifact file)` | EXECUTED | 4 |

## Quality Gates

After all steps, run:
1. `pnpm vitest run tests/unit/i18n/loading-error-keys.test.ts` — all pass
2. `pnpm vitest run tests/unit/app/loading.test.tsx` — all pass
3. `pnpm vitest run tests/unit/app/error.test.tsx` — all pass
4. `pnpm -s tsc --noEmit` — no type errors
5. `pnpm -s lint` — no lint errors
6. Manual runtime check in `pnpm dev` for loading/error boundaries across navigation and thrown error path

## Test Dependencies for Build Agent

The test files use:
- `// @vitest-environment jsdom` comment directive for React component tests (Steps 2 & 3)
- `@testing-library/react` for `render`, `screen`, `fireEvent`
- `vitest` for `describe`, `it`, `expect`, `vi`
- `I18nProvider` from `@/ui/web/providers/I18n` to wrap components needing translations
- `node:fs` only for asserting `'use client'` presence in special route files (Steps 2, 3)
- Step 1 tests use direct JSON imports (no fs/path traversal needed)
- Step 4 is manual runtime verification (framework behavior)

## Spec Requirement Traceability

| Requirement | Step | Test File | Key Tests |
|-------------|------|-----------|-----------|
| FR-1: Root Loading State | Steps 2, 4 | `tests/unit/app/loading.test.tsx` + manual runtime check | Unit Tests 1-3 + runtime nav verification |
| FR-2: Root Error Boundary | Steps 3, 4 | `tests/unit/app/error.test.tsx` + manual runtime check | Unit Tests 1-6 + runtime fallback verification |
| FR-3: Lesson Route Loading | Steps 2, 4 | `tests/unit/app/loading.test.tsx` + manual runtime check | Unit Test 4 + lesson route runtime verification |
| FR-4: i18n Support | Steps 1-3 | All test files | i18n key tests + translated UI assertions |
