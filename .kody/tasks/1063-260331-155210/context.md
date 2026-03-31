### taskify (2026-03-31T15:55:40)

Now I have enough context to classify this task.

````json
{
  "task_type": "feature",
  "title": "Add course lesson selection to exam prep study plan",
  "description": "Enhance the study plan page to allow students to select exam topics from their registered course lessons (chapters and lessons) via a 'Select from Course' toggle, in addition to the existing free-text input. Selected lessons should auto-populate the topics list and generate navigation links to lesson pages in the study plan. Lin
...(truncated)

### plan (2026-03-31T15:56:32)
Now I have a thorough understanding of the codebase. Let me write the implementation plan.

---

## Plan: Course-Integrated Exam Prep Enhancement

### Step 1: Add lesson-reference fields to `TopicInput` type

**File:** `src/server/services/study-plan/types.ts`

**Change:** Extend `TopicInput` to optionally carry lesson metadata for URL generation:

```typescript
export interface LessonRef {
  lessonId: string
  lessonSlug: string
  chapterSlug: string
  courseSlug: string
  // Pre-computed URL f
...(truncated)
````

### build (2026-03-31T16:06:19)

All implementation steps are complete. Here's a summary of the changes:

## Summary

### Files Created (new):
1. **`src/app/api/course-syllabus/route.ts`** - GET endpoint that returns course syllabus (chapters + lessons) for a given `courseId`
2. **`src/app/(frontend)/study-plan/_components/LessonSelector/index.tsx`** - Collapsible panel UI for selecting lessons from the course syllabus

### Files Modified:
1. **`src/server/services/study-plan/types.ts`** - Added `LessonRef` interface and optio
...(truncated)
