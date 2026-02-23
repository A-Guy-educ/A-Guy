# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.9 |
| **Scope** | `Exercises collection slug generation hook` |

### Task Summary
> The `Exercises` collection's slug generation hook currently uses an unbounded `while (true)` loop to find a unique slug by appending incrementing numbers. This can cause an infinite loop or excessive database queries if thousands of exercises share the same title within a lesson. This task will introduce a safety limit (`MAX_SLUG_ATTEMPTS`) to the loop to prevent runaway execution.

### Assumptions
- The Exercises collection exists and has a slug generation hook with unbounded while loop

### Plan
```
# Plan: 260223-auto-62 — Fix Exercise Slug Generation Infinite Loop & Transaction Safety

## Summary

The `Exercises` collection's `generateSlug` hook uses an unbounded `while(true)` loop that can cause infinite loops or excessive DB queries. Additionally, both `generateSlug` and `validateSlugUniqueness` hooks use a standalone `getPayloadInstance()` helper instead of the `req.payload` from hook arguments, violating transaction safety.

**Bug 1 (FR-001, FR-002)**: `while(true)` loop in `generateSlug` has no upper bound → infinite loop risk.
**Bug 2 (FR-003, FR-004)**: Both hooks use `getPayloadInstance()` instead of `req.payload` → breaks transaction atomicity and bypasses proper access control scoping.
**Bug 3 (NFR-001)**: `find()` calls lack `depth: 0` → unnecessary relationship resolution during existence checks.

**File under fix**: `src/server/payload/collections/Exercises/hooks.ts` (92 lines)

---

## Step 1: Add MAX_SLUG_ATTEMPTS Constant and Cap the Loop

**Root Cause**: The `while(true)` loop at line 35 of `hooks.ts` has no termination condition other than finding a unique slug. If thousands of exercises share the same title in a lesson, this loops indefinitely making one DB query per iteration.

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 1-57)
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
