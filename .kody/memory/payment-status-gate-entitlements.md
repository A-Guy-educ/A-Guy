---
name: payment-status-gate-entitlements
title: Payment Status Gate Entitlements
type: decision
source: task:1986
recorded_at: 2026-05-24T07:48:33Z
---

For async payment methods (Klarna, ACH, SEPA), checkout.session.completed fires BEFORE payment actually clears. Entitlements must only be granted when payment_status === 'paid'. Use checkout.session.async_payment_succeeded/failed for async payment flows.

**Why:** Bug #1986: entitlements were leaked for unpaid async payments because the webhook granted on session.completed regardless of payment_status.

**Source task:** `1986`
