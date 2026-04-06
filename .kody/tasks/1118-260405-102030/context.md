
### taskify (2026-04-05T10:32:04)
I found the issue. Both `useLessonPager.ts` and `usePdfLessonPager.ts` construct a `viewUrl` with a `/view` suffix, but there's no `/view` route defined for lessons. When the pager syncs the URL for PDF state, it causes a 404.

The PDF viewer is displayed on the same lesson page (same basePath URL), so the `/view` suffix is incorrect. The fix is to remove the `/view` suffix from the PDF URL and use the basePath instead.

```json
{
  "task_type": "bugfix",
  "title": "Fix lesson URL generation re
...(truncated)

### build (2026-04-05T11:15:12)
The fix has already been applied to the working directory. Here's a summary of the changes:

**In `useLessonPager.ts`:**
- Renamed `viewUrl = \`${basePath}/view\`` to `pdfUrl = basePath`
- Updated all references from `viewUrl` to `pdfUrl`

**In `usePdfLessonPager.ts`:**
- Renamed `viewUrl = \`${basePath}/view\`` to `pdfUrl = basePath`
- Updated all references from `viewUrl` to `pdfUrl`

**The bug:** Both hooks were constructing a URL with `/view` suffix (e.g., `/courses/.../lessons/.../view`) fo
...(truncated)
