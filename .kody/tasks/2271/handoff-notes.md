# Fix exposed i18n key auth.login.brand.heroSubtitle on login page

## What was done

**Root cause**: `LoginForm.tsx` used `useTranslations('auth.login')` which creates a `t` function that prefixes all keys with `auth.login.`. When `t('brand.heroSubtitle')` was called, it looked for `auth.login.brand.heroSubtitle`, but the key is at the root level (`brand.heroSubtitle`) after the brand messages merge.

**Fix**: 
- Changed `LoginForm` to accept `brandHeroSubtitle` as an optional prop (with empty string default for backward compatibility)
- Updated `LoginFormContent` to use the prop instead of calling `t('brand.heroSubtitle')`
- Updated `LoginPageContent` to compute the correct value using `useI18n().t` (root-level translation) and pass it to `LoginForm`

## Files changed

1. `src/app/(frontend)/login/LoginForm.tsx` - Added `brandHeroSubtitle` prop with default empty string
2. `src/app/(frontend)/login/LoginPageContent.tsx` - Added `useI18n`, computes `brandHeroSubtitle` via `tRoot('brand.heroSubtitle')` and passes to `LoginForm`
3. `tests/unit/login-page-redesign.test.tsx` - Added test case to verify Hebrew subtitle renders correctly (not raw key)
