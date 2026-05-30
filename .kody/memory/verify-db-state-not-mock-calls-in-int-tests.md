---
name: verify-db-state-not-mock-calls-in-int-tests
title: Verify Db State Not Mock Calls In Int Tests
type: lesson
source: task:2133
recorded_at: 2026-05-28T12:06:29Z
---

When testing webhook → DB update flows, verifying `emailSentAt` directly on the transaction record is more reliable than checking mock function call counts. Mock call counts can accumulate across tests in the same describe block if mocks are not properly reset, causing flaky test failures.
Fix: create a helper `getTransactionEmailSentAt(txId)` that queries the DB, and assert on that value.

**Why:** The original approach checked `expect(sendPurchaseReceipt).toHaveBeenCalledTimes(1)`. Since the mock was module-level and tests ran in the same describe block, call counts accumulated. Checking actual DB state is the ground truth and avoids mock-isolation issues.

**Source task:** `2133`
