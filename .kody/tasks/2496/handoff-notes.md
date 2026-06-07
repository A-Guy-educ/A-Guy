# Fix: Transactions list relationship columns show "Loading..."

## What changed

Changed `useAsTitle` in the Transactions collection from `createdAt` (a Date field from `timestamps: true`) to `providerTransactionId` (a required text field). Also added `providerTransactionId` as the first `defaultColumns` entry so it appears in the list view.

## Root cause

`useAsTitle` must be a text field. Using a Date field (like `createdAt` from `timestamps: true`) causes the Payload admin UI to misrender the document title, which cascades into relationship columns showing "Loading..." in the list view. The Enrollments collection comment confirms this pattern: "Relationship fields default to depth=2 (populated) in Payload" — relationships ARE populated by default, so the issue is the `useAsTitle` Date field causing admin UI rendering failure.

## Files changed

- `src/server/payload/collections/Transactions.ts`: Changed `useAsTitle: 'createdAt'` → `useAsTitle: 'providerTransactionId'` and added `'providerTransactionId'` to the front of `defaultColumns`.
- `tests/int/admin-transactions-rest-api.int.spec.ts`: Added a reproduction test that queries the transactions list without explicit `depth` and asserts that `user` and `product` relationships are populated objects (not ID strings).

## Verification

- TypeScript (`tsc --noEmit --skipLibCheck`): PASSED
- Quality gates (`verify` tool): PASSED
- Integration tests: SKIPPED (no DATABASE_URL in this environment)

## Notes

Integration tests require MongoDB and are skipped in this environment. The fix is based on Payload admin UI patterns — if the issue persists, the admin list query depth should be investigated as a secondary cause.
