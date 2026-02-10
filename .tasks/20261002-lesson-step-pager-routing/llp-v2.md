# LLP v2: Lesson Exercises Pager Synced With Routes

> Implements spec: `.opencode/plans/spec-v2.md`
> Supersedes: `.tasks/20261002-lesson-step-pager-routing/llp.md` (v1)

## Overview

Convert the in-memory `ExercisesPager` into a route-driven pager where:

- Intro = lesson route (existing)
- Each exercise = canonical route by slug, with ID fallback (new)
- Complete = new `/complete` route
- Next/prev uses `<Link>` navigation, not `useState`
- **No data migration** -- exercises without slugs use ID-based URLs

### Key v2 Differences from v1

1. `getExerciseUrlParam()` helper replaces all raw `.slug` access (fixes Issues #1, #7, #8)
2. Dual-mode route resolution: slug-first, then ID (fixes Issue #5)
3. `slugify` npm package replaces hand-rolled `formatSlug` (fixes Issue #4)
4. Validation/hook exclude self on update (fixes Issues #2, #3, #9)
5. Shared resolution helper for page + generateMetadata (fixes Issue #13)
6. No backfill script (fixes Issue #9 entirely -- no migration needed)

---

## Step 1: Install `slugify` and fix `formatSlug` for Hebrew/Unicode

**Why**: The current `formatSlug` uses `[^\w-]` which strips all non-ASCII characters. Hebrew titles produce empty or meaningless slugs. This affects ALL collections (Courses, Chapters, Lessons, Exercises). Fixes **Issue #4**.

**Package to install**: `slugify` (npm)

**File to update**: `src/server/payload/utils/format-slug.ts`

**Before**:

```typescript
export const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
```

**After**:

```typescript
import slugify from 'slugify'

export const formatSlug = (val: string): string => {
  const result = slugify(val, {
    lower: true,
    strict: true, // strip special characters
    locale: 'he', // Hebrew locale support
    trim: true,
  })
  return result || `item-${Date.now().toString(36)}` // fallback for empty results
}
```

**Files that benefit automatically** (they already import from this utility):

- `src/server/payload/collections/Courses.ts`
- `src/server/payload/collections/Chapters.ts`
- `src/server/payload/collections/Lessons.ts`
- `src/server/payload/collections/Exercises/index.ts`

**Validation**: `pnpm tsc --noEmit` passes. Test with Hebrew string: `formatSlug("תרגיל חיבור")` produces a non-empty slug.

**Note on `slugify` Hebrew behavior**: `slugify` with `strict: true` may still strip Hebrew chars if no transliteration charmap is available. Verify this during implementation. If `slugify` does not handle Hebrew adequately, consider:

- `slugify` with a custom charmap for Hebrew
- Keeping Hebrew chars in the slug (RFC 3987 IRIs) by setting `strict: false` and only stripping unsafe URL characters
- Using `transliteration` npm package as alternative

The fallback `item-${Date.now().toString(36)}` ensures a slug is never empty.

---

## Step 2: Create `getExerciseUrlParam()` typed helper

**Why**: Every location that builds an exercise URL currently does `(exercise as any).slug`, which crashes when slug is null. This helper is the single source of truth. Fixes **Issues #1, #6, #7, #8**.

**File to create**: `src/server/payload/utils/exercise-url.ts`

```typescript
import type { Exercise } from '@/payload-types'

/**
 * Returns the URL-safe param for an exercise: slug if available, otherwise ID.
 * This is the ONLY way exercise URL params should be constructed.
 */
export const getExerciseUrlParam = (exercise: Pick<Exercise, 'id' | 'slug'>): string => {
  return exercise.slug || exercise.id
}
```

**Usage pattern** (replaces all `(exercise as any).slug` casts):

```typescript
// Before (BROKEN)
;`${basePath}/exercises/${(exercises[0] as any).slug}`
// After (SAFE)
`${basePath}/exercises/${getExerciseUrlParam(exercises[0])}`
```

**Validation**: `pnpm tsc --noEmit` passes. Helper returns `string` always (never null/undefined).

---

## Step 3: Fix `slug` field -- validation excludes self, hook excludes self + regenerates on title change

**Why**: The v1 `validate` function finds the current document itself and rejects the save. The v1 `beforeChange` hook also finds itself on update, producing unnecessary suffixes. And slugs never regenerate when titles change. Fixes **Issues #2, #3**.

**File to update**: `src/server/payload/collections/Exercises/index.ts`

### 3a: Fix `beforeChange` hook

**Before** (broken):

```typescript
hooks: {
  beforeChange: [
    async ({ data, req }) => {
      if (data?.title && !data?.slug) {
        // generates slug but doesn't exclude self, never regenerates
      }
    },
  ],
},
```

**After** (fixed):

```typescript
hooks: {
  beforeChange: [
    async ({ data, req, operation, originalDoc }) => {
      const shouldGenerate =
        data?.title &&
        (operation === 'create' || !data.slug || data.title !== originalDoc?.title)

      if (!shouldGenerate) return data

      const baseSlug = formatSlug(data.title)
      const lessonId = typeof data.lesson === 'string' ? data.lesson : data.lesson?.id

      if (!lessonId) {
        data.slug = baseSlug
        return data
      }

      // De-duplicate within lesson, excluding self on update
      let candidate = baseSlug
      let suffix = 0
      const selfId = operation === 'update' ? originalDoc?.id : undefined

      while (true) {
        const where: any[] = [
          { lesson: { equals: lessonId } },
          { slug: { equals: candidate } },
        ]
        if (selfId) {
          where.push({ id: { not_equals: selfId } })
        }

        const existing = await req.payload.find({
          collection: 'exercises',
          where: { and: where },
          limit: 1,
          depth: 0,
        })
        if (existing.docs.length === 0) break
        suffix++
        candidate = `${baseSlug}-${suffix}`
      }
      data.slug = candidate
      return data
    },
  ],
},
```

**Key changes**:

- Generates slug on create OR when title changes (not just `!data?.slug`)
- Excludes self (`id != originalDoc.id`) when checking uniqueness on update
- Handles `operation` and `originalDoc` params

### 3b: Fix `validate` function

**Before** (broken -- finds itself):

```typescript
validate: async (value, { req, data }) => {
  // ... queries without excluding current doc
  return existing.docs.length === 0 || 'Slug must be unique within the lesson'
}
```

**After** (fixed):

```typescript
validate: async (value, { req, data, siblingData, id }) => {
  if (!value || typeof value !== 'string') return true
  const lessonId = data?.lesson || siblingData?.lesson
  if (!lessonId) return true

  const where: any[] = [
    { lesson: { equals: typeof lessonId === 'string' ? lessonId : lessonId.id } },
    { slug: { equals: value } },
  ]

  // Exclude self on update
  if (id) {
    where.push({ id: { not_equals: id } })
  }

  const existing = await req.payload.find({
    collection: 'exercises',
    where: { and: where },
    limit: 1,
    depth: 0,
  })
  return existing.docs.length === 0 || 'Slug must be unique within the lesson'
}
```

**Key change**: Uses `id` param (available in field-level validate) to exclude self.

**Validation**: `pnpm tsc --noEmit` passes. Admin can save existing exercises without error.

---

## Step 4: Add `queryExerciseBySlug` to exercise queries

**Why**: Need to resolve `(lessonId, exerciseSlug)` -> exercise for canonical route resolution.

**File to update**: `src/server/repos/queries/exercises.ts`

**Add function** (same as v1 -- this was correct):

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

**File to update**: `src/server/repos/queries/exercises.ts`

**Change**:

```typescript
// Before
sort: 'order',

// After
sort: 'order,createdAt,id',
```

**Validation**: `pnpm tsc --noEmit` passes. Update unit test to expect new sort value.

---

## Step 6: Rename route folder `[exerciseId]` -> `[exerciseSlug]`

**Why**: Canonical route param is now `exerciseSlug` (though it accepts both slugs and IDs).

**Action**: Rename directory:

```
src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/
->
src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/
```

All `_components/` files within are moved as-is -- they receive props from `page.tsx`, not route params.

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 7: Create shared exercise resolution helper

**Why**: The v1 implementation duplicated resolution logic between `page` and `generateMetadata` (Issue #13). Extract a shared helper. Also implements dual-mode resolution (Issue #5).

**File to create**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_lib/resolve-exercise.ts`

```typescript
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import {
  queryExerciseById,
  queryExerciseBySlug,
  queryExercisesByLesson,
} from '@/server/repos/queries/exercises'

const isObjectId = (val: string): boolean => /^[a-f0-9]{24}$/i.test(val)

interface ResolveParams {
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  exerciseSlug: string
}

interface ResolvedExercise {
  course: NonNullable<Awaited<ReturnType<typeof queryCourseBySlug>>>
  lesson: NonNullable<Awaited<ReturnType<typeof queryLessonBySlug>>>
  exercise: NonNullable<Awaited<ReturnType<typeof queryExerciseById>>>
  exercises: Awaited<ReturnType<typeof queryExercisesByLesson>>
  exerciseIndex: number
  /** If set, caller should redirect to this URL instead of rendering */
  redirectTo?: string
}

/**
 * Resolves exercise from route params using dual-mode lookup (slug-first, then ID).
 * Returns null if not found (caller should 404).
 * Returns { redirectTo } if caller should redirect (308) to canonical slug URL.
 */
export async function resolveExercise(params: ResolveParams): Promise<ResolvedExercise | null> {
  const { courseSlug, chapterSlug, lessonSlug, exerciseSlug } = params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) return null

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) return null
  if (!lessonChapter || lessonChapter.slug !== chapterSlug) return null

  // Dual-mode resolution: try slug first, then ID
  let exercise = await queryExerciseBySlug({ lessonId: lesson.id, slug: exerciseSlug })
  let redirectTo: string | undefined

  if (!exercise && isObjectId(exerciseSlug)) {
    // Fallback: try as MongoDB ObjectID
    const idExercise = await queryExerciseById({ id: exerciseSlug })
    if (idExercise) {
      const exerciseLesson = typeof idExercise.lesson === 'string' ? null : idExercise.lesson
      if (exerciseLesson?.id === lesson.id) {
        exercise = idExercise
        // If exercise has a slug, redirect to canonical slug URL
        if (idExercise.slug) {
          redirectTo = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${idExercise.slug}`
        }
        // If no slug, render in-place (no redirect)
      }
    }
  }

  if (!exercise) return null

  // Verify exercise belongs to this lesson
  const exerciseLesson = typeof exercise.lesson === 'string' ? null : exercise.lesson
  if (!exerciseLesson || exerciseLesson.id !== lesson.id) return null

  const exercises = await queryExercisesByLesson({ lessonId: lesson.id })
  const exerciseIndex = exercises.findIndex((e) => e.id === exercise!.id)

  return {
    course,
    lesson,
    exercise,
    exercises,
    exerciseIndex,
    redirectTo,
  }
}
```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 8: Rewrite exercise `page.tsx` using shared resolution + `getExerciseUrlParam`

**Why**: The page must use dual-mode resolution and type-safe URL construction. Fixes **Issues #1, #5, #7, #13**.

**File to update**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx`

**Key changes from v1**:

1. Use `resolveExercise()` helper (Step 7) instead of inline resolution.
2. Handle `redirectTo` from resolution result.
3. Use `getExerciseUrlParam()` (Step 2) for all prev/next URL construction.
4. `generateMetadata` uses same `resolveExercise()` helper.
5. **Zero `as any` casts.**

```typescript
import { notFound, redirect } from 'next/navigation'
import { resolveExercise } from './_lib/resolve-exercise'
import { getExerciseUrlParam } from '@/server/payload/utils/exercise-url'

export default async function ExercisePage({ params }: ExercisePageProps) {
  const p = await params
  const resolved = await resolveExercise(p)

  if (!resolved) notFound()
  if (resolved.redirectTo) redirect(resolved.redirectTo)

  const { exercise, exercises, exerciseIndex, lesson } = resolved
  const basePath = `/courses/${p.courseSlug}/chapters/${p.chapterSlug}/lessons/${p.lessonSlug}`

  const prevUrl =
    exerciseIndex === 0
      ? basePath
      : `${basePath}/exercises/${getExerciseUrlParam(exercises[exerciseIndex - 1])}`

  const nextUrl =
    exerciseIndex === exercises.length - 1
      ? `${basePath}/complete`
      : `${basePath}/exercises/${getExerciseUrlParam(exercises[exerciseIndex + 1])}`

  const progressPercent = ((exerciseIndex + 2) / (exercises.length + 2)) * 100

  return (
    <ExerciseWorkspace
      exerciseTitle={exercise.title}
      backUrl={basePath}
      prevUrl={prevUrl}
      nextUrl={nextUrl}
      progressPercent={progressPercent}
      exerciseIndex={exerciseIndex}
      totalExercises={exercises.length}
      pdfContent={/* ... ExerciseRenderer ... */}
      chatContent={/* ... ChatInterface ... */}
    />
  )
}

export async function generateMetadata({ params }: ExercisePageProps) {
  const p = await params
  const resolved = await resolveExercise(p)

  if (!resolved) return { title: 'Exercise Not Found' }
  if (resolved.redirectTo) redirect(resolved.redirectTo)

  const { exercise, lesson, course } = resolved
  const chapter = typeof lesson.chapter === 'string' ? null : lesson.chapter

  return {
    title: `${exercise.title} - ${lesson.title} - ${chapter?.title || ''} - ${course.title}`,
    description: `Practice exercise: ${exercise.title}`,
  }
}
```

**Validation**: `pnpm tsc --noEmit` passes. Legacy IDs redirect when slug exists, render in-place when not. Slug URLs render. 404 on invalid params.

---

## Step 9: Create `/complete` route using `getExerciseUrlParam`

**Why**: The pager's "outro/complete" page needs a dedicated route. Fixes **Issue #8**.

**File to create**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx`

**Implementation** (server component):

1. Resolve course + lesson (same validation pattern as lesson page).
2. Fetch exercises: `queryExercisesByLesson({ lessonId })`.
3. Compute `prevUrl`:
   - If exercises exist: `basePath + '/exercises/' + getExerciseUrlParam(exercises[exercises.length - 1])`
   - Else: `basePath` (back to intro)
4. `backUrl`: chapter URL.
5. Render completion UI with `progressPercent: 100`.
6. Add `generateMetadata`: `"Completed - {lesson.title}"`.

**Key difference from v1**: Uses `getExerciseUrlParam()` instead of `(exercises[...] as any).slug`.

**Validation**: `/complete` route renders. Prev navigates to last exercise (by slug or ID).

---

## Step 10: Update lesson intro `page.tsx` using `getExerciseUrlParam`

**Why**: The intro must link to the first exercise's URL. Fixes **Issue #6**.

**File to update**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

**Changes**:

1. Import `getExerciseUrlParam` from `@/server/payload/utils/exercise-url`.
2. Replace `(exercises[0] as any).slug` with `getExerciseUrlParam(exercises[0])`.
3. Fix the double `queryLessonBySlug` call (fetch exercises using the already-resolved lesson).

**Before** (broken):

```typescript
<SystemLink href={`${basePath}/exercises/${(exercises[0] as any).slug}`}>
```

**After** (fixed):

```typescript
<SystemLink href={`${basePath}/exercises/${getExerciseUrlParam(exercises[0])}`}>
```

**Validation**: Intro page renders. "Start" navigates to first exercise (by slug or ID).

---

## Step 11: Update ExerciseCard to use `getExerciseUrlParam`

**Why**: ExerciseCard builds exercise URLs. Fixes **Issue #1** for card links.

**File to update**: `src/app/(frontend)/courses/_components/ExerciseCard/index.tsx`

**Change** at line ~94:

```typescript
// Before
exercises/${(exercise as any).slug}

// After
exercises/${getExerciseUrlParam(exercise)}
```

**Validation**: Exercise cards link correctly (slug when available, ID when not).

---

## Step 12: Update ExerciseWorkspaceProps types

**Why**: The types file is stale and doesn't include prev/next props. Fixes **Issue #12**.

**File to update**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/exercise-workspace-types.ts`

**Update** to include all actual props:

```typescript
export interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl: string
  pdfContent: React.ReactNode
  chatContent: React.ReactNode
  prevUrl: string
  nextUrl: string
  progressPercent: number
  exerciseIndex: number
  totalExercises: number
}
```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 13: Delete old pager code + backfill script

**Why**: The in-memory `ExercisesPager` is replaced by route-driven navigation. The backfill script is not needed (no migration).

**Files to delete**:

- `src/app/(frontend)/courses/[courseSlug]/.../lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts`
- `src/app/(frontend)/courses/[courseSlug]/.../lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`
- `scripts/backfill-exercise-slugs.ts`

**Files to update** (remove dead imports):

- Lesson page: remove `ExercisesPager` import (already done in Step 10).

**Validation**: `pnpm tsc --noEmit` passes. No references to deleted files remain.

---

## Step 14: Verify exercise creation endpoints auto-generate slugs

**Why**: Exercises created via PDF conversion and image import don't set slug explicitly. The `beforeChange` hook (Step 3) should auto-generate slugs.

**Files to verify** (no code changes expected):

- `src/server/payload/endpoints/exercises/import-from-lesson.ts` -- creates with `title`, no `slug`
- `src/server/payload/endpoints/exercises/import-from-image.ts` -- same
- `src/server/payload/jobs/pdf-to-exercises-task.ts` -- creates with `title`, no `slug`

**Verification**: Create an exercise via each path, confirm `slug` is auto-populated.

**Edge case**: If `title` is Hebrew and `slugify` produces an empty result, the fallback in `formatSlug` generates a timestamp-based slug.

---

## Step 15: Generate types + import map

**Why**: Schema changed (new `slug` field on exercises).

**Commands**:

```bash
pnpm generate:types
pnpm generate:importmap
```

**Validation**: `pnpm tsc --noEmit` passes with regenerated `payload-types.ts`. The `Exercise` type now includes `slug?: string | null`.

---

## Step 16: Update unit tests

**Why**: The sort order changed and the exercises query test expectations need updating.

**File to update**: `tests/unit/queries/exercises.test.ts`

**Changes**:

- Update `sort: 'order'` expectations to `sort: 'order,createdAt,id'`

**Validation**: `pnpm test:unit` passes (all 1066 tests).

---

## Step 17: Quality gates

**Commands**:

```bash
pnpm tsc --noEmit
pnpm lint
pnpm format
pnpm test:unit
```

**Manual verification checklist**:

| #   | Test                                                | Expected                                          |
| --- | --------------------------------------------------- | ------------------------------------------------- |
| 1   | Navigate to lesson with exercises                   | See intro page with progress bar                  |
| 2   | Click "Start" on intro (exercise WITH slug)         | Navigates to `/exercises/:slug`                   |
| 3   | Click "Start" on intro (exercise WITHOUT slug)      | Navigates to `/exercises/:mongoId`                |
| 4   | Click "Next" on exercise page                       | Navigates to next exercise (slug or ID)           |
| 5   | Click "Next" on last exercise                       | Navigates to `/complete`                          |
| 6   | Click "Previous" on complete                        | Navigates to last exercise (slug or ID)           |
| 7   | Click "Previous" on first exercise                  | Navigates to lesson intro                         |
| 8   | Visit exercise by MongoDB ID (exercise HAS slug)    | 308 redirect to `/exercises/:slug`                |
| 9   | Visit exercise by MongoDB ID (exercise has NO slug) | Renders in-place (no redirect, no 404)            |
| 10  | Visit non-existent slug                             | 404                                               |
| 11  | Visit non-existent ID                               | 404                                               |
| 12  | Refresh on exercise page                            | Stays on same exercise                            |
| 13  | Copy/share exercise URL                             | Opens correct exercise directly                   |
| 14  | Exercise "N of M" display                           | Shows correct ordinal and total                   |
| 15  | Progress bar                                        | Increments through intro -> exercises -> complete |
| 16  | Admin saves exercise with existing slug             | Save succeeds (no validation error)               |
| 17  | Create exercise with Hebrew title                   | Gets a valid non-empty slug                       |
| 18  | Rename exercise title                               | Slug regenerates to match new title               |

---

## Execution Order Summary

| Step | Description                                                              | Depends on     | Fixes Issues    | Est. |
| ---- | ------------------------------------------------------------------------ | -------------- | --------------- | ---- |
| 1    | Install `slugify`, fix `formatSlug` for Hebrew                           | --             | #4              | 15m  |
| 2    | Create `getExerciseUrlParam()` helper                                    | --             | #1, #7, #8      | 5m   |
| 3    | Fix slug field: validate + hook exclude self, regenerate on title change | Step 1         | #2, #3          | 30m  |
| 4    | Add `queryExerciseBySlug`                                                | --             | --              | 10m  |
| 5    | Update sort in `queryExercisesByLesson`                                  | --             | --              | 5m   |
| 6    | Rename route folder `[exerciseId]` -> `[exerciseSlug]`                   | --             | --              | 5m   |
| 7    | Create shared `resolveExercise()` helper                                 | Steps 4, 5     | #5, #13         | 30m  |
| 8    | Rewrite exercise `page.tsx`                                              | Steps 2, 6, 7  | #1, #5, #7, #13 | 20m  |
| 9    | Create `/complete` route                                                 | Steps 2, 5     | #8              | 15m  |
| 10   | Update lesson intro page                                                 | Steps 2, 5     | #6              | 10m  |
| 11   | Update ExerciseCard                                                      | Step 2         | #1              | 5m   |
| 12   | Update ExerciseWorkspaceProps types                                      | --             | #12             | 5m   |
| 13   | Delete old pager code + backfill script                                  | Steps 8, 9, 10 | #9              | 5m   |
| 14   | Verify exercise creation endpoints                                       | Step 3         | --              | 10m  |
| 15   | Generate types + import map                                              | Step 3         | --              | 5m   |
| 16   | Update unit tests                                                        | Step 5         | --              | 5m   |
| 17   | Quality gates                                                            | All            | --              | 20m  |

**Critical path**: 1 -> 3 -> 4 -> 7 -> 8 (formatSlug -> hook fix -> query -> resolution -> page)

**Parallelizable**: Steps 2, 4, 5, 6, 12 can run in parallel (no dependencies).

**Total estimate**: ~3.5 hours implementation.

---

## Issue Coverage Map

| Issue # | Severity | Description                       | Fixed in Step               |
| ------- | -------- | --------------------------------- | --------------------------- |
| 1       | CRITICAL | `as any` hides null slugs         | Steps 2, 8, 9, 10, 11       |
| 2       | HIGH     | beforeChange no self-exclusion    | Step 3                      |
| 3       | HIGH     | validate rejects self-updates     | Step 3                      |
| 4       | HIGH     | formatSlug strips Hebrew          | Step 1                      |
| 5       | MEDIUM   | Legacy ID hard-404 without slug   | Steps 7, 8                  |
| 6       | MEDIUM   | Intro "Start" null slug           | Step 10                     |
| 7       | HIGH     | Prev/next crashes on null slug    | Steps 2, 8                  |
| 8       | MEDIUM   | Complete "Previous" null slug     | Steps 2, 9                  |
| 9       | MEDIUM   | Backfill fails / not needed       | Step 13 (delete script)     |
| 10      | LOW      | Lesson slug not unique            | Out of scope (pre-existing) |
| 11      | MEDIUM   | Lost ExercisesPager state         | Tracked as follow-up task   |
| 12      | LOW      | ExerciseWorkspaceProps drift      | Step 12                     |
| 13      | LOW      | Duplicated generateMetadata logic | Step 7                      |
