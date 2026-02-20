# LLP: Lesson Exercises Pager Synced With Routes

> Implements spec: `.tasks/20261002-lesson-step-pager-routing/spec.md`

## Overview

Convert the in-memory `ExercisesPager` into a route-driven pager where:

- Intro = lesson route (existing)
- Each exercise = canonical route by slug (new)
- Complete = new `/complete` route
- Next/prev uses `<Link>` navigation, not `useState`

---

## Step 1: Extract shared `formatSlug` utility

**Why**: `formatSlug` is copy-pasted in 3 collection files (Courses, Chapters, Lessons). Exercises will be the 4th consumer. Extract once.

**File to create**:

- `src/server/payload/utils/format-slug.ts`

**Implementation**:

```typescript
export const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
```

**Files to update** (replace inline `formatSlug`):

- `src/server/payload/collections/Courses.ts:17-21` — remove local `formatSlug`, import from utility
- `src/server/payload/collections/Chapters.ts:8-12` — same
- `src/server/payload/collections/Lessons.ts:8-12` — same

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 2: Add `slug` field to Exercises collection

**Why**: Exercises currently use MongoDB `id` in URLs. Need `slug` for canonical routes.

**File to update**: `src/server/payload/collections/Exercises/index.ts`

**Changes**:

1. Import `formatSlug` from the new utility.

2. Add `slug` field inside the "Exercise Meta" collapsible, after `order` (line ~83):

   ```typescript
   {
     name: 'slug',
     type: 'text',
     required: true,
     index: true,
     admin: {
       description: 'URL-friendly identifier (unique within the lesson, auto-generated from title)',
     },
   }
   ```

3. Add `beforeValidate` hook on the collection to auto-generate slug when empty:
   - `formatSlug(title)` as base
   - Query `exercises` where `lesson = lessonId AND slug = candidate` to check collision
   - If collision: append `-1`, `-2`, etc. until unique
   - Only runs when `data.title && !data.slug`

4. Add field-level `validate` on `slug` for lesson-scoped uniqueness:
   - Query exercises where `lesson = lessonId AND slug = value AND id != currentId`
   - Return error if duplicate found: `'Slug must be unique within the lesson'`

5. Update `defaultColumns` to include `slug`:
   ```typescript
   defaultColumns: ['order', 'slug', 'title', 'lesson', 'updatedAt'],
   ```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 3: Backfill slugs for existing exercises

**Why**: Existing exercises have no `slug`. Need to generate one for each so routes work.

**File to create**: `scripts/backfill-exercise-slugs.ts`

**Implementation**:

- Paginate through all exercises.
- Group by `lesson`.
- For each lesson group, ordered by `order ASC, createdAt ASC, id ASC`:
  - Generate `formatSlug(title)`.
  - De-duplicate within the group by appending `-1`, `-2`, etc.
  - Update the exercise doc via `payload.update()`.
- Log progress count and any failures.

**Run**: `pnpm tsx scripts/backfill-exercise-slugs.ts`

**Validation**: Query all exercises, verify zero documents with empty `slug`.

---

## Step 4: Add `queryExerciseBySlug` to exercise queries

**Why**: Need to resolve `(lessonId, exerciseSlug)` → exercise document for the new canonical route.

**File to update**: `src/server/repos/queries/exercises.ts`

**Add function**:

```typescript
export const queryExerciseBySlug = cache(
  async ({ lessonId, slug }: { lessonId: string; slug: string }) => {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
      depth: 2,
    })
    return result.docs?.[0] || null
  },
)
```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 5: Update exercise sort in `queryExercisesByLesson`

**Why**: Spec requires deterministic `order ASC, createdAt ASC, id ASC`. Current query sorts only by `order`.

**File to update**: `src/server/repos/queries/exercises.ts:15`

**Change**:

```typescript
// Before
sort: 'order',

// After
sort: 'order,createdAt,id',
```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 6: Rename route folder `[exerciseId]` → `[exerciseSlug]`

