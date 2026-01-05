import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { queryExercisesByLesson } from '@/lib/queries/exercises'
import { Breadcrumb } from '../../../../../_components/Breadcrumb'
import { LessonHeader } from '../../../../../_components/LessonHeader'
import { LessonContent } from './_components/LessonContent'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson, payload] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
    getPayload({ config: configPromise }),
  ])

  // Get current user
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const isAdmin = user?.role === 'admin'

  if (!course || !lesson) {
    notFound()
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) {
    notFound()
  }

  // Verify lesson belongs to the specified chapter
  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  // Fetch exercises for this lesson
  const exercises = await queryExercisesByLesson({ lessonId: lesson.id })

  const breadcrumbItems = [
    { label: 'Courses', href: '/courses' },
    { label: course.title, href: `/courses/${courseSlug}` },
    { label: lessonChapter.title, href: `/courses/${courseSlug}/chapters/${chapterSlug}` },
    { label: lesson.title },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      <LessonHeader order={lesson.order} title={lesson.title} description={lesson.description} />

      <LessonContent
        contentFile={typeof lesson.contentFile === 'string' ? null : lesson.contentFile}
        lessonTitle={lesson.title}
        exercises={exercises}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
        lessonId={lesson.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return {
      title: 'Lesson Not Found',
    }
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) {
    return {
      title: 'Lesson Not Found',
    }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return {
      title: 'Lesson Not Found',
    }
  }

  return {
    title: `${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: lesson.description || `Lesson ${lesson.order}: ${lesson.title}`,
  }
}
