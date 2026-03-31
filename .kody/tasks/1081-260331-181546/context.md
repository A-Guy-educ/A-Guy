
### taskify (2026-03-31T18:20:13)
Based on my analysis:

**The Issue**: In Payload admin, when searching the Lessons collection, users can only search by the lesson's own title. The search doesn't traverse the relationship path `lesson → chapter → course` to also search by the course's `courseLabel` and `title`.

**The Fix**: Add `admin.searchFilters` to the Lessons collection to enable searching through the chapter->course relationship.

```json
{
  "task_type": "bugfix",
  "title": "Add course search filters to lessons admin",
...(truncated)

### build (2026-03-31T18:39:58)
## Summary

After extensive investigation, I've confirmed:

1. **`admin.searchFilters` does NOT exist in Payload 3.73** - This property was not found in any Payload type definitions or source code.

2. **`listSearchableFields` is the correct property** for admin search in Payload. The file already has this configured at line 76:
   ```typescript
   listSearchableFields: ['chapter.course.courseLabel', 'chapter.course.title'],
   ```

3. **The current implementation is correct per Payload's API**,
...(truncated)
