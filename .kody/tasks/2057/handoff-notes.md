## Fix Summary

The login page was displaying the literal i18n key `auth.login.brand.heroSubtitle` instead of the Hebrew translation.

### Root Cause

In task 1579, the `heroSubtitle` key was moved from `auth.login.heroSubtitle` to `brand.heroSubtitle` (in the brand bundle). However, the call site in `LoginForm.tsx` still uses `t('brand.heroSubtitle')` with the `auth.login` namespace, which resolves to `auth.login.brand.heroSubtitle` — a key that didn't exist.

### Fix

Added `brand.heroSubtitle` under `auth.login` in both translation files:
- `src/i18n/en.json`: Added `auth.login.brand.heroSubtitle: "A-Guy Your Personal Tutor"`
- `src/i18n/he.json`: Added `auth.login.brand.heroSubtitle: "A-Guy המורה הפרטי שלכם"`

### Files Changed
- `src/i18n/en.json` - Added `brand.heroSubtitle` under `auth.login`
- `src/i18n/he.json` - Added `brand.heroSubtitle` under `auth.login`
- `tests/unit/login-page-redesign.test.tsx` - Added 2 tests to verify the fix

### Verification
- All 22 tests in `login-page-redesign.test.tsx` pass
- Quality gates (typecheck, lint) pass
