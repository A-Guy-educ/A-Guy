## Issue #2211 — Set Transactions.access.create to admin-only-and-discouraged

### What was done

**Changed `src/server/payload/collections/Transactions.ts`:**
- `access.create`: changed from `authenticated` to `() => false` — blocks ALL manual creation including admin UI and REST API
- `admin.description`: added explanatory text that transactions are auto-created by webhooks and cannot be manually created
- Removed unused `authenticated` import

**Added `tests/int/transaction-access-create.int.spec.ts`:**
- Three tests: unauthenticated REST POST → 403, admin JWT REST POST → 403, overrideAccess: true Local API → succeeds
- Uses same REST handler pattern as `admin-transactions-rest-api.int.spec.ts`

### Key findings
- All legitimate transaction creation paths (checkout route, stripe/paypal webhooks, purchase-receipt service) already use `overrideAccess: true` — no code changes needed there
- All existing integration tests also use `overrideAccess: true` — no test updates needed

### Pattern followed
Mirrored `ConfigAuditLogs.ts` which uses `create: () => false` with a comment `// Only created via hooks with overrideAccess`