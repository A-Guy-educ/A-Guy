import type { Media } from '@/payload-types'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { ChatInterface } from '@/ui/web/chat'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { Media as MediaComponent } from '@/ui/web/media'
import { notFound } from 'next/navigation'
import { BackToChapter } from '../../../../../_components/BackToChapter'
import { EmptyState } from '../../../../../_components/EmptyState'
import { ExercisesPager } from './_components/ExercisesPager'
import { LessonAnalytics } from './_components/LessonAnalytics'
import { ExerciseWorkspace } from './exercises/[exerciseSlug]/_components/ExerciseWorkspace'

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

  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`

  // Interactive Demo: additive code path gated by lesson.type === 'interactive_demo'
  if (lesson.type === 'interactive_demo') {
    // Extract tenantId from lesson (same pattern as exercise-conversion-service.ts)
    const tenantId =
      typeof lesson.tenant === 'string'
        ? lesson.tenant
        : ((lesson.tenant as { id: string } | null)?.id ?? '')

    const { getInteractiveDemoConfig } = await import('@/server/config/interactive-demo-config')
    // ConfigDomain.InteractiveDemo maps to 'interactive_demo' in ConfigValues collection
    // (defined in src/infra/config/config-constants.ts:30)
    const config = await getInteractiveDemoConfig(tenantId)

    // TEMPORARY DEBUG LOGGING (per requirement #1)
    console.log('[LessonPage] Interactive Demo Debug:', {
      'lesson.type': lesson.type,
      tenantId,
      'isInteractiveDemoEnabled': config.enabled,
      'lesson.type === interactive_demo': lesson.type === 'interactive_demo',
    })
    
    const { InteractiveDemoGate } = await import('@/ui/web/interactive-demo/InteractiveDemoGate')
    return (
      <>
        <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
        <InteractiveDemoGate
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          backUrl={backUrl}
          typewriterEnabled={lesson.typewriterEnabled ?? true}
          isInteractiveDemoEnabled={config.enabled}
        />
      </>
    )
  }

  // Use lesson-scoped chat context to keep history stable across refreshes
  const chatLessonId = lesson.id

  const validFiles =
    lesson.contentFiles
      ?.map((file) => (typeof file === 'string' ? null : file))
      .filter((file): file is Media => file !== null && Boolean(file.url)) || []

  const hasContent = validFiles.length > 0
  const hasExercises = exercises.length > 0

  // Batch-fetch all media referenced inside exercise content blocks
  const mediaMap = hasExercises ? await queryMediaByIds(extractAllMediaIds(exercises)) : {}

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
            introDescription={lesson.introEnabled ? lesson.introDescription : null}
            introMedia={lesson.introEnabled ? lesson.introMedia : null}
            mediaMap={mediaMap}
          />
        ) : (
          // Empty lesson: show ExerciseWorkspace with DynamicLesson as primaryContent
          <>
            <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
            <ExerciseWorkspace
              exerciseTitle={lesson.title}
              backUrl={backUrl}
              primaryContent={<DynamicLesson />}
              chatContent={
                <ChatInterface
                  lessonId={chatLessonId}
                  translationNamespace="courses"
                  showMathTools={true}
                />
              }
            />
          </>
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
