# Phase 7 Implementation Notes

## What was done

1. **Decision doc** (`docs/architecture/MULTI-BRAND.md`) — Documented Model A (separate MongoDB per brand), covering storage model, user identity (no cross-brand users, independent accounts, independent OAuth), content strategy (no shared courses, manual export/import), and operational topology (separate Vercel projects, per-brand secrets). Signed off by @aguyaharonyair recorded in the doc.

2. **Dynamic manifest route** (`src/app/(frontend)/manifest.webmanifest/route.ts`) — GET handler returning brand-specific manifest JSON from `getBrand().config`. Replaces the static `public/manifest.json` which could not be brand-aware.

3. **Layout metadata** (`src/app/(frontend)/layout.tsx`) — Added `manifest: '/manifest.webmanifest'` to `generateMetadata()` icons section. No other layout changes.

4. **Brand smoke test** (`tests/e2e/brand-identity/brand-identity.e2e.spec.ts`) — 6 assertions: title contains brand name, og:site_name, themeColor meta, favicon 200, manifest returns brand name, header logo SVG present. No auth required.

5. **Playwright gate config** (`playwright.e2e-gate.config.ts`) — Added `brand-identity/brand-identity.e2e.spec.ts` to `testMatch` array.

6. **Brand resolver unit tests** (`tests/unit/brands-resolver.test.ts`) — Covers: production fallback for unknown/empty `NEXT_PUBLIC_BRAND`, Brand interface field completeness (slug through appleWebApp, Logo is function, messages.en/he), hex color validation for themeColor, URL validation for host, BCP-47 validation for locale, BrandSlug union type enforcement via `satisfies` pattern documentation.

7. **Brands README** (`src/brands/README.md`) — Expanded "How to add a new brand" from 6 steps to 12-step numbered runbook with DNS, Vercel, CI env, and deployment instructions. Cross-references `docs/architecture/MULTI-BRAND.md`.

8. **CI workflow** (`.github/workflows/ci.yml`) — Added `NEXT_PUBLIC_BRAND: aguy` to the e2e-gate job's env block.

## Verified

`pnpm typecheck`, `pnpm lint`, unit tests all passed (verification attempt 1/4).

## No blockers

`src/brands/` already existed on this branch (Phases 1–6 were already merged), so no cross-branch dependency issue.
