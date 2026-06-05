## Bug #2484 Fix Summary

**Root cause:** `body.landing-page header { display: none !important }` in `src/app/(frontend)/globals.css` hid the header on ALL viewports, making the mobile hamburger button inaccessible.

**Fix:** Wrapped the rule in `@media (min-width: 1024px)` so header is only hidden on desktop (`lg+`), restoring mobile access.

**Files changed:**
- `src/app/(frontend)/globals.css` — added `@media (min-width: 1024px)` around landing-page header/footer hiding rule
- `tests/e2e/mobile-hamburger-menu-auth-state.e2e.spec.ts` — new E2E test file with 4 tests covering: hamburger button visibility at 375px, authenticated menu content (Hebrew text), desktop header intentionally hidden on /start but visible on /courses, unauthenticated menu shows login

**Tests:** 4 Playwright E2E tests — all passing.

**Key lesson:** The app defaults to Hebrew; E2E locators must use Hebrew text (`החשבון שלי`, `התנתק`, `התחבר`) not English.
