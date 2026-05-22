# Task 1839: Admin Dashboard Multiple Widgets Stuck Loading

## What I Did

Added 15-second timeout to both MetricsProvider and RecentTransactionsWidget fetch calls to prevent indefinite hanging.

**Root Cause**: The `/api/admin/dashboard-metrics` endpoint performs many MongoDB queries in parallel. If any of these queries hang (e.g., due to MongoDB connection issues in serverless environment), the entire request hangs, causing widgets to stay in loading state indefinitely.

## Files Changed

1. `src/ui/admin/ConversionTracking/MetricsProvider.tsx`:
   - Added `AbortController` with 15s timeout to the fetch call
   - Added proper handling for `AbortError` to show "Request timed out" message
   - Clears timeout on both success and error paths

2. `src/ui/admin/RecentTransactionsWidget/index.tsx`:
   - Same timeout pattern applied to the RecentTransactionsWidget fetch
   - Handles both HTTP errors and timeout errors gracefully

## What Still Needs Investigation

The RecentTransactionsWidget shows HTTP 404. This appears to be because the `/api/collections/transactions` endpoint returns 404 when accessed (likely due to the `adminOnly` access control on the Transactions collection). This is a separate issue from the stuck loading - the widget does complete its fetch and show an error, unlike the MetricsProvider widgets which hang indefinitely.

The 404 is likely either:
1. Payload REST API returning 404 instead of 403 for unauthorized access
2. QA user not having admin role
3. Payload REST API configuration issue

## Verification

- TypeScript compiles without errors
- ESLint passes (only pre-existing warnings)
- Quality gates pass (attempt 1)
