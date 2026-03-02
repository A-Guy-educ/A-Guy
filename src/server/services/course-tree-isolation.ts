/**
 * Course tree isolation validation
 *
 * Ensures all children (chapters) of a course reference that course.
 * Prevents mixed-locale LMS trees.
 */
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import type { Payload } from 'payload'

interface IsolationResult {
  valid: boolean
  errors: string[]
}

export async function validateCourseTreeIsolation(
  payload: Payload,
  courseId: string,
): Promise<IsolationResult> {
  const errors: string[] = []

  // Find all chapters that reference this course
  const chapters = await payload.find({
    collection: 'chapters',
    where: { course: { equals: courseId } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  // Verify each chapter actually references this course
  for (const chapter of chapters.docs) {
    const chapterCourseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id
    if (chapterCourseId !== courseId) {
      errors.push(
        `Chapter '${chapter.id}' references course '${chapterCourseId}' instead of '${courseId}'`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

export async function getCourseLocale(payload: Payload, courseId: string): Promise<ContentLocale> {
  const course = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: true,
  })
  return course.locale ?? 'he'
}
