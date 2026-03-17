# Plan: Fix Lesson Completion Redirect to Old Display Page

**Task ID**: 260316-auto-877
**Task Type**: fix_bug
**Spec Reference**: Issue #851

## Rerun Context

This is a fix rerun. No previous plan/build/review artifacts exist in `prev-run/`. This is effectively a fresh plan.

## Research Findings

- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` — Lesson page, sets `backUrl` (line 107)
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Pager component with "Finish" button on outro screen
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts` — Pager state management
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx` — Exercise page, sets `backUrl` (line 101)
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx` — Complete page, sets `backUrl` (line 81)
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/CompleteContent.tsx` — Complete UI component
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` — Chapter page (OLD display: basic lesson list)
- ✅ `src/app/(frontend)/courses/[courseSlug]/page.tsx` — Course page (NEW display: tabbed Learn/Practice/Ask/Exams)
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx` — New course page with tabs
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — New lesson cards linking to `/courses/X/chapters/Y/lessons/Z`
- 🆕 `tests/unit/exercises-pager-back-url.test.ts` — New test for back URL behavior

### Patterns Observed

- Navigation URLs are hardcoded string templates with route params
- `backUrl` is computed at the server page level and passed down as a prop
- Three places compute `backUrl` for lesson navigation: lesson page, exercise page, complete page
- The **course page** (`/courses/X`) is the modern tabbed UI (Learn/Practice/Ask/Exams)
- The **chapter page** (`/courses/X/chapters/Y`) is the older list view with breadcrumbs
- All lesson cards on the course page link directly to `/courses/X/chapters/Y/lessons/Z` (bypassing the chapter page)

### Integration Points

- `ExercisesPager` receives `backUrl` as a prop — used in the "Finish" button on the outro screen
- `ExerciseWorkspace` receives `backUrl` as a prop — used in the `ExerciseHeader` back button
- `CompleteContent` receives `backUrl` as a prop — used in the "Back" buttons

## Root Cause Analysis

When a student completes an interactive lesson via the `ExercisesPager`, clicking the "Finish" button on the outro screen navigates to `backUrl`. This URL is computed differently depending on entry point:

| Entry Point | `backUrl` Value | Destination |
|---|---|---|
| Lesson page (`/courses/X/chapters/Y/lessons/Z`) | `/courses/X/chapters/Y` | **Chapter page** (OLD view) |
| Exercise page (`/courses/X/chapters/Y/lessons/Z/exercises/E`) | `/courses/X/chapters/Y/lessons/Z` | Lesson page (loops back) |
| Complete page (`/courses/X/chapters/Y/lessons/Z/complete`) | `/courses/X/chapters/Y/lessons/Z` | Lesson page (loops back) |

The **lesson page** sets `backUrl` to the chapter page (`/courses/${courseSlug}/chapters/${chapterSlug}`) on line 107. The chapter page shows a basic list of lessons — this is the "old display/view page" referenced in the bug report.

The **expected behavior** is that after completing a lesson, the "Finish" button should navigate to the **course page** (`/courses/${courseSlug}`) which is the modern tabbed view where lessons are listed by chapter. This is the "current/new display page" the user expects.

The `CourseLessonCard` on the course page links directly to lessons via `/courses/X/chapters/Y/lessons/Z`, so users arrive at lessons FROM the course page. The "Finish" button should take them BACK to the course page, not to an intermediate chapter page they never visited.

## Reuse Inventory

- No new utilities needed
- Existing `SystemLink` component — already in use ✅
- Existing `ExercisesPager` patterns — will be modified ✅

## Plan Steps

### Step 1: Fix `backUrl` in Lesson Page

**Root Cause**: The lesson page (`page.tsx`) sets `backUrl` to the chapter page URL instead of the course page URL.

**Files to Touch**:

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — line 107)

**Reproduction Test**:

- Test location: `tests/unit/exercises-pager-back-url.test.ts`
- Test: Verify that `backUrl` computed in the lesson page is the **course page URL** (`/courses/${courseSlug}`), not the chapter page URL
- Why it fails: Currently `backUrl = /courses/${courseSlug}/chapters/${chapterSlug}` which navigates to the old chapter page

**Fix**: Change line 107 from:
```typescript
const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`
```
to:
```typescript
const backUrl = `/courses/${courseSlug}`
```

**Verification**:

- Run test → FAILS (expects `/courses/${courseSlug}`, gets `/courses/${courseSlug}/chapters/${chapterSlug}`)
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `backUrl` in lesson page points to `/courses/${courseSlug}`
- [ ] The "Finish" button on the ExercisesPager outro screen navigates to the course page
- [ ] The back arrow in ExerciseWorkspace header navigates to the course page

### Step 2: Fix `backUrl` in Exercise Page

**Root Cause**: The exercise page currently sets `backUrl` to the lesson page URL. This is used when the ExercisesPager is rendered from a direct exercise URL. When the user finishes from here, they go back to the lesson page which shows the ExercisesPager intro — creating a loop instead of returning to the course overview.

**Files to Touch**:

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx` (MODIFIED — line 101)

**Reproduction Test**:

- Test location: `tests/unit/exercises-pager-back-url.test.ts`
- Test: Verify that `backUrl` computed in the exercise page is the **course page URL**
- Why it fails: Currently `backUrl = /courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}` 

**Fix**: Change line 101 from:
```typescript
const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
```
to:
```typescript
const backUrl = `/courses/${courseSlug}`
```

**Verification**:

- Run test → FAILS (expects course URL, gets lesson URL)
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `backUrl` in exercise page points to `/courses/${courseSlug}`
- [ ] The back arrow from exercise workspace navigates to course page

### Step 3: Fix `backUrl` in Complete Page

**Root Cause**: The complete page (`/complete`) sets `backUrl` to the lesson page URL. This is the fallback server-rendered complete page (when the user refreshes on `/complete` URL). After completing, clicking "Back" should go to the course page.

**Files to Touch**:

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx` (MODIFIED — line 81)

**Reproduction Test**:

- Test location: `tests/unit/exercises-pager-back-url.test.ts`
- Test: Verify that `backUrl` in complete page is the **course page URL**
- Why it fails: Currently `backUrl = /courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`

**Fix**: Change line 81 from:
```typescript
const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
```
to:
```typescript
const backUrl = `/courses/${courseSlug}`
```

**Verification**:

- Run test → FAILS (expects course URL, gets lesson URL)
- After fix → PASSES

**Acceptance Criteria**:
- [ ] `backUrl` in complete page points to `/courses/${courseSlug}`
- [ ] Both buttons in `CompleteContent` navigate to the course page

### Step 4: Verify TypeScript Compilation and Existing Tests

**Files to Touch**: None (verification only)

**Commands**:
```bash
pnpm tsc --noEmit
pnpm test:int --run 2>&1 | head -50
```

**Acceptance Criteria**:
- [ ] TypeScript compilation passes with no errors
- [ ] No existing tests break from the URL change
- [ ] The change is limited to 3 lines across 3 files
