# Task #2505 - Login page redirects to /start on mobile (375px)

## Investigation Summary

**Issue:** Login page at 375px viewport immediately redirects to /start, preventing mobile users from logging in.

**Finding:** Bug could NOT be reproduced with current codebase. Investigation revealed:

1. **Middleware analysis:** The middleware correctly allows `/login` through as a public route. Protected paths are `['/study', '/practice', '/test']` and `/courses/*`. Neither `/login` nor `/start` are protected.

2. **Test verification:** All 19 middleware tests pass, including new test for `/login` as a public route.

3. **next.config.js:** No redirects from `/login` to `/start` found.

4. **Login page server component:** Only redirects authenticated users to `/` (not `/start`).

## Changes Made

1. **tests/int/auth-middleware.int.spec.ts:** Added `/login` to public routes test suite.

2. **tests/e2e/verification/auth-onboarding.e2e.spec.ts:** Added 2 new tests for mobile login page behavior at 375px viewport.

## Why Bug Could Not Be Reproduced

- Evidence file `.kody/qa-reports/qa-sweep-2026-06-06/mobile-login.png` does not exist in repo
- Most recent middleware change (f8425fd46) was made on 2026-06-07 at 18:47:53 UTC, AFTER the QA sweep on 2026-06-06
- The bug may be environment-specific (production vs local) or in a different layer (CDN, edge configuration)

## Recommendation

Verify login page behavior in production environment with actual mobile device testing at 375px viewport. The regression tests added provide coverage but may not catch environment-specific issues.
