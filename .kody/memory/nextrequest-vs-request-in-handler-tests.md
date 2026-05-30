---
name: nextrequest-vs-request-in-handler-tests
title: Nextrequest Vs Request In Handler Tests
type: lesson
source: task:2134
recorded_at: 2026-05-27T12:32:40Z
---

Next.js route handlers typed as `(req: NextRequest, { params }) =>` require `new NextRequest()` in test calls, not `new Request()`. The Payload REST API handler in transaction-refund.int.spec.ts uses `NextRequest` from 'next/server'.

**Why:** TypeScript error: Argument of type 'Request' is not assignable to parameter of type 'NextRequest'. Fix: import NextRequest and use it instead of Request in tests.

**Source task:** `2134`
