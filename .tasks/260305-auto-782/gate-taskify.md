# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `Create shared auth middleware: src/server/payload/endpoints/agent/auth-middleware.ts`, `Refactor 5 chat endpoints to use shared middleware`, `Fix rate-limit bypass in reset-chat.ts`, `Fix access control bypass in conversations/by-context GET`, `Fix message limit inconsistency between chat.ts and chat-stream.ts` |

### Task Summary
> Security/Refactor: Chat endpoints duplicate auth logic — rate-limit bypass on reset-chat, missing overrideAccess:false

### Assumptions
- All mentioned files exist at specified paths
- checkRateLimit, checkAndIncrementGuestMessageCount functions exist as described
- Collection access control (isOwner) exists for conversations collection

### Review Questions
1. Are there any other endpoints in the codebase with similar auth duplication issues?
2. Should the shared middleware be placed in a different location for better organization?
3. Is there existing test coverage for these endpoints that needs to be updated?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
