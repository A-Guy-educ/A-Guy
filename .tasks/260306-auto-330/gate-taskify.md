# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | refactor |
| **Confidence** | 0.95 |
| **Scope** | 6 files |

### Task Summary
> Refactor: Cody API routes use blanket eslint-disable, no-explicit-any, and lack input validation

### Assumptions
- Zod is already available in the codebase (confirmed by grep)
- The existing route patterns in src/app/api/cody/chat/route.ts can be used as reference
- A shared utility in lib/ or ui/cody/ directory is the appropriate location for error handling

### Review Questions
1. Where should the shared GitHub API error handler utility be located - lib/utils or ui/cody?
2. Should the Zod schemas be defined inline in each route or in a shared location?
3. Are there any specific error codes from the GitHub API that need special handling beyond 401 and 403?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
