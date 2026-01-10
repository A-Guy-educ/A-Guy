import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { queryExerciseById } from '@/lib/queries/exercises'
import { NotebookWorkspace } from './_components/NotebookWorkspace'
import { NotebookChat } from './_components/NotebookChat'
import { NotebookFormulas } from './_components/NotebookFormulas'
import { NotebookNotes } from './_components/NotebookNotes'
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

  // Type assertion: Exercise.content is JSON field, but we validate it matches ExerciseContentData
  const exerciseContent = exercise.content as unknown as ExerciseContentData

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background relative z-50">
      <NotebookWorkspace
        content={<ExerciseRenderer content={exerciseContent} mode="student" showCheckAnswer />}
        chat={<NotebookChat exerciseId={exerciseId} />}
        formulas={<NotebookFormulas />}
        notes={<NotebookNotes />}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
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