**Why**: Canonical route param is now `exerciseSlug`.

**Action**: Rename directory:

```
src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/
→
src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/
```

All files within are moved as-is. Only `page.tsx` needs param name updates (Step 7).

The `_components/` subtree under the renamed folder does NOT reference route params directly — they receive props from `page.tsx`. No changes needed in:

- `ExerciseHeader/index.tsx`
- `ExerciseWorkspace/index.tsx`
- `FormulaPanel/index.tsx`
- `MathPalette/index.tsx`
- `NotebookWorkspace/index.tsx`
- `ExercisePageContent/index.tsx`
- `NotebookFormulas/index.tsx`
- `NotebookNotes/index.tsx`

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 7: Rewrite exercise `page.tsx` with slug resolution + legacy ID redirect

**Why**: The page must resolve by `(lessonId, exerciseSlug)` canonically, and redirect legacy ID URLs.

**File to update**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx`

**Key changes**:

1. Update `params` type: `exerciseId: string` → `exerciseSlug: string`

2. Add `isObjectId` helper: `/^[a-f0-9]{24}$/i` to detect legacy ID URLs.

3. Resolution logic:
   - If `exerciseSlug` matches ObjectId pattern:
     - Fetch by ID via `queryExerciseById`
     - If found and belongs to lesson and has a slug: `redirect()` to canonical slug URL (308)
     - Else: `notFound()`
   - Else (canonical path):
     - Fetch via `queryExerciseBySlug({ lessonId, slug: exerciseSlug })`
     - If not found or doesn't belong to lesson: `notFound()`

4. Fetch ordered exercise list for pager context:

   ```typescript
   const exercises = await queryExercisesByLesson({ lessonId: lesson.id })
   const exerciseIndex = exercises.findIndex((e) => e.id === exercise.id)
   ```

5. Compute prev/next URLs:

   ```typescript
   const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
   const prevUrl =
     exerciseIndex === 0
       ? basePath // → intro
       : `${basePath}/exercises/${exercises[exerciseIndex - 1].slug}`
   const nextUrl =
     exerciseIndex === exercises.length - 1
       ? `${basePath}/complete` // → complete
       : `${basePath}/exercises/${exercises[exerciseIndex + 1].slug}`
   ```

6. Compute progress:

   ```typescript
   const progressPercent = ((exerciseIndex + 2) / (exercises.length + 2)) * 100
   // introIndex=0(+1 for 1-indexed progress), exerciseIndex+1+1, completeIndex=N+2
   ```

7. Pass pager props to `ExercisePagerShell` (Step 9).

8. Update `generateMetadata` with same slug resolution logic.

**Validation**: `pnpm tsc --noEmit` passes. Legacy IDs redirect. Slug URLs render. 404 on invalid slugs.

---

## Step 8: Create `/complete` route

**Why**: The pager's "outro/complete" page needs a dedicated route.

**File to create**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx`

**Implementation** (server component):

1. Resolve course + lesson (same validation pattern as lesson page).
2. Fetch exercises: `queryExercisesByLesson({ lessonId })`.
3. Compute `prevUrl`:
   - If exercises exist: `basePath + '/exercises/' + exercises[exercises.length - 1].slug`
   - Else: `basePath` (back to intro)
4. `backUrl`: chapter URL.
5. Render `CompletePagerShell` with `progressPercent: 100`.
6. Add `generateMetadata`: `"Completed - {lesson.title}"`.

**Validation**: `/complete` route renders. Prev navigates to last exercise.

---

## Step 9: Create PagerShell components (route-driven UI)

**Why**: Extract pager UI from the old `ExercisesPager` into route-driven shell components that use `<SystemLink>` instead of `useState`.

**Files to create** (all under `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/PagerShell/`):

### `PagerNav.tsx` — shared prev/next navigation bar

