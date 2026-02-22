# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | `src/server/guest-session.ts`, `src/server/guest-session-upgrade.ts` |

### Task Summary
> Both `guest-session.ts` and `guest-session-upgrade.ts` use `getPayload({ config })` to get a standalone Payload instance. All CRUD operations run outside any request transaction.

### Assumptions
- PayloadRequest type is available for typing the req parameter
- Both services are called from contexts where req can be passed
- The fix requires passing req to all Payload operations for transaction safety

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
