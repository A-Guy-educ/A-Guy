# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | `src/server/payload/collections/ExerciseAssets.ts` |

### Task Summary
> Security: ExerciseAssets collection allows any authenticated user to delete/update any asset

### Assumptions
- The adminOnly access function exists in the codebase
- The conversion pipeline that creates assets uses overrideAccess: true internally so it will continue to work

### Review Questions
1. Should we use adminOnly or implement isAdminOrOwner pattern similar to Exercises collection?
2. Are there any external integrations or tests that depend on authenticated users being able to delete/update ExerciseAssets?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