```typescript
interface PagerNavProps {
  prevUrl?: string // undefined = disabled
  nextUrl?: string // undefined = disabled
  prevLabel: string
  nextLabel: string
}
```

- Uses `<SystemLink>` for navigation (not `onClick`)
- Visually identical to existing prev/next buttons

### `PagerProgress.tsx` — shared progress bar

- Wraps `<Progress value={percent}>` with same styling

### `ExercisePagerShell.tsx` — exercise page wrapper

```typescript
interface ExercisePagerShellProps {
  exercise: Exercise
  exerciseIndex: number // 0-based among exercises
  totalExercises: number
  prevUrl: string
  nextUrl: string
  backUrl: string
  progressPercent: number
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}
```

- Ports the exercise section markup from `ExercisesPager/index.tsx:77-126`
- Shows "Exercise {index+1} of {total}"
- Renders `<ExerciseRenderer>` with exercise content
- Uses `PagerNav` and `PagerProgress`
- Can be server component (content comes from props, no client state needed for nav)

### `CompletePagerShell.tsx` — complete page wrapper

```typescript
interface CompletePagerShellProps {
  lessonTitle: string
  totalExercises: number
  prevUrl: string
  backUrl: string
  progressPercent: number
}
```

- Ports outro section markup from `ExercisesPager/index.tsx:129-177`
- Uses `PagerNav` (no next, only prev) and `PagerProgress`

**Validation**: `pnpm tsc --noEmit` passes. Visual rendering matches existing pager.

---

## Step 10: Update lesson `page.tsx` intro to be route-aware

**Why**: The intro must link to the first exercise's canonical URL instead of using `onClick`.

**File to update**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

**Changes** to the `!hasContent && hasExercises` case (currently line 63-69):

- Replace `<ExercisesPager exercises={exercises} ...>` with inline intro UI:
  - Port the intro section markup from `ExercisesPager/index.tsx:31-74`
  - Compute `firstExerciseUrl = basePath + '/exercises/' + exercises[0].slug`
  - Replace `<Button onClick={handleStart}>` with `<Button asChild><SystemLink href={firstExerciseUrl}>`
  - Add `PagerProgress` with `progressPercent = (1 / (exercises.length + 2)) * 100`
- Remove `ExercisesPager` import.

**Validation**: Intro page renders. "Start" navigates to first exercise route.

---

## Step 11: Update all exercise link references to use slug

**Why**: Multiple components build exercise URLs using `exercise.id`. Must switch to `exercise.slug`.

**Files to update**:

| File                                                                                                                | Line     | Change                                                              |
| ------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `src/app/(frontend)/courses/_components/ExerciseCard/index.tsx`                                                     | 94       | `exercises/${exercise.id}` → `exercises/${exercise.slug}`           |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.tsx` | 91-98    | ExerciseCard already updated; verify no direct ID links here        |
| `src/ui/web/chat/ChatInterface/index.tsx`                                                                           | 148, 153 | Update dynamic import paths from `[exerciseId]` to `[exerciseSlug]` |

**Files NOT updated** (admin panel uses Payload doc ID correctly):

- `src/ui/admin/ExercisePreview/index.tsx` — links to `/exercises/:id` (standalone admin preview route)
- `src/ui/admin/PdfConversion/ExerciseReview/index.tsx` — links to `/admin/collections/exercises/:id`
- `src/ui/admin/exercise-conversion/DraftExercisesList/index.tsx` — same

**Validation**: `pnpm tsc --noEmit` passes. All frontend exercise links use slugs.

---

## Step 12: Verify exercise creation endpoints generate slugs

**Why**: Exercises created via PDF conversion and image import don't set a slug explicitly. The `beforeValidate` hook (Step 2) should auto-generate slugs for them.

**Files to verify** (no code changes expected):

- `src/server/payload/endpoints/exercises/import-from-lesson.ts:202-214` — creates with `title`, no `slug`
- `src/server/payload/endpoints/exercises/import-from-image.ts` — same
- `src/server/payload/jobs/pdf-to-exercises-task.ts:202-227` — creates with `title`, no `slug`

**Verification**: Create an exercise via each path, confirm `slug` is auto-populated and unique within the lesson.

**Edge case**: PDF conversion creates exercises with `order: 0` (missing from data). Multiple exercises in the same lesson can have `order: 0`. The tie-breaker sort (`createdAt ASC, id ASC`) handles deterministic ordering.

---

## Step 13: Generate types + import map

**Why**: Schema changed (new `slug` field on exercises).

**Commands**:

```bash
pnpm generate:types
pnpm generate:importmap
```

**Validation**: `pnpm tsc --noEmit` passes with regenerated `payload-types.ts`.

---

## Step 14: Delete old pager code

**Why**: The in-memory `ExercisesPager` and `useExercisesPager` are replaced by route-driven PagerShell components.

**Files to delete**:

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`

