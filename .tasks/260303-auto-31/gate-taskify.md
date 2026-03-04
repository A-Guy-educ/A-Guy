# Gate Request

## 🚫 Hard Stop: Approval Required

This task has been classified as **high risk** and requires mandatory approval before proceeding.

| Field | Value |
|-------|-------|
| **Control Mode** | hard-stop |
| **Risk Level** | high |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/server/payload/collections/Courses.ts`, `src/server/payload/collections/Chapters.ts`, `src/server/payload/collections/Lessons.ts`, `src/server/payload/access/authenticatedOrPublished.ts` |

### Task Summary
> Security: Content collections (Courses, Chapters, Lessons) expose draft/archived content publicly

### Assumptions
- The authenticatedOrPublished function will need modification to check custom 'status' field instead of '_status'
- Frontend queries that use authenticated users will continue to work without changes
- All three collections use the same 'status' and 'isActive' field structure

### Review Questions
1. Does the existing authenticatedOrPublished function need to be modified to support custom 'status' field, or should a new function be created?
2. Should the access control also check 'isActive: true' for public queries as shown in the task example?
3. Will this change affect any existing frontend functionality that relies on reading draft content?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
