
### build (2026-04-03T08:46:19)
Typecheck passes with no errors. The implementation is complete and correct.

**Summary of what's already implemented:**

The feature was implemented in the previous task run (`1107-260403-081557`, commit `116bd638`). The `Courses.ts` collection config has:

1. **`status` column** — The `status` select field (draft/published/archived) was already defined and is included in `defaultColumns` at line 66.

2. **`chapters` count column** — Added a `join` field (lines 268-276) that creates a virtual r
...(truncated)
