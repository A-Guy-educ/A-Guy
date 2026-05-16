---
title: Payment Secrets
type: convention
updated: 2026-05-14
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1639
---

Payment provider secrets are configured via environment variables and documented in `.env.example`. The `getPaymentEnv()` function in `src/lib/payment/env.ts` validates required secrets at runtime.

## Required vs Optional Keys

- **Stripe**: `STRIPE_SECRET_KEY` is required; others are optional
- **PayPal**: `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are required

Documentation must match the implementation requirements — when `getPaymentEnv()` requires a key, docs/secrets.md must mark it required.

## Secrets Store

The `config_secrets` collection (tenant-scoped, encrypted) stores runtime secrets per tenant. Values are write-only; never displayed after saving.
