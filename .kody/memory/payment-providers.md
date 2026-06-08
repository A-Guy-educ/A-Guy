---
title: Payment Providers
type: architecture
updated: 2026-05-15
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1639
---

## Overview

The project supports two payment providers: Stripe and PayPal. Both are configured via environment variables.

## Configuration

### Stripe

- `STRIPE_SECRET_KEY` — Secret API key (server-side)
- `STRIPE_PUBLISHABLE_KEY` — Public key (client-side)
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification
- `STRIPE_CURRENCY` — Default currency (default: ILS)

### PayPal

- `PAYPAL_CLIENT_ID` — Required (not optional)
- `PAYPAL_CLIENT_SECRET` — Client secret
- `PAYPAL_WEBHOOK_ID` — Webhook ID from PayPal dashboard
- `PAYPAL_SANDBOX` — Boolean for sandbox mode

## Key Convention

The `getPaymentEnv()` function in `src/lib/payment/env.ts` is the authoritative source for which payment env vars are required. `docs/secrets.md` must stay in sync with it — when adding new payment keys, update both.

## Related

- [architecture](./architecture.md) — Tech stack overview
