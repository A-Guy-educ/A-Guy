# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | 6 files |

### Task Summary
> Bug: Non-atomic guest session claim causes orphaned conversations and data loss

### Assumptions
- Payload CMS transaction support is available and properly configured
- The 'req' object is available in the calling contexts (login/signup actions)
- Guest sessions are identified by a unique session ID that can be marked as 'claiming'

### Review Questions
1. Should the fix include new integration tests to verify the atomic behavior?
2. Is adding a 'claiming' state to the guest session collection acceptable, or should this be handled via in-memory state?
3. Should the cron cleanup job be modified to be less aggressive given this fix?

---

Reply `approve` to proceed.
Reply `reject` to cancel.
