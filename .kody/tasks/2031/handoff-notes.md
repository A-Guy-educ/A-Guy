# Fix i18n key leak on login page (task 2031)

## What was fixed

The `brand.heroSubtitle` i18n key was being rendered as raw text (`auth.login.brand.heroSubtitle`) instead of the translated Hebrew/English string on the login page.

## Root cause

`LoginForm.tsx` used `useTranslations('auth.login')` which prepends `auth.login.` to all translation keys. When calling `t('brand.heroSubtitle')`, it resolved to `auth.login.brand.heroSubtitle`. However, the brand messages are merged at the **top level** of the messages object (via `{ ...base, ...brand }` in `layout.tsx`'s `getMessages`), so the actual key is just `brand.heroSubtitle` at the root level.

## Changes

- **src/app/(frontend)/login/LoginForm.tsx**: Added `const tBrand = useTranslations()` to access top-level (un-namespaced) translation keys. Changed line 52 from `t('brand.heroSubtitle')` to `tBrand('brand.heroSubtitle')`.
- **tests/unit/login-page-redesign.test.tsx**: Added 2 new tests in `LoginForm brand.heroSubtitle translation` describe block that verify the Hebrew and English translations are rendered correctly (not the raw key).

## Verification

- Added failing tests confirmed the bug (raw key visible in output)
- After fix, all 22 tests in `login-page-redesign.test.tsx` pass
- Quality gates (typecheck, lint) pass