---
name: user-transaction-api-at-account-namespace
title: User Transaction Api At Account Namespace
type: decision
source: task:2134
recorded_at: 2026-05-27T12:32:40Z
---

The GET /api/account/transactions/{id} endpoint uses the /account/ namespace to separate user-owned data from admin APIs. This follows the pattern established by the checkout flow at /api/payments/checkout. Authorization is enforced server-side by comparing transaction.user to the authenticated user.id, returning 404 (not 403) to avoid leaking existence information.

**Why:** Admin REST API at /api/transactions requires admin role. Users need their own API that returns 404 on mismatch to prevent enumeration attacks.

**Source task:** `2134`
