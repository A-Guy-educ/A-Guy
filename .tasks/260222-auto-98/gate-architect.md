# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | `src/server/guest-session.ts`, `src/server/guest-session-upgrade.ts` |

### Task Summary
> Both `guest-session.ts` and `guest-session-upgrade.ts` use `getPayload({ config })` to get a standalone Payload instance. All CRUD operations run outside any request transaction.

### Assumptions
- PayloadRequest type is available for typing the req parameter
- Both services are called from contexts where req can be passed
- The fix requires passing req to all Payload operations for transaction safety

### Plan
```
# Plan: Transaction Safety Fix for Guest Session Services

**Task ID**: 260222-auto-98
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

---

## Summary

Both `guest-session.ts` and `guest-session-upgrade.ts` create standalone Payload instances via `getPayload({ config })` inside every function call, rather than accepting a `req` (PayloadRequest) parameter. This means all CRUD operations run outside any request transaction. The `claimGuestConversations` function in `guest-session-upgrade.ts` claims atomicity but uses a for-loop of individual updates without `req` — if one update fails mid-loop, partial transfer results.

**Root Cause**: Functions use `getPayload({ config })` internally instead of accepting and forwarding `req` from the caller's request context. This prevents Payload's transaction system from grouping operations atomically.

---

## Assumptions

1. **Backward compatibility**: Callers that don't have a `req` available (e.g. server actions using `getPayload`) should still work. We make `req` optional so existing callers don't break.
2. **PayloadRequest type**: We use `PayloadRequest` from `payload` which includes `payload` instance and transaction context. When `req` is provided, we use `req.payload` instead of `getPayload({ config })`.
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
