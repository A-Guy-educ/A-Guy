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

1. **Create the brand folder** under `src/brands/<slug>/`
2. **Implement the `Brand` interface** in `src/brands/<slug>/index.ts`
3. **Add the brand to the map** in `src/brands/index.ts`
4. **Add the slug** to the `BrandSlug` union in `src/brands/types.ts`
5. **Add `NEXT_PUBLIC_BRAND=<slug>`** to `.env.example`
6. **Add unit tests** in `tests/unit/brands.test.ts`

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
