# Task 2458: webhook-logs collection returns 404 in admin panel

## What was done

Renamed the WebhookEvents collection slug from `webhook-events` to `webhook-logs` to match the URL `/admin/collections/webhook-logs` that QA expected. Updated all webhook handler references and the integration test.

## Root cause

The `WebhookEvents` collection was created with slug `webhook-events` (PR #2118, commit `44d44bc82`). QA tested the admin panel at `/admin/collections/webhook-logs` and got a 404 because Payload CMS routes admin collection pages by slug.

## Files changed

- `src/server/payload/collections/WebhookEvents.ts` — slug: `'webhook-events'` → `'webhook-logs'`
- `src/app/api/webhooks/stripe/route.ts` — 2 `collection:` string references updated
- `src/app/api/webhooks/paypal/route.ts` — 2 `collection:` string references updated
- `tests/int/payment-webhook-entitlements.int.spec.ts` — all collection references + new slug test
- `src/payload-types.ts` — regenerated (now uses `WebhookLog` / `webhook-logs`)

## Verification

- New integration test: "WebhookEvents collection is accessible via webhook-logs slug" — passes
- All 47 tests in `payment-webhook-entitlements.int.spec.ts` — pass
- TypeScript `tsc --noEmit` — no errors
- ESLint — only pre-existing unrelated warning in `LatexDocumentViewer`
