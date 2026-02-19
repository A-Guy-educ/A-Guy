import '@/infra/config/server-init'

import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryChaptersByCourse } from '@/server/repos/queries/chapters'
import { SystemParams } from '@/infra/config/system-params'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { CourseHeader } from '../_components/CourseHeader'
import { ChapterCard } from '../_components/ChapterCard'
import { EmptyState } from '../_components/EmptyState'
import { BackToCourses } from '../_components/BackToCourses'
import { ChaptersSectionTitle } from '../_components/ChaptersSectionTitle'
import { CourseAnalytics } from './_components/CourseAnalytics'

interface CoursePageProps {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const course = await queryCourseBySlug({ slug: courseSlug })

  if (!course) {
    notFound()
  }

  const courseAccessType = course.pageAccessType ?? 'free'
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  // Server-side block: for mandatory mode, don't render content for unauthenticated users
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

  const chapters = await queryChaptersByCourse({ courseId: course.id })

  return (
    <AccessGateProvider
      accessType={courseAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <div className="container mx-auto px-4 py-8">
        <CourseAnalytics courseId={course.id} courseTitle={course.title} />
        <BackToCourses />

        <CourseHeader
          courseLabel={course.courseLabel}
          title={course.title}
          description={course.description}
        />

        <section>
          <ChaptersSectionTitle />

          {chapters.length === 0 ? (
            <EmptyState type="noChapters" />
          ) : (
            <div className="space-y-3">
              {chapters.map((chapter) => (
                <ChapterCard key={chapter.id} chapter={chapter} courseSlug={courseSlug} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const course = await queryCourseBySlug({ slug: courseSlug })

  if (!course) {
    return {
      title: 'Course Not Found',
    }
  }

  return {
    title: course.meta?.title || course.title,
    description: course.meta?.description || course.description || undefined,
  }
}
