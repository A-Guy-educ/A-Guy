import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import type { Media } from '@/payload-types'
import { Media as MediaComponent } from '@/ui/web/media'
import { notFound } from 'next/navigation'
import { EmptyState } from '../../../../../_components/EmptyState'
import { LessonAnalytics } from './_components/LessonAnalytics'
import { ChatInterface } from '@/ui/web/chat'
import { ExerciseWorkspace } from './exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ExercisesPager } from './_components/ExercisesPager'
import { BackToChapter } from '../../../../../_components/BackToChapter'

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson, exercises] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
    queryLessonBySlug({ slug: lessonSlug }).then((l) =>
      l ? queryExercisesByLesson({ lessonId: l.id }) : [],
    ),
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

  // Use lesson-scoped chat context to keep history stable across refreshes
  const chatLessonId = lesson.id
  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`

  const validFiles =
    lesson.contentFiles
      ?.map((file) => (typeof file === 'string' ? null : file))
      .filter((file): file is Media => file !== null && Boolean(file.url)) || []

  const hasContent = validFiles.length > 0
  const hasExercises = exercises.length > 0

  // Case 1: No document attached -> Show exercises pager if exercises exist
  if (!hasContent) {
    return (
      <>
        <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
        {hasExercises ? (
          <ExercisesPager
            exercises={exercises}
            lessonTitle={lesson.title}
            backUrl={backUrl}
            courseSlug={courseSlug}
            chapterSlug={chapterSlug}
            lessonSlug={lessonSlug}
            lessonId={lesson.id}
          />
        ) : (
          // Empty state: no document and no exercises
          <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <EmptyState type="noPDF" />
            <div className="mt-8">
              <BackToChapter href={backUrl} />
            </div>
          </div>
        )}
      </>
    )
  }

  // Case 2: Document exists -> Keep existing behavior with ExerciseWorkspace
  const primaryContent = (
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
  )

  return (
    <>
      <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
      <ExerciseWorkspace
        exerciseTitle={lesson.title}
        backUrl={backUrl}
        primaryContent={primaryContent}
        chatContent={
          <ChatInterface
            lessonId={chatLessonId}
            translationNamespace="courses"
            showMathTools={true}
          />
        }
      />
    </>
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
