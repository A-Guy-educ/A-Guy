import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { queryExerciseById } from '@/lib/queries/exercises'
import { Breadcrumb } from '../../../../../../../_components/Breadcrumb'
import { ExercisePageHeader } from './_components/ExercisePageHeader'
import { ExercisePageContent } from './_components/ExercisePageContent'

interface ExercisePageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
    exerciseId: string
  }>
}

export default async function ExercisePage({ params }: ExercisePageProps) {
  const { courseSlug, chapterSlug, lessonSlug, exerciseId } = await params

  const [course, lesson, exercise] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
    queryExerciseById({ id: exerciseId }),
  ])

  if (!course || !lesson || !exercise) {
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

  // Verify exercise belongs to the lesson
  const exerciseLesson = typeof exercise.lesson === 'string' ? null : exercise.lesson
  if (!exerciseLesson || exerciseLesson.id !== lesson.id) {
    notFound()
  }

  const breadcrumbItems = [
    { label: 'Courses', href: '/courses' },
    { label: course.title, href: `/courses/${courseSlug}` },
    { label: lessonChapter.title, href: `/courses/${courseSlug}/chapters/${chapterSlug}` },
    {
      label: lesson.title,
      href: `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`,
    },
    { label: exercise.title },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      <ExercisePageHeader
        title={exercise.title}
        questionType={exercise.questionType}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
      />

      <ExercisePageContent
        contentJson={exercise.contentJson}
        answerSpecJson={exercise.answerSpecJson}
        questionType={exercise.questionType}
      />
    </div>
  )
}

export async function generateMetadata({ params }: ExercisePageProps) {
  const { courseSlug, chapterSlug, lessonSlug, exerciseId } = await params

  const [course, lesson, exercise] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
    queryExerciseById({ id: exerciseId }),
  ])

  if (!course || !lesson || !exercise) {
    return {
      title: 'Exercise Not Found',
    }
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourse =
    lessonChapter && typeof lessonChapter.course !== 'string' ? lessonChapter.course : null

  if (!lessonCourse || lessonCourse.id !== course.id) {
    return {
      title: 'Exercise Not Found',
    }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return {
      title: 'Exercise Not Found',
    }
  }

  const exerciseLesson = typeof exercise.lesson === 'string' ? null : exercise.lesson
  if (!exerciseLesson || exerciseLesson.id !== lesson.id) {
    return {
      title: 'Exercise Not Found',
    }
  }

  return {
    title: `${exercise.title} - ${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: `Practice exercise: ${exercise.title}`,
  }
}
