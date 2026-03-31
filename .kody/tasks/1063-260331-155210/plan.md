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
  // Pre-computed URL for fast access
  lessonUrl: string
}

export interface TopicInput {
  topicId: string
  topicLabel: string
  mastery: MasteryLevel
  lessonRef?: LessonRef // Present when selected from course syllabus
}
```

**Why:** `DayCard` needs a stable URL to navigate to a lesson. Storing the pre-computed URL avoids recomputing it on every render. The `lessonRef` is optional so free-text topics continue to work unchanged.

**Verify:** `pnpm typecheck` passes

---

### Step 2: Add course syllabus API endpoint

**File:** `src/app/api/course-syllabus/route.ts` (new file)

**Change:** New GET endpoint that accepts `courseId` and returns chapters with lessons:

```typescript
/**
 * @fileType api-route
 * @domain courses
 * @pattern course-syllabus
 * @ai-summary Returns full syllabus (chapters + lessons) for a course
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { queryLessonsByChapter } from '@/server/repos/queries/lessons'
import { buildLessonUrl } from '@/server/utils/course-url-builder'

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  const chapters = await queryChaptersByCourse({ courseId })

  const syllabus = await Promise.all(
    chapters.map(async (chapter) => {
      const lessons = await queryLessonsByChapter({ chapterId: chapter.id })
      return {
        chapterId: chapter.id,
        chapterLabel: chapter.chapterLabel,
        chapterTitle: chapter.title,
        chapterSlug: chapter.slug,
        lessons: lessons.map((lesson) => ({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonSlug: lesson.slug,
          lessonOrder: lesson.order,
          lessonUrl:
            buildLessonUrl(),
            // courseSlug not available on chapter at depth-1 from this query path
            // We'll look it up via chapter.course
        })),
      }
    }),
  )

  return NextResponse.json({ success: true, data: syllabus })
}
```

**Why:** The frontend needs to fetch the syllabus tree without coupling to Payload internals. This is a clean API boundary.

**Verify:** `pnpm typecheck` passes

---

### Step 3: Add `LessonSelector` UI component

**File:** `src/app/(frontend)/study-plan/_components/LessonSelector/index.tsx` (new)

**Change:** New collapsible panel with a hierarchical list of chapters → lessons. Each lesson is a checkbox/toggle. Selected lessons are converted to `TopicInput[]` and passed to the parent via callback.

Key behaviors:

- Fetches syllabus from `/api/course-syllabus?courseId=<id>` on mount
- Renders as a nested list: Chapter Label → Lesson Title (with type badge)
- Selected state persisted locally until added to topics list
- "Add Selected" button converts selected lessons to `TopicInput` with `lessonRef` populated
- Graceful loading/error/empty states

```typescript
'use client'
// Full implementation with:
// - fetchSyllabus(courseId) call
// - ChapterAccordion open/close state
// - per-lesson checkbox toggle
// - "Add Selected" button that calls onAddLessons(lessonRefs: LessonRef[])
// - Shows lesson type badge (learning/practice/exam)
```

**Why:** This is the core UX — a hierarchical course browser that feeds directly into the topics list. Keeping it isolated makes it easy to test.

**Verify:** `pnpm typecheck` and `pnpm lint` pass

---

### Step 4: Integrate `LessonSelector` into `StudyPlanPage`

**File:** `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

**Change:**

- Import `LessonSelector` and `LessonRef` type
- Add `showCourseSelector` state (boolean toggle)
- Add "Select from Course" toggle button above the free-text input
- When user adds lessons via `LessonSelector`, they appear as `TopicInput` with `lessonRef` set
- Pass `courseId="default-course"` (or the user's selected course) to `LessonSelector`

The Topics Card becomes:

```
Topics Card
├── "Select from Course" toggle button
├── [LessonSelector collapsible panel - shown when toggle is ON]
├── [free-text input row - shown when toggle is OFF, or always visible below]
└── [topic pills list]
```

**Why:** Hybrid UX — users can still type topics freely, but can now also select from the course syllabus.

**Verify:** `pnpm typecheck` and `pnpm lint` pass; manual test at `/study-plan`

---

### Step 5: Update `DayCard` to render lesson navigation links

**File:** `src/app/(frontend)/study-plan/_components/DayCard.tsx`

**Change:** In display mode, for each topic pill, check if `topic.lessonRef` exists. If so, render as a `<Link>` to `topic.lessonRef.lessonUrl` instead of a plain `<span>`. The click navigates to the lesson page.

```typescript
// In the topic pills map:
{(day.userTopicIds || day.topicIds).map((id, idx) => {
  const topic = topics.find((t) => t.topicId === id)
  if (!topic) return null

  if (topic.lessonRef) {
    return (
      <Link
        key={idx}
        href={topic.lessonRef.lessonUrl}
        className="px-2 py-0.5 text-body-xs font-medium bg-muted text-foreground rounded-md transition-all duration-normal hover:bg-primary/10 hover:text-primary"
      >
        {topic.topicLabel}
      </Link>
    )
  }

  return (
    <span key={idx} className="...">
      {topic.topicLabel}
    </span>
  )
})}
```

**Why:** The "Smart Navigation Buttons" requirement — links in the study plan navigate directly to the lesson page.

**Verify:** `pnpm typecheck` and `pnpm lint` pass

---

### Step 6: Add new translation strings

**Files:** `src/i18n/en.json`, `src/i18n/he.json`

**Change:** Add keys under `studyPlan`:

```json
"selectFromCourse": "Select from Course",
"courseSyllabus": "Course Syllabus",
"noCourseSelected": "No course selected",
"selectLessonsHint": "Choose lessons from your course to add as study topics",
"selectedCount": "{{count}} lesson selected",
"selectedCount_plural": "{{count}} lessons selected",
"lessonTypes": {
  "learning": "Learning",
  "practice": "Practice",
  "exam": "Exam"
}
```

**Why:** All UI strings must be translatable per project convention.

**Verify:** `pnpm format` does not produce diffs

---

### Step 7: Unit tests for new components

**Files:** `tests/unit/services/study-plan/engine.spec.ts` (extend existing), `tests/unit/components/LessonSelector.test.tsx` (new), `tests/unit/services/study-plan/types.spec.ts` (new)

**Change:**

- Test that `TopicInput` with `lessonRef` is accepted by `sortTopicsByPriority`, `buildTopicCycle`, `pickTopicsForDay`
- Test `LessonSelector` renders chapters and lessons, handles selection state, calls callback with correct `LessonRef[]`
- Test that `DayCard` renders `<Link>` for lesson-backed topics

**Verify:** `pnpm test:int` passes

---

### Step 8: Integration test for syllabus API

**File:** `tests/int/course-syllabus.int.spec.ts` (new)

**Change:**

- Create a course with chapters and lessons in the test DB
- Call `GET /api/course-syllabus?courseId=<id>`
- Assert response has chapters with nested lessons and correct URLs

**Verify:** `pnpm test:int` passes

---

## Questions

- **Syllabus URL resolution:** The `buildLessonUrl` requires `courseSlug` and `chapterSlug`. Currently `queryChaptersByCourse` returns chapters at `depth: 1`, meaning `chapter.course` would be populated with the full course object. I need to confirm: should the API fetch the course at all (adding a DB round-trip), or should the course slug be passed as a query param from the client (which already knows it from `userProfile`)? Recommendation: pass `courseSlug` as a query param to avoid extra DB lookups.
