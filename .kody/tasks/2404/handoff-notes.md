# Fix Hydration Mismatch in SystemLink

## What I Fixed

Fixed React hydration error #418 on the purchase detail page by modifying `src/infra/loading/components/SystemLink.tsx`.

## Root Cause

The `SystemLink` component called `loadingManager.register()` **synchronously** in the click handler. This triggered `notify()`, which synchronously notified `useSyncExternalStore` subscribers, causing the snapshot (`isRouteBusy`) to change **during** React's render phase.

When the next page (purchase detail) hydrated, `useSyncExternalStore` compared `getSnapshot()` (true - loading registered) against `getServerSnapshot()` (false - server had no loading state). This snapshot mismatch caused React to throw error #418 "server-rendered HTML does not match client hydration".

## The Fix

Moved `loadingManager.register()` from the click handler to `useEffect`:

- Click handler: sets `wasClicked = true` and marks `pendingNavigationRef.current = true`
- `useEffect`: calls `register()` after the first render completes

This ensures:
1. First render after click: `isRouteBusy = false` (matches server snapshot)
2. Second render after `useEffect`: `isRouteBusy = true` (loading indicator shows)

The loading indicator still shows (before navigation completes), just one render later.

## Tradeoffs

- **Before**: Loading indicator showed immediately, but could cause hydration error
- **After**: Loading indicator shows after one additional render, no hydration error

The delay is imperceptible since navigation takes longer than the extra render cycle.

## Files Changed

- `src/infra/loading/components/SystemLink.tsx` - Deferred `register()` to `useEffect`