**Files to update** (remove dead imports):

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` — remove `ExercisesPager` import (already done in Step 10)

**Validation**: `pnpm tsc --noEmit` passes. No references to deleted files remain.

---

## Step 15: Quality gates

**Commands**:

```bash
pnpm tsc --noEmit
pnpm lint
pnpm format
```

**Manual verification checklist**:

| #   | Test                                                 | Expected                                        |
| --- | ---------------------------------------------------- | ----------------------------------------------- |
| 1   | Navigate to lesson with exercises (no content files) | See intro page with progress bar                |
| 2   | Click "Start" on intro                               | Navigates to `/exercises/:firstSlug`            |
| 3   | Click "Next" on exercise page                        | Navigates to next exercise slug                 |
| 4   | Click "Next" on last exercise                        | Navigates to `/complete`                        |
| 5   | Click "Previous" on complete                         | Navigates to last exercise                      |
| 6   | Click "Previous" on first exercise                   | Navigates to lesson intro                       |
| 7   | Visit legacy URL `exercises/:mongoId`                | 308 redirect to `exercises/:slug`               |
| 8   | Visit non-existent slug                              | 404                                             |
| 9   | Refresh on exercise page                             | Stays on same exercise (not reset to intro)     |
| 10  | Copy/share exercise URL                              | Opens the correct exercise directly             |
| 11  | Exercise "N of M" display                            | Shows correct ordinal and total                 |
| 12  | Progress bar                                         | Increments through intro → exercises → complete |

---

## Execution Order Summary

| Step | Description                                           | Depends on    | Est. |
| ---- | ----------------------------------------------------- | ------------- | ---- |
| 1    | Extract shared `formatSlug`                           | —             | 10m  |
| 2    | Add `slug` field to Exercises                         | Step 1        | 30m  |
| 3    | Backfill existing exercise slugs                      | Step 2        | 20m  |
| 4    | Add `queryExerciseBySlug`                             | Step 2        | 10m  |
| 5    | Update sort in `queryExercisesByLesson`               | —             | 5m   |
| 6    | Rename route folder `[exerciseId]` → `[exerciseSlug]` | —             | 5m   |
| 7    | Rewrite exercise `page.tsx`                           | Steps 4, 5, 6 | 45m  |
| 8    | Create `/complete` route                              | Step 5        | 20m  |
| 9    | Create PagerShell components                          | —             | 40m  |
| 10   | Update lesson intro page                              | Steps 5, 9    | 20m  |
| 11   | Update exercise link references                       | Step 2        | 15m  |
| 12   | Verify exercise creation endpoints                    | Step 2        | 10m  |
| 13   | Generate types + import map                           | Step 2        | 5m   |
| 14   | Delete old pager code                                 | Steps 9, 10   | 5m   |
| 15   | Quality gates                                         | All           | 20m  |

**Critical path**: 1 → 2 → 4 → 7 (slug field → query → route resolution)

**Parallelizable**: Steps 5, 6, 8, 9 can run in parallel after Step 2.

**Total estimate**: ~4 hours implementation.
