# Fix for #2578: Admin dashboard widgets permanently stuck on Loading

## What was done

Added 15-second `AbortController` timeouts to both `MetricsProvider` and `RecentTransactionsWidget` fetch calls.

## Files changed

- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — Added `FETCH_TIMEOUT_MS = 15000`, wraps fetch in `AbortController`, clears timeout on success/error, sets 'Request timed out' error on `AbortError`
- `src/ui/admin/RecentTransactionsWidget/index.tsx` — Same timeout pattern applied to its direct `/api/transactions` fetch
- `tests/unit/ui/admin/metrics-provider-timeout.spec.tsx` — New test verifying timeout implementation exists in MetricsProvider

## Root cause

The fetch calls had no timeout. When the API route hung (slow queries or connection issues), the `finally` block never ran, `loading` stayed `true` forever, and widgets showed "Loading..." indefinitely.

## Prior art

Multiple previous attempts (commits 6b527f1a8, b1b7df6a7, 9a99e990e, b5c228e25, d146e5fff, dcaa0a840) tried to add timeouts but were never merged into this branch. The fix follows the same pattern those commits attempted.
