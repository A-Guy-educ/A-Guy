/**
 * Backfill course on existing Lessons and Exercises
 *
 * Populates the denormalized course field by traversing:
 *   Lesson  -> chapter -> course
 *   Exercise -> lesson -> chapter -> course
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/backfill-parent-course.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

async function backfillLessons(payload: Awaited<ReturnType<typeof getPayload>>) {
  const lessons = await payload.find({
    collection: 'lessons',
    limit: 10000,
    depth: 0,
    overrideAccess: true,
    select: { chapter: true, course: true },
  })

  let updated = 0
  let skipped = 0

  for (const lesson of lessons.docs) {
    const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
    if (!chapterId) {
      skipped++
      continue
    }

    try {
      const chapter = await payload.findByID({
        collection: 'chapters',
        id: chapterId,
        depth: 0,
        overrideAccess: true,
        select: { course: true },
      })

      const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id
      if (!courseId) {
        skipped++
        continue
      }

      // Skip if already set correctly
      const existingCourseId = typeof lesson.course === 'string' ? lesson.course : lesson.course?.id
      if (existingCourseId === courseId) {
        skipped++
        continue
      }

      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: { course: courseId } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true,
      })
      updated++
    } catch {
      console.error(`  Failed to backfill lesson ${lesson.id}`)
      skipped++
    }
  }

  console.log(`Lessons: ${updated} updated, ${skipped} skipped (of ${lessons.docs.length} total)`)
}

async function backfillExercises(payload: Awaited<ReturnType<typeof getPayload>>) {
  const exercises = await payload.find({
    collection: 'exercises',
    limit: 10000,
    depth: 0,
    overrideAccess: true,
    select: { lesson: true, course: true },
  })

  // Build a cache of lesson -> { chapterId, courseId } mappings
  const lessonHierarchyCache = new Map<
    string,
    { chapterId: string | null; courseId: string | null }
  >()

  async function getHierarchyForLesson(
    lessonId: string,
  ): Promise<{ chapterId: string | null; courseId: string | null }> {
    if (lessonHierarchyCache.has(lessonId)) {
      return lessonHierarchyCache.get(lessonId)!
    }

    try {
      const lesson = await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 0,
        overrideAccess: true,
        select: { chapter: true },
      })

      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
      if (!chapterId) {
        const result = { chapterId: null, courseId: null }
        lessonHierarchyCache.set(lessonId, result)
        return result
      }

      const chapter = await payload.findByID({
        collection: 'chapters',
        id: chapterId,
        depth: 0,
        overrideAccess: true,
        select: { course: true },
      })

      const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id
      const result = { chapterId, courseId: courseId || null }
      lessonHierarchyCache.set(lessonId, result)
      return result
    } catch {
      const result = { chapterId: null, courseId: null }
      lessonHierarchyCache.set(lessonId, result)
      return result
    }
  }

  let updated = 0
  let skipped = 0

  for (const exercise of exercises.docs) {
    const lessonId = typeof exercise.lesson === 'string' ? exercise.lesson : exercise.lesson?.id
    if (!lessonId) {
      skipped++
      continue
    }

    const { chapterId, courseId } = await getHierarchyForLesson(lessonId)
    if (!courseId && !chapterId) {
      skipped++
      continue
    }

    // Skip if already set correctly
    const existingCourseId =
      typeof exercise.course === 'string' ? exercise.course : exercise.course?.id
    const existingChapterId =
      typeof (exercise as any).chapter === 'string'
        ? (exercise as any).chapter
        : (exercise as any).chapter?.id // eslint-disable-line @typescript-eslint/no-explicit-any
    if (existingCourseId === courseId && existingChapterId === chapterId) {
      skipped++
      continue
    }

    try {
      await payload.update({
        collection: 'exercises',
        id: exercise.id,
        data: { course: courseId, chapter: chapterId } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true,
      })
      updated++
    } catch {
      console.error(`  Failed to backfill exercise ${exercise.id}`)
      skipped++
    }
  }

  console.log(
    `Exercises: ${updated} updated, ${skipped} skipped (of ${exercises.docs.length} total)`,
  )
}

async function main() {
  console.log('Backfilling course fields...\n')

  const payload = await getPayload({ config })

  console.log('--- Lessons ---')
  await backfillLessons(payload)

  console.log('\n--- Exercises ---')
  await backfillExercises(payload)

  console.log('\nDone!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
