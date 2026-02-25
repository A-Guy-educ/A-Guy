# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | low |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/server/services/guest-session.ts` |

### Task Summary
> [LOW] Bug: guest-sessions collection uses 'as any' x7 — not in type registry

### Assumptions
- GuestSessions collection exists and is properly exported in payload.config.ts

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
