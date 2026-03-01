# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | refactor |
| **Confidence** | 1 |
| **Scope** | `src/app/api/exercises/convert/queue/route.ts`, `src/app/api/exercises/convert/queue-v2/route.ts`, `src/app/api/prompts/for-conversion/route.ts`, `src/server/api/auth.ts (existing utility to use)` |

### Task Summary
> Replace duplicated admin auth pattern in conversion endpoints with centralized utility

### Assumptions
- The existing requireAdminOrTestSecret utility in src/server/api/auth.ts correctly handles all auth cases
- The utility accepts the same parameters (user, authHeader) as the current duplicated logic

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
