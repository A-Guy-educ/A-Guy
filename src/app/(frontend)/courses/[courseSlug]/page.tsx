import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
import { defaultLocale } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryChaptersByCourseDirectly } from '@/server/repos/queries/chapters'
import { queryLessonsByCourseDirectly } from '@/server/repos/queries/lessons'
import { SystemParams } from '@/infra/config/system-params'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { stripHtml } from '@/utils/strip-html'
import { CoursePageContent } from './_components/CoursePageContent'

export const revalidate = 300 // ISR: revalidate every 5 minutes

interface CoursePageProps {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
  // Fetch course + system params in parallel (saves ~100ms vs sequential)
  const [course, gatedDelayMs, gatedWarningMs] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  if (!course) {
    notFound()
  }

  const courseAccessType = course.pageAccessType ?? 'free'

  // Use Direct variants — course is already verified above, skip redundant re-validation
  const [chapters, lessons] = await Promise.all([
    queryChaptersByCourseDirectly({ courseId: course.id }),
    queryLessonsByCourseDirectly({ courseId: course.id }),
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
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
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
