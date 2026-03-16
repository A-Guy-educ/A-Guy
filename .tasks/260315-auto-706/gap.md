# Gap Analysis: 260315-auto-706

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: LessonCard Missing ContentStatusBadge

**Severity:** High
**Location:** `src/app/(frontend)/courses/_components/LessonCard/index.tsx`
**Issue:** The LessonCard component does NOT display the ContentStatusBadge. According to the task requirements:
- "Soon" badge should appear on Lesson cards
- "Just Added" badge should appear on Lesson cards
- Badge placement: "Next to the lesson title or the progress circle"

**Current State:**
- Courses (CourseCard): ✅ Has ContentStatusBadge + locked behavior
- Lessons (LessonCard): ❌ Missing ContentStatusBadge + locked behavior

**Fix Required:**
1. Import ContentStatusBadge and toast
2. Add badge rendering next to lesson title
3. Add locked behavior to prevent navigation for "Soon" lessons

### Gap 2: LessonCard Missing Locked Behavior for "Soon" Lessons

**Severity:** High
**Location:** `src/app/(frontend)/courses/_components/LessonCard/index.tsx`
**Issue:** When a lesson has "Soon" status:
- Students should NOT be able to click into it
- Clicking should show the toast message: "This content is being prepared and will be available soon"
- The button should be disabled with appropriate styling

**Current State:**
- CourseCard: ✅ Implements locked behavior with toast message
- LessonCard: ❌ No lock behavior - always navigates

**Fix Required:**
1. Check lesson.contentStatus === 'soon'
2. Show toast message on click
3. Disable navigation for "Soon" lessons

## Changes Made to Spec

- **Updated spec.md** with complete implementation status:
  - Marked existing implementations as ✅
  - Marked LessonCard gaps as ❌
  - Added specific file locations and code patterns to follow
  - Added implementation details for the developer

## Implementation Pattern

The developer should follow the exact pattern from CourseCard (`src/app/(frontend)/courses/_components/CourseCard/index.tsx`):

### Code to Add to LessonCard:

```typescript
// Imports
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { toast } from 'sonnet'

// Inside component:
const isSoon = lesson.contentStatus === 'soon'

// Badge display (in CardHeader, after title):
<ContentStatusBadge
  contentStatus={lesson.contentStatus}
  contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
/>

// Locked behavior (handleClick or similar):
const handleClick = () => {
  if (isSoon) {
    toast.info(t('contentLocked'))
    return
  }
  // existing navigation
}

// Button disabled state:
disabled={isSoon}
```

## Validation Notes

Explored the following codebase areas:

| Component | Status | Location |
|-----------|--------|----------|
| contentStatusFields | ✅ Implemented | `src/server/payload/fields/contentStatus.ts` |
| Courses collection | ✅ Has fields | `src/server/payload/collections/Courses.ts` |
| Lessons collection | ✅ Has fields | `src/server/payload/collections/Lessons.ts` |
| ContentStatusBadge UI | ✅ Implemented | `src/ui/web/shared/ContentStatusBadge/index.tsx` |
| CourseCard Badge | ✅ Implemented | `src/app/(frontend)/courses/_components/CourseCard/index.tsx` |
| LessonCard Badge | ❌ Missing | `src/app/(frontend)/courses/_components/LessonCard/index.tsx` |
| Course locked behavior | ✅ Implemented | CourseCard handleCourseSelect |
| Lesson locked behavior | ❌ Missing | LessonCard |
| Translations | ✅ Implemented | `src/i18n/en.json`, `src/i18n/he.json` |
| Query filtering | ✅ Implemented | `src/server/repos/queries/courses.ts`, `lessons.ts` |

## Conclusion

The feature is **mostly implemented** with only the LessonCard component missing. The backend fields, ContentStatusBadge component, CourseCard integration, translations, and query filtering all work correctly. The only required change is adding the badge display and locked behavior to the LessonCard component.
