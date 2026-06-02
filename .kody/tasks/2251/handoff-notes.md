# Docs Drift Fix: Access Control (issue #2251, PR #2225)

## What I did

PR #2225 changed `Transactions.access.create` to `() => false` (webhook-only creation) but did not update `docs/access-control/README.md`. I reconciled the doc by:

1. **Added Pattern 4: Webhook-Only Collections** (inserted before the old Pattern 4 "Field-Level Sensitive Data", which is now Pattern 5). The new pattern uses the actual `Transactions` collection as the example and documents:
   - `create: () => false` — blocks all manual creation
   - Internal creation via `overrideAccess: true` (webhooks, checkout route)
   - Rationale: prevents dangling records that break revenue stats, refunds, and purchases page

2. **Updated the Access Control Checklist** — added a new bullet: "Webhook-only collections use `create: () => false` and internal creation with `overrideAccess: true`"

## Why this is sufficient

The doc now accurately reflects the Transactions collection's access control and provides a reusable pattern for similar webhook-only collections. No code changes were needed (this was purely a docs reconciliation).
