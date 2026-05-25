## Fix #1948: CI Integration Test Failure

**Failing test**: `WRONG URL: /api/collections/transactions does not exist (returns 404)` in `tests/int/admin-recent-transactions-widget-1936.int.spec.ts:191`

**Root cause**: The test uses raw `fetch()` to hit `http://localhost:3000/api/collections/transactions` but the Next.js server is not running during integration tests, causing `ECONNREFUSED`. The existing pattern in the codebase (`exercise-conversion-api.int.spec.ts`) handles this with `hasServerUrl` + `it.skipIf(!hasServerUrl)`.

**Fix applied**:
1. Added `const hasServerUrl = !!process.env.SERVER_URL` to `tests/int/admin-recent-transactions-widget-1936.int.spec.ts`
2. Changed `it('WRONG URL: ...')` to `it.skipIf(!hasServerUrl)('WRONG URL: ...')`

This follows the established project pattern for conditionally skipping HTTP-dependent tests when `SERVER_URL` is not set. All other tests in the file (using Payload Local API) continue to run normally.
