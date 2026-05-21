# Phase 4: BrandLogo Component — Handoff Notes

## What was done

- **Brand contract extended** (`src/brands/types.ts`): Added `Logo: ComponentType<SVGProps<SVGSVGElement>>` to the `Brand` interface.
- **Logo component created** (`src/brands/aguy/components/Logo.tsx`): Inline SVG React component mirroring the old TelescopeLogo JSX (div + svg + span "Aguy"). The telescope.svg was copied to `src/brands/aguy/assets/telescope.svg`.
- **aguyBrand wired** (`src/brands/aguy/index.ts`): `aguyBrand.Logo = Logo`.
- **BrandLogo consumer** (`src/ui/web/BrandLogo.tsx`): `'use client'` component that calls `getBrand().Logo` and renders it.
- **All TelescopeLogo usages replaced** with BrandLogo in: header (Component.client.tsx), footer (Component.tsx), Logo/Logo.tsx, ExerciseHeader/index.tsx.
- **LoginForm.tsx** updated to import telescope.svg from `@/brands/aguy/assets/telescope.svg` (raw asset still used there since it needs next/image dimensions for the large login logo).
- **TelescopeLogo directory deleted** (`src/ui/web/TelescopeLogo/`).
- **README.md** updated to list BrandLogo.tsx instead of TelescopeLogo/.

## Failing test
- `tests/unit/brands.test.ts` now includes `getBrand().Logo is a React component` — previously failed (brand.Logo was undefined), now passes.

## Verification
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm test:unit` (brands.test.ts) — 9/9 passed
- No remaining TelescopeLogo imports in src/

## Follow-up (low priority)
LoginForm still uses the raw telescope.svg via next/image rather than BrandLogo — see `.kody/tasks/1578/followups.json`.
