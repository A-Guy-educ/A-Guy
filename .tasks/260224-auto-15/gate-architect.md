# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | 6 files |

### Task Summary
> [HIGH] Security: Content collections use 'authenticated' instead of 'adminOnly' for create/update/delete

### Assumptions
- adminOnly access function exists at src/server/payload/access/adminOnly.ts
- admin role exists in Users collection (verified in src/server/payload/collections/Users/roles.ts)
- All affected collections use the same adminOnly import path pattern

### Plan
```
# Plan: Fix Security — Content collections use 'authenticated' instead of 'adminOnly'

**Task ID**: 260224-auto-15
**Task Type**: fix_bug
**Priority**: HIGH — Security vulnerability, privilege escalation
**Estimated Time**: ~30 minutes (1 step)

## Summary

Six content-management collections (`Courses`, `Chapters`, `Lessons`, `Categories`, `PricingPlans`, `Media`) use the `authenticated` access function for `create`, `update`, and `delete` operations. This allows **any logged-in user** (including students) to mutate administrative content. The fix replaces `authenticated` with `adminOnly` for write operations across all six collections.

## Assumptions

- **Confirmed**: `adminOnly` access function exists at `src/server/payload/access/adminOnly.ts` — checks `user.role === AccountRole.Admin`
- **Confirmed**: `AccountRole.Admin = 'admin'` exists in `src/server/payload/collections/Users/roles.ts`
- **Confirmed**: All 6 collections currently import `authenticated` from `../access/authenticated` (or `../../access/authenticated` for Media)
- The `read` access (`anyone`) stays unchanged — these are public-read collections
- No other collections besides the 6 listed need this fix (scope from task spec)

---
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
