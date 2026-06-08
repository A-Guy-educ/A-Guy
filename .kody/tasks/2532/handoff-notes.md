# Fix: Admin Dashboard Widgets Stuck on Loading State (#2532)

## What Was Fixed

Added 30-second timeout to fetch calls in MetricsProvider and RecentTransactionsWidget to prevent widgets from being stuck in Loading state when APIs are slow/hanging.

## Root Cause

Both MetricsProvider and RecentTransactionsWidget made fetch calls to backend APIs without any timeout mechanism. When the backend API hangs or is slow, the widgets would stay on "Loading..." forever instead of showing an error state.

## Changes Made

1. **MetricsProvider.tsx**: Added AbortController with 30s timeout to dashboard-metrics fetch. On timeout, sets error to 'timeout' instead of leaving widgets in loading state.

2. **RecentTransactionsWidget/index.tsx**: Added AbortController with 30s timeout to transactions fetch. Same timeout handling pattern.

3. **tests/unit/ui/admin/metrics-provider-timeout.spec.ts**: Added unit tests verifying:
   - AbortController is used
   - setTimeout aborts the fetch
   - signal is passed to fetch
   - AbortError is handled distinctly
   - clearTimeout is called on both success and error paths

## Pattern Applied

```typescript
const controller = new AbortController()
const TIMEOUT_MS = 30_000
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
try {
  const res = await fetch(url, { signal: controller.signal })
  clearTimeout(timeoutId)
  // handle response
} catch (err) {
  clearTimeout(timeoutId)
  if (err instanceof Error && err.name === 'AbortError') {
    setError('timeout')
  } else {
    setError(err.message)
  }
} finally {
  clearTimeout(timeoutId)
}
```

## Files Changed

- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — Added 30s fetch timeout
- `src/ui/admin/RecentTransactionsWidget/index.tsx` — Added 30s fetch timeout  
- `tests/unit/ui/admin/metrics-provider-timeout.spec.ts` — New test file
