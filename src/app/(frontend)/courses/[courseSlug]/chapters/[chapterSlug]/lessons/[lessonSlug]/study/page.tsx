import '@/infra/config/server-init'

import { SystemParams } from '@/infra/config/system-params'
import { resolveAccessType } from '@/server/constants/access-types'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { ChatInterface } from '@/ui/web/chat'
import { stripHtml } from '@/utils/strip-html'
import { notFound } from 'next/navigation'
import { StudyingWorkspace } from '@/ui/web/components/studying-workspace'
import type { ExerciseItem } from '@/ui/web/components/studying-sidebar'

/**
 * @fileType page
 * @domain study-mode
 * @pattern route-page
 * @ai-summary New variant study page with mode-based UI
 */

interface StudyPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    notFound()
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) {
    notFound()
  }

  // Verify lesson belongs to the specified chapter
  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  const effectiveAccessType = resolveAccessType(lesson.accessType, course.accessType)
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

  // Server-side block: for mandatory mode, don't render content for unauthenticated users
  if (effectiveAccessType === 'mandatory' && !(await isAuthenticatedServer())) {
    return (
      <AccessGateProvider
        accessType={effectiveAccessType}
        courseSlug={courseSlug}
        gatedDelayMs={gatedDelayMs}
        gatedWarningMs={gatedWarningMs}
      >
        <div className="min-h-screen" />
      </AccessGateProvider>
    )
  }

  const exercises = await queryExercisesByLesson({ lessonId: lesson.id })

  // Use lesson-scoped chat context to keep history stable across refreshes
  const chatLessonId = lesson.id
  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`

  // Transform exercises for sidebar
  const exerciseItems: ExerciseItem[] = exercises.map((ex) => ({
    id: ex.id,
    title: ex.title || 'Untitled Exercise',
    slug: ex.slug || '',
    order: ex.order,
    status: 'not_started' as const,
    progress: 0,
  }))

  // Use existing chat interface
  const chatContent = (
    <ChatInterface lessonId={chatLessonId} translationNamespace="courses" showMathTools={true} />
  )

  return (
    <AccessGateProvider
      accessType={effectiveAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <StudyingWorkspace
        lessonTitle={lesson.title}
        lessonId={lesson.id}
        exercises={exerciseItems}
        backUrl={backUrl}
        chatContent={chatContent}
      >
        {/* Placeholder - in full implementation, this would render the exercise content */}
        <div className="prose max-w-none">
          <h1>{lesson.title}</h1>
          <p className="text-muted-foreground">
            Interactive exercises will be rendered here in full implementation.
          </p>
          <p>Mode-based UI is active. Use the toggle in the header to switch between:</p>
          <ul>
            <li>
              <strong>Study</strong> - Default learning mode with lavender/soft blue theme
            </li>
            <li>
              <strong>Hint</strong> - Purple/indigo accents with chat panel
            </li>
            <li>
              <strong>Practice</strong> - Green accents with interactive cards
            </li>
            <li>
              <strong>Test</strong> - Orange accents with timer and restricted navigation
            </li>
          </ul>
        </div>
      </StudyingWorkspace>
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: StudyPageProps) {
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
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) {
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
    title: `${lesson.title} (Study Mode) - ${lessonChapter.title} - ${course.title}`,
    description: lesson.description
      ? stripHtml(lesson.description)
      : `Lesson ${lesson.order}: ${lesson.title}`,
  }
}
