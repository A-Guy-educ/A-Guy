# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/server/payload/collections/Exercises/hooks.ts` |

### Task Summary
> The slug generation hook uses a `while(true)` loop to find a unique slug by appending incrementing numbers. There is no upper bound — if thousands of exercises share the same title in a lesson, this runs unbounded queries.

### Plan
```
# Plan: 260222-auto-01 — Bound Slug Generation Loop & Transaction Safety

## Summary

The `generateSlug` field hook in `src/server/payload/collections/Exercises/hooks.ts` uses an unbounded `while (true)` loop that can cause infinite loops or excessive DB queries. We will:

1. Add a `MAX_SLUG_ATTEMPTS = 100` safety constant and enforce it in the loop
2. Throw a descriptive error when attempts are exhausted
3. Migrate both `generateSlug` and `validateSlugUniqueness` from `getPayloadInstance()` to `req.payload.find()` for transaction safety (with fallback)

## Assumptions

- `FieldHook` type from Payload 3.x provides `req` in its arguments (it does — it's a standard hook argument)
- Unit tests will mock `req.payload.find` directly rather than mocking `getPayload` + `@payload-config`
- The `formatSlug` utility is unmodified and continues to work as-is
- Tests go in `tests/unit/collections/exercises-hooks.test.ts` (new file) following existing test patterns

---

## Step 1: Add Unit Tests for Slug Generation Bug & Transaction Safety
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
