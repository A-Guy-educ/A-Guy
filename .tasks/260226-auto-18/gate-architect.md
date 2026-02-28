# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 1 |
| **Scope** | `src/server/payload/collections/Courses.ts`, `src/server/payload/collections/Chapters.ts`, `src/server/payload/collections/Lessons.ts` |

### Task Summary
> [HIGH] Bug: Draft content publicly readable via API

### Assumptions
- Collections have a 'status' field with values 'draft | published | archived'
- The fix should filter by 'status' field, not '_status' (which is for drafts)
- May need to create a new access function or modify existing authenticatedOrPublished

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
