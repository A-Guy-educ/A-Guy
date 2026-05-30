# PayPal Sandbox Setup

This guide walks you through configuring PayPal sandbox credentials for local development and testing.

**Time estimate:** ~20–30 minutes for first-time setup.

---

## 1. Create a PayPal Developer Account

1. Go to [https://developer.paypal.com/](https://developer.paypal.com/)
2. Log in with your PayPal account (or create one if you don't have it)
3. Navigate to **Dashboard** → **My Apps & Credentials**

---

## 2. Create a Sandbox App

1. Under **Sandbox** section, click **Create App**
2. Fill in:
   - **App Name**: something like `A-Guy Sandbox`
   - **Sandbox Business Account**: select your sandbox account (or leave as default)
   - **App Type**: choose **Merchant** or **Platform** depending on your needs
3. Click **Create App**

After creation, you'll see your:

- **Client ID** → use as `PAYPAL_CLIENT_ID`
- **Secret** → use as `PAYPAL_CLIENT_SECRET`

> **Important:** Copy these now — the secret is only shown once.

---

## 3. Add Credentials to `.env.local`

```bash
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_secret_here
PAYPAL_SANDBOX=true
```

> `PAYPAL_SANDBOX=true` is the default. Set to `false` only when using production credentials.

---

## 4. (Optional) Create a Webhook Subscription

Webhooks allow PayPal to notify your app when payment events occur (e.g., payment captured, refund issued).

### 4a. Set Up ngrok for Local Webhook Delivery

Since your local server isn't publicly accessible, use ngrok to create a public tunnel:

1. Install ngrok: https://ngrok.com/download
2. Start your local dev server:
   ```bash
   pnpm dev
   ```
3. In a separate terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

> **Note:** ngrok free tier assigns a new URL each time you restart it. For persistent URLs, use a paid plan or configure a custom subdomain.

### 4b. Register the Webhook in PayPal Dashboard

1. Go to **Dashboard** → **My Apps & Credentials**
2. Select your sandbox app
3. Under **Sandbox Settings** → **Webhooks**, click **Add Webhook**
4. Enter your ngrok URL + the webhook endpoint path:
   ```
   https://abc123.ngrok.io/api/webhooks/paypal
   ```
5. Select the events you want to listen for:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
6. Click **Save**

### 4c. Get Your Webhook ID

After saving, you'll see a **Webhook ID** in your webhook settings. Add it to `.env.local`:

```bash
PAYPAL_WEBHOOK_ID=your_webhook_id_here
```

> If you restart ngrok (getting a new URL), you must update the webhook URL in the PayPal dashboard to match.

---

## 5. Create Sandbox Buyer Accounts (Optional)

To test end-to-end checkout without spending real money, create sandbox buyer accounts:

1. Go to **Dashboard** → **Sandbox** → **Accounts**
2. Click **Create Account**
3. Select **Personal** account type
4. Fill in details (use a fake email if desired)
5. Once created, you can set a password and log in at [https://www.sandbox.paypal.com/](https://www.sandbox.paypal.com/) with these credentials to simulate buyer behavior

To fund the sandbox account with a fake balance:

1. Go to **Dashboard** → **Sandbox** → **Accounts**
2. Click on the sandbox buyer account
3. Use **Balance** section to add funds (in sandbox INR/EUR/USD as needed)

---

## 6. Verify Your Setup

Run the smoke test script to confirm everything is working:

```bash
pnpm tsx scripts/smoke-paypal-keys.ts
```

Expected output:

```
🔍 PayPal Sandbox Keys Smoke Test
==================================

✅ PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set
✅ Credentials look like sandbox keys — proceeding

📡 Step 1: Fetching access token from PayPal sandbox...
✅ Access token received

📡 Step 2: Creating a sandbox test order...
✅ Order created: XXXXXXXX

📡 Step 3: Voiding the test order...
✅ Order voided

🎉 All PayPal sandbox checks passed!
```

---

## 7. Troubleshooting

### 401 Unauthorized — "Your PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is incorrect"

**Causes:**

1. **Wrong credentials** — Double-check that you're using sandbox credentials, not production credentials. Sandbox credentials start with different prefixes than production ones.
2. **Copied trailing spaces** — Make sure there are no extra spaces or newlines in your `.env.local` values.
3. **Wrong environment** — Ensure `PAYPAL_SANDBOX=true` is set (or omitted, since `true` is the default).
4. **App not active** — Go to your app in the PayPal dashboard and make sure it's active.

**Fix:** Go to [https://developer.paypal.com/](https://developer.paypal.com/) → **My Apps & Credentials** → your sandbox app, and copy the Client ID and Secret exactly.

---

### Webhook Not Delivered

**Symptoms:** Your webhook handler never fires, even though the payment succeeded.

**Causes and fixes:**

1. **ngrok tunnel not running** — Make sure `ngrok http 3000` is still running. The free tier URLs change on every restart.

2. **Wrong webhook URL** — Verify the webhook URL in PayPal Dashboard matches your current ngrok URL exactly (including `https://`).

3. **App doesn't have webhook permissions** — Some sandbox app types can't register webhooks. Try creating a new **Merchant** app type.

4. **Local server not running** — Make sure your dev server is started before testing webhook delivery.

5. **Payload signature mismatch** — If you're using webhook ID verification, make sure `PAYPAL_WEBHOOK_ID` matches the ID shown in the PayPal dashboard for that specific webhook URL.

---

### "Missing required payment environment variables"

**Cause:** `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is not set in `.env.local`.

**Fix:** Make sure your `.env.local` file exists in the project root (not in a subdirectory) and contains:

```bash
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
```

---

### "looks like a PRODUCTION credential"

**Cause:** The script detected patterns that match production PayPal credentials and refused to run as a safety measure.

**Fix:** Make sure you are using credentials from the **Sandbox** section of [https://developer.paypal.com/](https://developer.paypal.com/), not from your production PayPal account.

---

### "Order creation failed" or "Token request failed"

**Cause:** Network issues or PayPal sandbox API outage.

**Fix:** Check [https://developer.paypal.com/status](https://developer.paypal.com/status) for any active incidents. If the sandbox API is down, you may need to wait before continuing.

---

## Related

- [Secrets Management](../secrets.md) — How payment credentials are stored and validated
- [Smoke Checks](../SMOKE_CHECKS.md) — Other smoke tests to run after environment changes
