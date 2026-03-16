import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
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
      />
    </AccessGateProvider>
  )
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
