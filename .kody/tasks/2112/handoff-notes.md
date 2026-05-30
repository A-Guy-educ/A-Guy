# Task 2112: PayPal Sandbox Smoke Test Script + Setup Doc

## What was done

Created `scripts/smoke-paypal-keys.ts` — a smoke test script that:
1. Loads `.env.local` via dotenv
2. Validates `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set (fail-fast with doc link on missing)
3. Detects production credential patterns (AV/EH prefix, >80 chars, "live"/"production" in value) and refuses to run
4. Fetches sandbox access token from `https://api-m.sandbox.paypal.com/v1/oauth2/token`
5. Creates a $1.00 sandbox test order via `/v2/checkout/orders`
6. Voids the order via `/v2/checkout/orders/{id}/void`
7. Exits 0 on success; exits 1 with clear messages on any failure

Created `docs/payment/paypal-sandbox-setup.md` with:
- Step-by-step sandbox app creation at developer.paypal.com
- Credential setup in `.env.local`
- ngrok webhook tunnel setup
- Webhook registration and Webhook ID config
- Sandbox buyer account creation
- Verification via `pnpm tsx scripts/smoke-paypal-keys.ts`
- Troubleshooting section covering 401 errors and webhook delivery failures

Updated `docs/secrets.md` to cross-link the new PayPal sandbox setup doc from the PayPal env var table.

Added `tests/unit/scripts/smoke-paypal-keys.test.ts` with 20 tests covering:
- Production credential detection (AV/EH prefix, long credential, live/production keywords)
- Sandbox credential acceptance
- Token/order response parsing
- URL construction
- Doc URL correctness

## Acceptance criteria status
- ✅ `pnpm tsx scripts/smoke-paypal-keys.ts` smoke test script created
- ✅ Exits non-zero with helpful message when keys missing
- ✅ Exits non-zero with "keys are wrong" message on 401
- ✅ Production credential safety check refuses to run
- ✅ Setup doc created with all required sections
- ✅ Doc cross-linked from `docs/secrets.md`
