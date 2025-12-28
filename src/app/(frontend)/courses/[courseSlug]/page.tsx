import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonsByCourse } from '@/lib/queries/lessons'
import { CourseHeader } from '@/components/courses/CourseHeader'
import { LessonCard } from '@/components/courses/LessonCard'
import { EmptyState } from '@/components/courses/EmptyState'
import { BackToCourses } from '@/components/courses/BackToCourses'
import { LessonsSectionTitle } from '@/components/courses/LessonsSectionTitle'

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

  const lessons = await queryLessonsByCourse({ courseId: course.id })

  return (
    <div className="container mx-auto px-4 py-8">
      <BackToCourses />

      <CourseHeader
        courseLabel={course.courseLabel}
        title={course.title}
        description={course.description}
      />

      <section>
        <LessonsSectionTitle />

        {lessons.length === 0 ? (
          <EmptyState type="noLessons" />
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} courseSlug={courseSlug} />
            ))}
          </div>
        )}
      </section>
    </div>
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
