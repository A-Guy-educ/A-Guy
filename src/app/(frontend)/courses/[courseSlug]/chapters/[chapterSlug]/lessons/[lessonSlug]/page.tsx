import '@/infra/config/server-init'

import { EmptyLessonPlaceholder } from './_components/EmptyLessonPlaceholder'
import type { Media } from '@/payload-types'
import { SystemParams } from '@/infra/config/system-params'
import { resolveAccessType } from '@/server/constants/access-types'
import { defaultLocale } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import { queryLessonBySlugDirectly } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { ChatInterface } from '@/ui/web/chat'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { stripHtml } from '@/utils/strip-html'
import { Media as MediaComponent } from '@/ui/web/media'
import { notFound } from 'next/navigation'
import { ExercisesPager } from './_components/ExercisesPager'
import { LessonAnalytics } from './_components/LessonAnalytics'
import { ExerciseWorkspace } from './exercises/[exerciseSlug]/_components/ExerciseWorkspace'

export const revalidate = 300 // ISR: revalidate every 5 minutes

interface LessonPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined

  // Use Direct variant — page validates hierarchy below, skip redundant DB checks
  // Saves 2 DB queries (chapter + course validation) inside queryLessonBySlug
  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlugDirectly({ slug: lessonSlug }),
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

  // Run independent queries in parallel to avoid sequential waterfall
  const [gatedDelayMs, gatedWarningMs, exercises] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
    queryExercisesByLesson({ lessonId: lesson.id }),
  ])

  // Use lesson-scoped chat context to keep history stable across refreshes
  const chatLessonId = lesson.id
  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`

  const validFiles =
    lesson.contentFiles
      ?.map((file) => (typeof file === 'string' ? null : file))
      .filter((file): file is Media => file !== null && Boolean(file.url)) || []

  const hasContent = validFiles.length > 0
  const hasExercises = exercises.length > 0

  // Batch-fetch all media referenced inside exercise content blocks
  const mediaMap = hasExercises ? await queryMediaByIds(extractAllMediaIds(exercises)) : {}

  // V3-converted exercises: if any exercise was generated from the attached document,
  // show the interactive exercises instead of the PDF viewer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasV3Exercises = exercises.some((ex: any) => ex.pipelineVersion === 3)

  // Case 1: No document attached, OR V3 exercises exist -> Show exercises pager
  if (!hasContent || hasV3Exercises) {
    return (
      <AccessGateProvider
        accessType={effectiveAccessType}
        courseSlug={courseSlug}
        gatedDelayMs={gatedDelayMs}
        gatedWarningMs={gatedWarningMs}
      >
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
              primaryContent={<EmptyLessonPlaceholder />}
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
      </AccessGateProvider>
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
    <AccessGateProvider
      accessType={effectiveAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
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
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined

  // Use Direct variant — page validates hierarchy below, skip redundant DB checks
  // Saves 2 DB queries (chapter + course validation) inside queryLessonBySlug
  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlugDirectly({ slug: lessonSlug }),
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
    title: `${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: lesson.description
      ? stripHtml(lesson.description)
      : `Lesson ${lesson.order}: ${lesson.title}`,
  }
}
