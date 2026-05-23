# Brand Bundle Contract

A **brand bundle** is a typed package of static configuration, assets, and (in future phases) React components that represent a single product identity within a multi-brand deployment.

## What a brand bundle owns

- Static config — name, legal name, host URL, locale, default SEO metadata, theme colors, social handles
- Static assets — logo SVG, favicon SVG, default OG image
- Component overrides (future phases) — LandingPage, StartPage, CourseCard variant
- i18n message overrides (future phases) — brand-specific translations

A brand bundle does **not** own editable content (blog posts, course data, lesson content). Those live in Payload.

---

## Required exports

### `config: BrandConfig` (current phase)

A plain object conforming to the `BrandConfig` interface. See [types.ts](./types.ts) for the full shape.

### `Brand` interface (current phase)

```ts
export interface Brand {
  config: BrandConfig
}
```

---

## Future required exports

The following are not yet required, but when adding a new brand, **leave a `TODO` comment** in each slot so future phases know where to fill in:

```ts
// Logo: ComponentType   // Phase 4 — custom logo component
// pages: {               // Phase 4 — custom page components
//   LandingPage: ComponentType
//   StartPage: ComponentType
// }
// components: {          // Phase 4+ — variant components
//   CourseCard: ComponentType
// }
// messages: {             // Phase 5 — brand i18n overrides
//   en: Record<string, string>
//   he: Record<string, string>
// }
```

---

## How to add a new brand

The brand bundle uses a **separate database per brand** (Model A). See
[docs/architecture/MULTI-BRAND.md](../../docs/architecture/MULTI-BRAND.md) for the full
decision record.

### Prerequisites

Before adding a brand, confirm:

- [ ] You have access to a new MongoDB Atlas cluster for the brand's data
- [ ] You have a new Vercel project (or environment) for the brand's deployment
- [ ] You have the brand's domain DNS configured

### Runbook

**Step 1 — Create the brand directory**

```bash
mkdir -p src/brands/<brand-slug>/components
mkdir -p src/brands/<brand-slug>/assets
mkdir -p src/brands/<brand-slug>/messages
```

Use a slug that matches `/^[a-z][a-z0-9-]+$/` (e.g., `acme`, `brand-b`).

**Step 2 — Define brand config**

Create `src/brands/<brand-slug>/config.ts` following `src/brands/aguy/config.ts` as a
template. Implement the `BrandConfig` interface from `src/brands/types.ts`.

Required fields: `slug`, `name`, `legalName`, `host`, `supportEmail`, `locale`,
`defaultTitle`, `titleTemplate`, `description`, `shortDescription`, `keywords`,
`author`, `themeColor`, `social`, `ogImage`, `appleWebApp`.

**Step 3 — Create the Logo component**

Create `src/brands/<brand-slug>/components/Logo.tsx` exporting a React SVG component.
Follow the pattern in `src/brands/aguy/components/Logo.tsx`.

**Step 4 — Create i18n message files**

Create `src/brands/<brand-slug>/messages/en.json` and
`src/brands/<brand-slug>/messages/he.json`. These can start as copies of the `aguy`
messages, then be customized per brand.

**Step 5 — Create the brand bundle entry point**

Create `src/brands/<brand-slug>/index.ts`:

```ts
import type { Brand } from '../types'
import { <brandSlug>Config } from './config'
import { Logo } from './components/Logo'

import en from './messages/en.json'
import he from './messages/he.json'

export const <brandSlug>Brand: Brand = {
  config: <brandSlug>Config,
  Logo,
  messages: { en, he },
}
```

**Step 6 — Add the slug to the BrandSlug union**

In `src/brands/types.ts`, add the new slug to the `BrandSlug` union:

```ts
export type BrandSlug = 'aguy' | '<brand-slug>'
```

**Step 7 — Register the brand in the brands map**

In `src/brands/index.ts`, add the new brand to the `brands` record.
The `as const satisfies Record<BrandSlug, Brand>` guard will catch a missing slug
from the union at compile time.

```ts
import { <brandSlug>Brand } from './<brand-slug>'

const brands = {
  aguy: aguyBrand,
  '<brand-slug>': <brandSlug>Brand,
} as const satisfies Record<BrandSlug, Brand>
```

**Step 8 — Add unit tests**

Add tests in `tests/unit/brands.test.ts` for the new brand's slug resolution.
At minimum, add a test that confirms `getBrand().config.slug` equals the new slug
when `NEXT_PUBLIC_BRAND='<brand-slug>'`.

**Step 9 — Add to .env.example**

Add `NEXT_PUBLIC_BRAND=<brand-slug>` to `.env.example` with a comment describing the
brand.

**Step 10 — Configure CI environment**

In `.github/workflows/ci.yml`, ensure the e2e-gate job's env block includes
`NEXT_PUBLIC_BRAND: <brand-slug>` so that the brand smoke test resolves correctly
in CI.

**Step 11 — Verify locally**

```bash
NEXT_PUBLIC_BRAND=<brand-slug> pnpm dev
# Navigate to http://localhost:3000
# - Title should contain the new brand name
# - og:site_name should match
# - theme-color meta tag should match themeColor.light
# - /manifest.webmanifest should return JSON with the new brand name
```

**Step 12 — Deploy**

Set `NEXT_PUBLIC_BRAND=<brand-slug>` as an environment variable in the new brand's
Vercel project settings. Set `DATABASE_URL` to the new brand's MongoDB cluster.

---

## Environment variable

| Variable            | Default | Description                       |
| ------------------- | ------- | --------------------------------- |
| `NEXT_PUBLIC_BRAND` | `aguy`  | Brand slug to activate at runtime |

Valid values: `aguy`

Unknown values fail the build in non-production environments and fall back to `aguy` in production.

---

## Phases 2–7 context

This file is part of a 7-phase refactor. See the parent issue [#1575](https://github.com/A-Guy-educ/A-Guy/issues/1575) for the full milestone plan:

- **Phase 2** — Migrate hardcoded SEO strings to `getBrand()`
- **Phase 3** — Move favicon/manifest assets into brand bundle
- **Phase 4** — Logo component refactor + custom page components
- **Phase 5** — i18n brand string extraction
- **Phase 6** — Remaining hardcoded string migrations
- **Phase 7** — Course data scope decision + smoke test
