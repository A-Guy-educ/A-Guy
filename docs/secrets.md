# Secrets Management

This document describes the secrets used in the A-Guy-educ/A-Guy project and how they are managed.

## Payment Provider Secrets

All payment secrets are documented in `.env.example` and managed via the [ConfigSecrets](#configsecrets) collection.

### Stripe

| Key | Required | Description |
|-----|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | מפתח API סודי של Stripe (מנהל התשלומים) |
| `STRIPE_PUBLISHABLE_KEY` | No | מפתח ציבורי של Stripe (לצד לקוח) |
| `STRIPE_WEBHOOK_SECRET` | No | סוד לאימות Webhooks מ-Stripe (מתקבל מהדשבורד של Stripe) |
| `STRIPE_CURRENCY` | No | מטבע ברירת המחדל לתשלומים (default: ILS) |

### PayPal

| Key | Required | Description |
|-----|----------|-------------|
| `PAYPAL_CLIENT_ID` | Yes | Client ID של PayPal (מנהל התשלומים) |
| `PAYPAL_CLIENT_SECRET` | Yes | סוד הלקוח של PayPal (מנהל התשלומים) |
| `PAYPAL_WEBHOOK_ID` | No | Webhook ID של PayPal (מהדשבורד של PayPal) |
| `PAYPAL_SANDBOX` | No | האם להשתמש בסביבת Sandbox (בדיקה) |

## ConfigSecrets

The `config_secrets` collection is a tenant-scoped encrypted secrets store. All values are encrypted at rest and are write-only in the admin UI (values are never displayed after saving).

### Collection Fields

- `key` (text, required): Configuration key name (snake_case)
- `tenant` (relationship, required): Tenant this secret belongs to
- `title` (text): Optional title/description
- `value` (text): Secret value (encrypted, write-only)
- `enabled` (checkbox): Enable or disable this secret
- `updatedAt` (自动): Timestamp

### Access Control

Admin-only access for all operations. Audit logs track all mutations without leaking secrets.

### Payment Secret Entries

Payment provider entries should be created in the ConfigSecrets collection with appropriate tenant context. The `getPaymentEnv()` helper in `src/lib/payment/env.ts` validates required environment variables at runtime.

## Environment Variables

See `.env.example` for a complete list of environment variables with descriptions.
