import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { queryLessonsByCourse } from '@/server/repos/queries/lessons'
import { SystemParams } from '@/infra/config/system-params'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { stripHtml } from '@/utils/strip-html'
import { CoursePageContent } from './_components/CoursePageContent'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

interface CoursePageProps {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const course = await queryCourseBySlug({ slug: courseSlug, locale: contentLocale })

  if (!course) {
    notFound()
  }

  const pageAccess = course.pageAccessType ?? 'free'
  const lessonAccess = course.accessType ?? 'free'
  // If either the page or lesson access is paid, gate the course page
  const courseAccessType = pageAccess === 'paid' || lessonAccess === 'paid' ? 'paid' : pageAccess
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  if (courseAccessType === 'mandatory' && !(await isAuthenticatedServer())) {
    return (
      <AccessGateProvider
        accessType={courseAccessType}
        courseSlug={courseSlug}
        gatedDelayMs={gatedDelayMs}
        gatedWarningMs={gatedWarningMs}
      >
        <div className="min-h-screen" />
      </AccessGateProvider>
    )
  }

  // Server-side block: for paid mode, check entitlement
  if (courseAccessType === 'paid') {
    const { requiresEntitlement, isAuthenticated } = await checkPaidAccess(course.id)

    if (requiresEntitlement) {
      return (
        <AccessGateProvider
          accessType={courseAccessType}
          courseSlug={courseSlug}
          gatedDelayMs={gatedDelayMs}
          gatedWarningMs={gatedWarningMs}
          requiresEntitlement={true}
          isAuthenticated={isAuthenticated}
        >
          <div className="min-h-screen" />
        </AccessGateProvider>
      )
    }
  }

  const [chapters, lessons] = await Promise.all([
    queryChaptersByCourse({ courseId: course.id }),
    queryLessonsByCourse({ courseId: course.id }),
  ])

  // Fetch lesson progress: exercises completed / total exercises per lesson
  const lessonProgressMap = await buildLessonProgressMap(lessons.map((l) => l.id))

  return (
    <AccessGateProvider
      accessType={courseAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <CoursePageContent
        course={course}
        chapters={chapters}
        lessons={lessons}
        courseSlug={courseSlug}
        lessonProgressMap={lessonProgressMap}
      />
    </AccessGateProvider>
  )
}

/**
 * Build a map of lessonId → { completed, total, percent } based on
 * exercise counts and user-progress records.
 */
async function buildLessonProgressMap(
  lessonIds: string[],
): Promise<Record<string, { completed: number; total: number; percent: number }>> {
  if (lessonIds.length === 0) return {}

  const payload = await getPayload({ config: configPromise })

  // Get current user
  let userId: string | null = null
  try {
    const { user } = await payload.auth({ headers: await headers() })
    userId = user?.id ?? null
  } catch {
    // Not authenticated
  }

  // Fetch total exercise count per lesson
  const exercisesResult = await payload.find({
    collection: 'exercises',
    where: { lesson: { in: lessonIds } },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })

  // Build lessonId → total exercises count
  const lessonExerciseCounts = new Map<string, number>()
  const exerciseIds = new Set<string>()
  // exerciseId → lessonId mapping
  const exerciseToLesson = new Map<string, string>()

  for (const exercise of exercisesResult.docs) {
    const lessonId =
      typeof exercise.lesson === 'string' ? exercise.lesson : (exercise.lesson as { id: string })?.id
    if (lessonId) {
      lessonExerciseCounts.set(lessonId, (lessonExerciseCounts.get(lessonId) || 0) + 1)
      exerciseIds.add(exercise.id)
      exerciseToLesson.set(exercise.id, lessonId)
    }
  }

  // If no user, return just totals with 0 completed
  if (!userId) {
    const result: Record<string, { completed: number; total: number; percent: number }> = {}
    for (const lessonId of lessonIds) {
      const total = lessonExerciseCounts.get(lessonId) || 0
      result[lessonId] = { completed: 0, total, percent: 0 }
    }
    return result
  }

  // Fetch user progress
  const userProgressResult = await payload.find({
    collection: 'user-progress',
    where: { user: { equals: userId } },
    limit: 1,
    overrideAccess: true,
  })

  const progressRecords: Array<{ recordType: string; recordId: string; status: string }> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
    (userProgressResult.docs[0] as any)?.progressRecords || []

  // Count completed exercises per lesson
  const lessonCompletedExercises = new Map<string, number>()
  for (const record of progressRecords) {
    if (record.recordType === 'exercise' && record.status === 'completed') {
      const lessonId = exerciseToLesson.get(record.recordId)
      if (lessonId) {
        lessonCompletedExercises.set(lessonId, (lessonCompletedExercises.get(lessonId) || 0) + 1)
      }
    }
  }

  // Also check lesson-level completion records
  const completedLessons = new Set<string>()
  for (const record of progressRecords) {
    if (record.recordType === 'lesson' && record.status === 'completed') {
      completedLessons.add(record.recordId)
    }
  }

  // Build result
  const result: Record<string, { completed: number; total: number; percent: number }> = {}
  for (const lessonId of lessonIds) {
    const total = lessonExerciseCounts.get(lessonId) || 0
    const completed = lessonCompletedExercises.get(lessonId) || 0

    // If lesson marked completed OR all exercises done, show 100%
    // If total exercises is 0, check lesson-level completion
    let percent: number
    if (total === 0) {
      percent = completedLessons.has(lessonId) ? 100 : 0
    } else {
      percent = Math.round((completed / total) * 100)
    }

    result[lessonId] = { completed, total, percent }
  }

  return result
}

export async function generateMetadata({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const course = await queryCourseBySlug({ slug: courseSlug, locale: contentLocale })

  if (!course) {
    return { title: 'Course Not Found' }
  }

  return {
    title: course.meta?.title || course.title,
    description:
      course.meta?.description || (course.description ? stripHtml(course.description) : undefined),
  }
}
