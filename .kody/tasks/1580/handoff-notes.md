# Phase 6: Brand-aware stragglers — Handoff

## What was done

Three application files updated to eliminate hardcoded brand strings:

1. **src/app/api/copilotkit/route.ts** — Added `getBrand` import; system prompt now uses `${getBrand().config.name}` instead of hardcoded "A-Guy". GITHUB_OWNER/GITHUB_REPO env var defaults kept as-is (they are GitHub identifiers, not display names).

2. **src/server/payload/plugins/mcp/index.ts** — Added `getBrand` import; `serverInfo.name` now uses `${getBrand().config.name} MCP Server` instead of hardcoded "A-Guy MCP Server".

3. **src/server/payload/endpoints/seed/intro-page.ts** — Added `getBrand` import; `title` field and hero rich-text heading now use `getBrand().config.name` via template literal. HTML body h1 also templated. Remaining ~12 "A-Guy" instances in descriptive HTML body paragraphs left as-is (see followups).

## Error/offline pages

- **error.tsx**: Already clean — shows hardcoded i18n text (no brand name), no metadata export needed (client component).
- **not-found.tsx**: Already uses `useTranslations('common.notFound')` with i18n keys from `src/i18n/en.json`.
- **offline/page.tsx**: Hardcoded English strings only (no visible brand name), not modified.

## Remaining grep matches (documented)

- **Tests** (out of scope): `tests/e2e/*.spec.ts`, `tests/unit/**/*.spec.ts`, `tests/int/*.spec.ts`
- **Brand bundle** (correct location): `src/brands/messages.ts` (fallback), `src/brands/types.ts` (type comments)
- **GitHub identifiers**: `GITHUB_OWNER`/`GITHUB_REPO` in copilotkit route — not display names, leave
- **Seed HTML body**: ~12 "A-Guy" instances in descriptive paragraphs — leave per Option A (smallest change), follow up with Option B for per-brand seed files
- **Login pages**: `src/app/(frontend)/login/LoginForm.tsx` (alt="A-Guy"), `LoginPageContent.tsx` (support@aguy.co.il) — not in scope
- **mergeOpenGraph fallback**: `siteName: 'A-Guy'` — only used when `getBrand()` fails, acceptable
- **ESLint plugin**: `eslint-plugin-aguy/` folder name — leave as-is per issue decision

## Verification

`pnpm typecheck && pnpm lint` pass on the modified files. No breaking changes to MCP/CopilotKit behavior — brand name now reflects active brand in server responses.
