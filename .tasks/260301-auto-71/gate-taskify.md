# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.8 |
| **Scope** | `media uploads`, `Courses collection`, `Lessons collection`, `Exercises collection` |

### Task Summary
> Bug Report: Media Upload Failure in Course/Lesson/Exercise

### Assumptions
- The media collection exists and is properly configured in Payload
- Storage backend (Vercel Blob or local) is configured
- The issue is in the upload endpoint or collection config for media fields

### Review Questions
1. What is the exact error message returned in the 400 Bad Request?
2. Is this issue specific to certain file types or all media?
3. Which specific collection (Course/Lesson/Exercise) and field is failing?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
