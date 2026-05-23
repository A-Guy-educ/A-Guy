# Task 1576 — Phase 2: Brand-driven generateMetadata() across all routes

## What was done

**New file:** `src/infra/seo/pageMetadata.ts` — helper that produces Next.js Metadata objects from per-page overrides merged with brand defaults from `getBrand().config`.

**Refactored:** `src/infra/utils/mergeOpenGraph.ts` — now reads brand defaults from `getBrand().config` instead of hardcoded values.

**Refactored:** `src/app/(frontend)/layout.tsx` — converted static `export const metadata` to async `generateMetadata()` using brand config. Added `export const viewport` for themeColor (moved out of metadata to fix Next.js warning).

**Refactored 7 pages** to use `pageMetadata()`:
- `src/app/(frontend)/study/page.tsx`
- `src/app/(frontend)/practice/page.tsx`
- `src/app/(frontend)/study-plan/page.tsx`
- `src/app/(frontend)/courses/page.tsx`
- `src/app/(frontend)/ask/page.tsx`
- `src/app/(frontend)/search/page.tsx`
- `src/app/(frontend)/test/page.tsx`

**Tests added:**
- `tests/unit/infra/seo/pageMetadata.spec.ts` — unit tests for the helper (brand defaults, overrides, noIndex)
- `tests/e2e/seo-metadata-brand-driven.e2e.spec.ts` — Playwright E2E tests for resolved metadata on /, /study, /courses

## Key design decisions

- `pageMetadata()` uses `{ url: ogImage }` object form (not raw string) for openGraph and twitter images — required so callers can access `.url` on array elements without type errors.
- `viewport` export cannot be async in Next.js, so themeColor values are hardcoded (#91262C / #0f172a) matching the aguy brand config. A TODO comment flags this for Phase 3.
- `mergeOpenGraph()` includes a `fallbackOpenGraph` constant as defensive coding for the unlikely case where `getBrand()` returns null.
- Login/signup pages have no brand metadata leaks — login has `title: 'Log In'` only, signup has no metadata export.
