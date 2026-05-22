# Issue #1777: Admin Login Form Mobile Fix

## What was done

Fixed the admin login form being narrow and cramped at 375px mobile viewport.

**Root cause:** The Payload admin login page had a `max-width: 400px` constraint on the `.login` container which made the form feel cramped at 375px mobile viewports.

**Fix:** Added responsive CSS to `src/app/(payload)/custom.scss` that:
- Sets `.login` to `max-width: 100%` on viewports ≤480px
- Reduces side padding to 0.75rem for more content space
- Ensures `.login__form` also uses full width

**Test:** Added `tests/e2e/admin-login-mobile.e2e.spec.ts` with 2 tests verifying:
1. Login card width ≥280px at 375px viewport
2. Input fields width ≥200px at 375px viewport

Both tests pass with the CSS fix applied.

## Files changed
- `src/app/(payload)/custom.scss` — Added mobile responsive CSS for `.login` container
- `tests/e2e/admin-login-mobile.e2e.spec.ts` — New E2E test for mobile login form

## Note
The admin login page is a Payload CMS built-in route (`/admin/login`). The CSS fix overrides Payload's default `max-width: 400px` on small screens via `!important` in `custom.scss` which is loaded by the Payload admin layout.