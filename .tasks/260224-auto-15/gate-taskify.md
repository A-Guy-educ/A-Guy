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

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
