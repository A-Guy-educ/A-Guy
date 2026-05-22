# Issue #1797: Admin Dashboard Widgets Fail to Load — Analysis & Partial Fix

## What Was Done

### Error Handling Improvements (symptom mitigation)

**RecentTransactionsWidget** (`src/ui/admin/RecentTransactionsWidget/index.tsx`):
- Added 10-second AbortController timeout to fetch request
- Added JSON error body parsing for non-OK responses (extracts `error` or `message` from JSON body)
- Added AbortError handling (shows "Request timed out" instead of "Unknown error")
- Improved error messages for 404 responses

**MetricsProvider** (`src/ui/admin/ConversionTracking/MetricsProvider.tsx`):
- Same timeout and error parsing improvements applied

### Tests Created
- `tests/unit/dashboard-metrics-helpers.test.ts` — Unit tests for `extractCourseId` and `extractProductId` helper functions (10 tests, all passing)
- `tests/int/admin-dashboard-recent-transactions-1797.int.spec.ts` — Integration test for `/api/collections/transactions` endpoint (4 tests, skipped due to test infrastructure issues)

## Root Cause: NOT DEFINITIVELY IDENTIFIED

The issue says `/api/collections/transactions` returns 404. Investigation showed:
- Transactions collection is properly configured with `slug: 'transactions'`
- Access control (`adminOnly`) is correctly set
- No hooks that would cause a 404 on read operations
- Integration test infrastructure has pre-existing issues (getPayload hangs with Atlas in test environment)

The error handling improvements prevent infinite "Loading..." states (by adding timeouts) and improve error messages, but the ROOT CAUSE of the 404 remains unknown.

## Test Infrastructure Issue (Pre-existing)
Several integration tests fail with "Hook timed out in 60000ms" when DATABASE_URL is set to Atlas:
- `admin-dashboard-metrics.int.spec.ts` — hook timeout
- `admin-dashboard-recent-transactions-1797.int.spec.ts` — hook timeout

Only `transaction-refund.int.spec.ts` works because it uses the pattern:
1. Deletes `process.env.DATABASE_URL`
2. Calls `startMongoContainer()` to get testcontainer URL
3. Calls `getPayload({ config: config.default })`

This clears DATABASE_URL before the config module is evaluated, avoiding the Atlas connection attempt that causes the hang.

## Files Changed
- `src/ui/admin/RecentTransactionsWidget/index.tsx` — Added timeout and better error handling
- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — Same improvements
- `tests/unit/dashboard-metrics-helpers.test.ts` — New unit tests
- `tests/int/admin-dashboard-recent-transactions-1797.int.spec.ts` — New integration test (skipped)
