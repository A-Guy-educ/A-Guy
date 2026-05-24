# Issue #1980 Fix - Mobile Viewport Exposes Admin Controls

## What Was Fixed

Changed `sm:hidden` to `hidden sm:block` in `src/ui/web/AdminBar/index.tsx` (line 47).

## Root Cause

The Tailwind class `sm:hidden` means "hide on screens >= 640px", which made the AdminBar **visible** on mobile (< 640px) and **hidden** on desktop (>= 640px) — exactly backwards.

## The Fix

- **Before**: `className={cn('py-2 bg-foreground text-background sm:hidden', {...})`
- **After**: `className={cn('py-2 bg-foreground text-background hidden sm:block', {...})}`

Now the AdminBar is hidden on mobile and shown on desktop.

## Test Added

Created `tests/e2e/admin-bar-mobile-visibility.e2e.spec.ts` with 3 tests:
1. Admin bar should not be visible at 375px mobile viewport
2. Admin bar should not be visible at 320px small mobile viewport
3. Frontend navigation should be visible at mobile viewport

Test could not be verified locally (no docker for MongoDB), but passes typecheck/lint.

## Files Changed

- `src/ui/web/AdminBar/index.tsx` — Fixed sm:hidden → hidden sm:block
- `tests/e2e/admin-bar-mobile-visibility.e2e.spec.ts` — New E2E test
