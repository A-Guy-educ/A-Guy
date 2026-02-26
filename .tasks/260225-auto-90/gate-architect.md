# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | low |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | `src/server/services/guest-session.ts` |

### Task Summary
> [LOW] Bug: guest-sessions collection uses 'as any' x7 — not in type registry

### Assumptions
- The guest-sessions collection slug is valid but not in generated types
- Running generate:types will register the collection properly
- No runtime behavior changes - only type fixes

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
