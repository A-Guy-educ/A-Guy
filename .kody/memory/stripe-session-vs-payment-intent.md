---
name: stripe-session-vs-payment-intent
title: Stripe Session Vs Payment Intent
type: lesson
source: task:1986
recorded_at: 2026-05-24T07:48:33Z
---

Stripe Checkout Session IDs (cs_...) and PaymentIntent IDs (pi_...) are distinct. Session IDs are for Checkout API; PaymentIntent IDs are for Refunds API and charge.refunded webhooks. Always store both when processing Stripe payments.

**Why:** Bug #1986: providerTransactionId was storing cs_... but stripe.refunds.create requires pi_... — this broke all Stripe refunds.

**Source task:** `1986`
