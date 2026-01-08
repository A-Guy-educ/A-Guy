import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { queryExerciseById } from '@/lib/queries/exercises'
import { ExerciseWorkspace } from './_components/ExerciseWorkspace'
import { ChatInterface } from './_components/ChatInterface'
import { ExerciseRenderer } from '@/components/ExerciseRenderer'
import type { ExerciseContentData } from '@/components/ExerciseRenderer/types'

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

  const lessonUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`

  return (
    <ExerciseWorkspace
      exerciseTitle={exercise.title}
      backUrl={lessonUrl}
      pdfContent={
        <div
          className="w-full max-w-[920px] h-full bg-card border border-border rounded-[10px] p-12 text-foreground shadow-[0_10px_30px_hsl(var(--border))] overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ExerciseRenderer
            content={(exercise as any).content as ExerciseContentData}
            mode="student"
            showCheckAnswer
          />
        </div>
      }
      chatContent={<ChatInterface exerciseId={exerciseId} />}
    />
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
