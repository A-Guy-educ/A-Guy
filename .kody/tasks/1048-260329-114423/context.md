### taskify (2026-03-29T11:47:22)

Now I have a complete understanding of the bug. Let me classify this task:

```json
{
  "task_type": "bugfix",
  "title": "Hide chat when lesson has no context text",
  "description": "Chat interface should be hidden in lesson views (PDF, exercises, content pages) when the lesson's 'lessonContextText' field is empty or null. Currently, chat is shown unconditionally in all lesson views regardless of whether context text exists.",
  "scope": [
    "src/app/(frontend)/courses/[courseSlug]/chapters/
...(truncated)

### build (2026-03-29T11:52:44)
All 4 files are updated correctly. The fix is complete.

Here's a summary of what was changed:

**Root cause**: The chat was always rendered regardless of whether the lesson had any `lessonContextText` configured.

**Fix**:
1. **`page.tsx`** — Computes `hasLessonContext = Boolean(lesson.lessonContextText?.trim())` and passes it to all child pager components. The empty lesson case also conditionally renders chat.

2. **`PdfLessonPager`**, **`ExercisesPager`**, **`LessonPager`** — Accept `hasLesso
...(truncated)
```
