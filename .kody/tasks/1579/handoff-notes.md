## Phase 5: Extract brand strings from i18n into per-brand messages

### What was done

- **Brand message files created**: `src/brands/aguy/messages/en.json` and `he.json` with a `brand.*` namespace containing: `name`, `tagline`, `welcomeTitle`, `heroSubtitle`, `homepageTitle`.
- **Brand interface extended** in `src/brands/types.ts` — added `messages: BrandMessages` field to the `Brand` contract.
- **Brand bundle updated** in `src/brands/aguy/index.ts` — imports and exposes `en`/`he` message files.
- **i18n merge updated** in `src/app/(frontend)/layout.tsx` and `src/app/(frontend)/page.tsx` — `getMessages()` now spreads brand messages after base messages (brand keys override base when collision occurs).
- **Call sites updated**: `page.tsx` uses `t('brand.homepageTitle')` instead of `t('home.title')`; `LoginForm.tsx` uses `t('brand.heroSubtitle')`.
- **i18n files cleaned**: Removed `home.title`, `auth.login.title`, `auth.login.heroSubtitle`, `auth.login.googleOnlyMessage`, `coursePage.platformName`, `shop.footer.platform` from both `en.json` and `he.json`.
- **Test updated**: `tests/unit/login-page-redesign.test.tsx` now uses merged brand+base messages and validates `brand.heroSubtitle` exists.
- **Helper created**: `src/brands/messages.ts` exports `brandName()` for non-i18n contexts.

### Moved keys checklist

| Old i18n key | New key | Status |
|---|---|---|
| `home.title` | `brand.homepageTitle` | Moved; call site updated |
| `auth.login.heroSubtitle` | `brand.heroSubtitle` | Moved; call site updated |
| `auth.login.title` | `brand.welcomeTitle` | Moved; no call site found |
| `auth.login.googleOnlyMessage` | — | Removed (unused) |
| `coursePage.platformName` | — | Removed (unused) |
| `shop.footer.platform` | — | Removed (Footer hardcodes "Aguy Learning Platform") |

### Next steps
- Update Footer to use i18n `brand.platformName` (follow-up)
- The brand merge uses spread (`{ ...base, ...brand }`) so brand keys take precedence — this is the intentional collision policy
