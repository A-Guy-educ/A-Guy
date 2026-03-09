# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | refactor |
| **Confidence** | 0.95 |
| **Scope** | `Courses collection slug generation`, `Chapters collection slug generation`, `Lessons collection slug generation`, `Exercises collection slug generation`, `Shared formatSlug utility` |

### Task Summary
> Refactor: Duplicated formatSlug function across 3 collections lacks Hebrew support

### Assumptions
- Exercises collection's formatSlug implementation is production-ready and works correctly with Hebrew locale
- The shared utility will work for all 4 collections without breaking existing functionality
- Existing slugs will continue to work after refactoring (backward compatible)

### Review Questions
1. Should Exercises collection also import from the shared utility, or keep its own implementation?
2. Are there any existing tests for the formatSlug function that need updating?
3. Should we migrate existing broken Hebrew slugs, or only fix new ones?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
