import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryLessonBySlug } from '@/lib/queries/lessons'
import { queryExercisesByLesson } from '@/lib/queries/exercises'
import type { Exercise, Media } from '@/payload-types'
import { Media as MediaComponent } from '@/components/Media'
import { EmptyState } from '../../../../../_components/EmptyState'
import { ExerciseWorkspace } from './exercises/[exerciseId]/_components/ExerciseWorkspace'
import { ChatInterface } from './exercises/[exerciseId]/_components/ChatInterface'

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
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

  // Verify lesson belongs to the specified chapter
  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  // Fetch exercises for this lesson (used for chat context)
  const exercises = await queryExercisesByLesson({ lessonId: lesson.id })

  // Use the first exercise as the primary chat context when available,
  // otherwise use the lesson ID for lesson-scoped conversation.
  const primaryExercise = exercises[0] as Exercise | undefined
  const chatExerciseId = primaryExercise?.id
  const chatLessonId = primaryExercise ? undefined : lesson.id

  const validFiles =
    lesson.contentFiles
      ?.map((file) => (typeof file === 'string' ? null : file))
      .filter((file): file is Media => file !== null && Boolean(file.url)) || []

  const hasContent = validFiles.length > 0

  const pdfContent = hasContent ? (
    <div className="w-full h-full flex flex-col">
      {validFiles.map((file, index) => (
        <div key={file.id} className="w-full h-full flex-shrink-0">
          {index > 0 && (
            <div className="h-0.5 my-8 flex-shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          )}
          <div className="border rounded-lg overflow-hidden bg-card shadow-lg h-full">
            <MediaComponent resource={file} className="w-full h-full" htmlElement={null} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <EmptyState type="noPDF" />
    </div>
  )

  return (
    <ExerciseWorkspace
      exerciseTitle={lesson.title}
      backUrl={`/courses/${courseSlug}/chapters/${chapterSlug}`}
      pdfContent={pdfContent}
      chatContent={<ChatInterface exerciseId={chatExerciseId} lessonId={chatLessonId} />}
    />
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
