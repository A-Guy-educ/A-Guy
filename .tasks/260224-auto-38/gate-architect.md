# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/server/payload/collections/Exercises/hooks.ts` |

### Task Summary
> [HIGH] Bug: Exercise hooks bypass transaction safety — use standalone getPayload() instead of req.payload

### Plan
```
# Plan: Fix Exercise Hooks Transaction Safety

**Task ID**: 260224-auto-38
**Task Type**: fix_bug
**Risk Level**: HIGH
**Issue**: #505

## Summary

The `generateSlug` and `validateSlugUniqueness` hooks in `src/server/payload/collections/Exercises/hooks.ts` contain a `getPayloadInstance()` helper that creates a standalone Payload instance via `getPayload({ config })`. This standalone instance operates outside the current request's database transaction, creating a race condition risk for slug uniqueness checks. The fix removes the standalone fallback and mandates use of `req.payload` which is always provided by Payload's hook system.

## Assumptions

1. Payload CMS **always** provides `req` with a valid `req.payload` in `FieldHook` callbacks. This is documented Payload behavior — hooks are never called without a request context.
2. There are no external callers of `generateSlug` or `validateSlugUniqueness` that pass `req: undefined`. These are only used as Payload field hooks.
3. The existing "fallback to getPayloadInstance" tests in the test file should be **replaced** with tests asserting that missing `req.payload` throws an error (fail-fast behavior).

---

### Step 1: Add Reproduction Tests & Update Existing Tests
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
