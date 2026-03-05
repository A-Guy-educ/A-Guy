# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/server/payload/collections/ExerciseAssets.ts` |

### Task Summary
> [HIGH] Bug: ExerciseAssets uses local staticDir instead of Vercel Blob

### Assumptions
- Vercel Blob is already configured in the project
- The Media collection has the correct Vercel Blob pattern to follow
- The migration is straightforward config change

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
