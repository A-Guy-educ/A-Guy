import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { notFound, redirect } from 'next/navigation'
import { LessonIntro } from './_components/LessonIntro'

interface LessonAboutPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function LessonAboutPage({ params }: LessonAboutPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    notFound()
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) {
    notFound()
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  const lessonUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`

  // If intro is not enabled, redirect straight to the lesson
  if (!lesson.introEnabled) {
    redirect(lessonUrl)
  }

  return <LessonIntro lesson={lesson} lessonUrl={lessonUrl} />
}

export async function generateMetadata({ params }: LessonAboutPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return { title: 'Lesson Not Found' }
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) {
    return { title: 'Lesson Not Found' }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return { title: 'Lesson Not Found' }
  }

  return {
    title: `${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: lesson.introDescription || lesson.description || lesson.title,
  }
}
