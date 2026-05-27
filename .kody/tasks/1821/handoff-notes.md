# Bug #1821: Admin bar exposed on mobile frontend viewport

## Root Cause

The `AdminBar` component in `src/ui/web/AdminBar/index.tsx` used `sm:hidden` Tailwind class, which hides elements at the `sm` breakpoint (640px) and above — the opposite of what's needed. On mobile (375px < 640px), the admin bar was visible.

## Fix Applied

Changed the wrapper div's className in `src/ui/web/AdminBar/index.tsx` from:
```
className={cn('py-2 bg-foreground text-background sm:hidden', { block: show, hidden: !show })}
```
to:
```
className={cn('py-2 bg-foreground text-background hidden sm:block', { block: show, hidden: !show })}
```

This ensures the admin bar is hidden on mobile viewports (< 640px) and visible on desktop (>= 640px).

## Test Added

`tests/e2e/admin-bar-mobile-visibility.e2e.spec.ts` — tests both mobile (375px, should be hidden) and desktop (1280px, should be visible) admin bar visibility. Note: E2E tests require a running dev server; quality gates (typecheck, lint, format) all pass.
