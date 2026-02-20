# Error Boundary Implementation Plan (Detailed)

## Problem

When a JavaScript error occurs during rendering/navigation, React unmounts the entire component tree, resulting in a white blank page. The console shows "Minified React error #130" (or similar), and the user sees nothing — no header, no footer, no way to recover.

## Root Cause

The Next.js `(frontend)` route group has **zero `error.tsx` files**. Without these, any rendering error propagates all the way to `global-error.tsx`, which:

1. Renders outside the layout (no header/footer/theme/i18n)
2. Has minimal unstyled UI (just "Something went wrong!" text)
3. Effectively looks like a white/blank page to users

## Architecture

```
Error propagation chain (current):

  Page component throws error
        |
  No error.tsx at (frontend)/ level  <-- GAP
        |
  global-error.tsx (bare html/body, no layout)
        |
  User sees: white page with tiny text

Error propagation chain (after fix):

  Page component throws error
        |
  (frontend)/error.tsx  <-- NEW: catches inside layout
  - Header/footer remain visible
  - Styled error UI with retry/home buttons
  - Sentry reporting
        |
  (only if layout itself throws)
        |
  global-error.tsx (improved styling)
```

## Changes

### File 1: `src/i18n/en.json` (EDIT)

**Location**: After `common.notFound` block (line 23), add `common.error`:

```json
    "error": {
      "title": "Something went wrong",
      "message": "An unexpected error occurred. Please try again.",
      "tryAgain": "Try again",
      "goHome": "Go home"
    },
```

**Exact edit**: Insert after line 23 (closing `}` of `notFound`), before line 24 (`"header"`).

---

### File 2: `src/i18n/he.json` (EDIT)

**Location**: After `common.notFound` block (line 16), add `common.error`:

```json
    "error": {
      "title": "משהו השתבש",
      "message": "אירעה שגיאה בלתי צפויה. אנא נסה שוב.",
      "tryAgain": "נסה שוב",
      "goHome": "חזרה לדף הבית"
    },
```

**Exact edit**: Insert after line 16 (closing `}` of `notFound`), before line 17 (`"header"`).

---

### File 3: `src/app/(frontend)/error.tsx` (CREATE)

**Why `'use client'`**: Next.js requires `error.tsx` to be a Client Component.

**Why i18n works**: This renders inside the layout, so `I18nProvider` is available as a parent. The `useTranslations` hook from `@/ui/web/providers/I18n` will work correctly.

**Why Sentry works**: `@sentry/nextjs` is installed (v10.32.1) and client-side Sentry is initialized in `src/infra/instrumentation-client.ts`.

```tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import React, { useEffect } from 'react'

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

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="container py-28">
      <div className="prose max-w-none">
        <h1 style={{ marginBottom: 0 }}>{t('title')}</h1>
        <p className="mb-4">{t('message')}</p>
      </div>
      <div className="flex gap-4">
        <Button variant="default" onClick={() => reset()}>
          {t('tryAgain')}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t('goHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
```

**Design decisions**:

- **Matches `not-found.tsx` exactly**: Same container/padding (`container py-28`), same prose wrapper, same heading style
- **Two buttons**: "Try again" (primary, calls `reset()`) and "Go home" (outline, navigates to `/`)
- **`flex gap-4`**: Buttons side by side with spacing
- **Sentry in `useEffect`**: Reports error on mount, same pattern as existing `global-error.tsx`
- **No error details shown to user**: Sentry gets the full error silently

---

### File 4: `src/app/global-error.tsx` (EDIT — full replacement)

**Why inline styles only**: This renders when the layout itself crashes — CSS/Tailwind may not be loaded. Must use inline styles exclusively.

**Why no i18n**: `I18nProvider` is part of the layout, which has crashed. Must use hardcoded strings (English as universal fallback).

**Why `<a>` not `<Link>`**: Next.js router may be broken if the layout crashed. Plain HTML anchor is the safe choice.

Replace entire file content with:

```tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '400px' }}>
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 24px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: '#000',
                border: '1px solid #ccc',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
```

**Changes from current `global-error.tsx`**:

- Removed unused `import Error from 'next/error'`
- Vertically centered layout (`min-height: 100vh`, flexbox)
- Added descriptive paragraph text
- Added "Go home" link (plain `<a>` tag, not `<Link>`)
- Better button styling
- Uses `system-ui` font stack as fallback

---

## Files Summary

| #   | File                           | Action | Lines Changed                    |
| --- | ------------------------------ | ------ | -------------------------------- |
| 1   | `src/i18n/en.json`             | Edit   | +6 (add `common.error` block)    |
| 2   | `src/i18n/he.json`             | Edit   | +6 (add `common.error` block)    |
| 3   | `src/app/(frontend)/error.tsx` | Create | ~42 lines                        |
| 4   | `src/app/global-error.tsx`     | Edit   | Replace ~29 lines with ~68 lines |

**Total**: 4 files, ~120 lines added/changed.

## Dependencies

- No new packages needed
- Uses existing: `@sentry/nextjs`, `@/ui/web/components/button`, `@/ui/web/providers/I18n`

## What Stays the Same

- Layout structure (`src/app/(frontend)/layout.tsx`) — untouched
- Sentry configuration — untouched
- Payload admin panel — unaffected (separate route group)
- Existing `ErrorBoundary` in `exerciserenderer/` — untouched (can be cleaned up separately)
- No new dependencies

## How Next.js `error.tsx` Works

1. Next.js automatically wraps the `{children}` slot in the parent `layout.tsx` with a React Error Boundary
2. When any child component (page, nested layout) throws during rendering, `error.tsx` catches it
3. The **layout itself** (header, footer, providers) stays mounted — only `{children}` is replaced with the error UI
4. `reset()` function re-renders the errored segment, allowing recovery without full page reload
5. If the **layout itself** throws, the error bypasses `error.tsx` and hits `global-error.tsx`

## Validation Steps

### Type Check

```bash
pnpm tsc --noEmit
```

### Lint Check

```bash
pnpm lint
```

### Manual Testing

1. `pnpm dev` — start dev server
2. Navigate to any frontend page
3. Temporarily add `throw new Error('test error boundary')` inside a page component, or trigger a real error
4. **Verify**: Error page appears with header/footer still visible
5. **Verify**: "Try again" button re-renders the page
6. **Verify**: "Go home" navigates to `/`
7. **Verify**: Sentry receives the error event (check Sentry dashboard or browser Network tab for Sentry requests)

## Edge Cases Considered

| Scenario                          | Handled By                                        |
| --------------------------------- | ------------------------------------------------- |
| Page component throws             | `(frontend)/error.tsx` — styled, inside layout    |
| Layout throws                     | `global-error.tsx` — inline-styled, standalone    |
| CSS fails to load                 | `global-error.tsx` uses inline styles only        |
| I18n provider crashes             | `global-error.tsx` uses hardcoded English strings |
| Error during recovery (`reset()`) | Error boundary catches again, stays on error page |
| Server-side rendering error       | Next.js built-in server error handling + Sentry   |
