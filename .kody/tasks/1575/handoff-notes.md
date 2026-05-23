# Phase 1 Brand Bundle Scaffold — Handoff Notes

## What was done

Created the complete brand bundle scaffold under `src/brands/` with no existing code modified:

- `src/brands/types.ts` — `Brand` interface, `BrandConfig` interface, `BrandSlug = 'aguy'` union
- `src/brands/aguy/config.ts` — A-Guy brand constants extracted from `src/app/(frontend)/layout.tsx` metadata
- `src/brands/aguy/index.ts` — Brand bundle entry exporting `{ config: aguyConfig }`
- `src/brands/index.ts` — `getBrand()` and `getBrandSlug()` resolvers; unknown brand throws in non-prod, falls back to 'aguy' in prod
- `src/brands/README.md` — Contract documentation with future export slots, how-to-add-a-brand guide, env var table
- `.env.example` — Added `NEXT_PUBLIC_BRAND=aguy` with comment
- `tests/unit/brands.test.ts` — 7 test cases covering: default return, slug equality, unknown-throws-dev/test, fallback-in-prod, explicit-aguy, getBrandSlug

## Key decisions

- Used `as const satisfies Record<BrandSlug, Brand>` to enforce exhaustive brand map at compile time
- Used `Object.defineProperty(process.env, 'NODE_ENV', { value: ... })` to override read-only `NODE_ENV` in tests (Vitest blocks direct assignment)
- No Zod env schema update needed — `NEXT_PUBLIC_BRAND` is a Payload-ignored runtime switch

## Verification

`pnpm ci:local` (typecheck + lint + test) passes cleanly on attempt 2.

## Out of scope (handled in Phases 2–7)

All hardcoded brand strings in existing files remain untouched. Phases 2–6 will progressively migrate them to `getBrand()`.
