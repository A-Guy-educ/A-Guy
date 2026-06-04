Fixed issue #2366: thin white strip at top of page in dark mode for unauthenticated users.

Root cause: AdminBar in src/ui/web/AdminBar/index.tsx rendered an outer `<div className="py-2 bg-foreground text-background hidden sm:block">` for all users. On desktop (≥640px), `sm:block` defeated the conditional `hidden` applied when `!show`, so the near-white `bg-foreground` div was always visible in dark mode — creating a white strip at the top for logged-out users.

Fix: Replaced the conditional `cn()` className + hidden/block pattern with an early `if (!show) return null` guard. This means no DOM is emitted at all for unauthenticated users. Removed the unused `cn` import.

Files changed:
- src/ui/web/AdminBar/index.tsx: removed `cn()` conditional className, added early return `if (!show) return null`, removed unused `cn` import
- tests/e2e/admin-bar-dark-mode-auth-state.e2e.spec.ts: new regression E2E test covering unauthenticated desktop rendering and dark mode background color checks

The existing admin-bar-mobile-visibility.e2e.spec.ts test for authenticated users on desktop was verified to still be valid — the fix doesn't affect the authenticated case.
