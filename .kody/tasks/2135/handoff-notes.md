# Fix PaymentStats race condition (#2135)

## What was done

Replaced the read-modify-write pattern in `syncPaymentStats-hook.ts` with a single atomic MongoDB `updateOne` + `$inc` + `{ upsert: true }` call via `payload.db.collections['payment_stats']`. This eliminates the race window where two concurrent webhooks on the same (date, currency) could read the same current value and overwrite each other's delta.

Added a `unique: true` compound index on `['date', 'currency']` to the PaymentStats collection config, which prevents any future code path (bypassing the hook) from creating duplicate rows.

Created `scripts/dedup-payment-stats.ts` — a dry-run + `--execute` dedup script that merges duplicate (date, currency) groups by summing all counter fields and keeping the most-recently-updated doc as the survivor. Must be run on production before the index change is deployed.

Added a concurrent integration test that fires 10 succeeded transactions concurrently and asserts `totalRevenueAgorot === 10 * AMOUNT` — this was the test that previously failed (or would fail intermittently) under the old read-modify-write approach.

## Key changes

- `syncPaymentStats-hook.ts:144-177` — replaced `find` + `update`/`create` branch with `updateOne({ date, currency }, { $inc: { ... } }, { upsert: true })`
- `PaymentStats.ts` — added `indexes: [{ fields: ['date', 'currency'], unique: true }]`
- `scripts/dedup-payment-stats.ts` — new one-shot dedup script (dry-run by default)
- `tests/int/payment-stats.int.spec.ts` — added concurrent webhook test as 10th test

## Pre-deploy action required

Run `pnpm tsx scripts/dedup-payment-stats.ts --execute` against the production MongoDB before deploying the index addition, otherwise the unique index creation will fail on existing duplicate rows.
