Phase 3 of the brand-bundle refactor is complete. Moved favicon, manifest, and theme tokens into the brand bundle.

Key changes:
- `src/brands/aguy/assets/` — favicon.ico and favicon.svg copied from /public
- `src/app/(frontend)/favicon.ico/route.ts` and `favicon.svg/route.ts` — dynamic routes reading from brand bundle
- `src/app/(frontend)/apple-icon.png/route.ts` — serves favicon.svg as fallback (no dedicated apple-touch-icon exists yet)
- `src/app/manifest.ts` — MetadataRoute.Manifest built from `getBrand().config`, served at /manifest.webmanifest
- `src/app/(frontend)/layout.tsx` — removed static `<link>` tags, added `--brand-primary-light`/`--brand-primary-dark` CSS variables injected server-side, replaced static viewport with `generateViewport()` reading from brand config
- `public/favicon.ico`, `public/favicon.svg`, `public/manifest.json` — deleted

All quality gates pass (typecheck, lint, tests, build).
