import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { Breadcrumb } from '@/components/courses/Breadcrumb'
import { LessonHeader } from '@/components/courses/LessonHeader'
import { PDFViewer } from '@/components/courses/PDFViewer'
import { EmptyState } from '@/components/courses/EmptyState'

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    notFound()
  }

  const lessonCourseId = typeof lesson.course === 'string' ? lesson.course : lesson.course.id
  if (lessonCourseId !== course.id) {
    notFound()
  }

  const breadcrumbItems = [
    { label: 'Courses', href: '/courses' },
    { label: course.title, href: `/courses/${courseSlug}` },
    { label: lesson.title },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      <LessonHeader
        order={lesson.order}
        title={lesson.title}
        description={lesson.description}
        contentType={lesson.contentType}
      />

      <section className="mb-8">
        {lesson.contentType === 'pdf' && lesson.pdfUrl ? (
          <PDFViewer pdfUrl={lesson.pdfUrl} lessonTitle={lesson.title} />
        ) : (
          <EmptyState type="noPDF" />
        )}
      </section>
    </div>
  )
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return {
      title: 'Lesson Not Found',
    }
  }

  const lessonCourseId = typeof lesson.course === 'string' ? lesson.course : lesson.course.id
  if (lessonCourseId !== course.id) {
    return {
      title: 'Lesson Not Found',
    }
  }

  return {
    title: `${lesson.title} - ${course.title}`,
    description: lesson.description || `Lesson ${lesson.order}: ${lesson.title}`,
  }
}
