# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.85 |
| **Scope** | `exercise hooks`, `transaction safety`, `payload cms hooks` |

### Task Summary
> fix: bug: exercise hooks bypass transaction safety — use standalone getpay...

### Assumptions
- The bug is in exercise-related hooks that don't properly use transaction-safe patterns
- The fix involves ensuring req.payload is used instead of standalone getPayload() calls
- File: src/server/payload/collections/Exercises/hooks.ts contains the problematic code

### Plan
```
# Plan: 260224-auto-59 — Fix Transaction Safety in Exercises Hooks

## Summary

Remove the `getPayloadInstance()` anti-pattern fallback from the Exercises hooks file. Both `generateSlug` and `validateSlugUniqueness` currently fall back to a standalone Payload instance when `req.payload` is missing, which breaks transaction boundaries. Since Payload 3.x guarantees `req.payload` during hook execution, the fallback is unnecessary and harmful. The fix is to delete the helper, use `req.payload` unconditionally, and update tests accordingly.

## Assumptions

- `req.payload` is always available during Payload 3.x field hook execution (documented Payload guarantee).
- No other files import or depend on `getPayloadInstance()` from the hooks file.
- The `formatSlug` helper and slug logic itself are correct and out of scope.

---

### Step 1: Remove `getPayloadInstance` and Use `req.payload` Unconditionally

**Root Cause**: Lines 7-11 define `getPayloadInstance()`, and lines 31 and 80 use `req?.payload ?? (await getPayloadInstance())`. This fallback creates a new Payload instance outside the request transaction, breaking atomicity. (FR-001, FR-002, FR-003)

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 7-11 DELETE, line 31 MODIFY, line 80 MODIFY)
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
