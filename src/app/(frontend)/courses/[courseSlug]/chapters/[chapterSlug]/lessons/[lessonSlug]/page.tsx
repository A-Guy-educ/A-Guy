import '@/infra/config/server-init'

import { getSystemLocale } from '@/i18n/server-locale'
import { SystemParams } from '@/infra/config/system-params'
import type { Media } from '@/payload-types'
import { resolveAccessType } from '@/server/constants/access-types'
import { RenderBlocks } from '@/server/payload/blocks/RenderBlocks'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryExercisesByLesson } from '@/server/repos/queries/exercises'
import { resolveFormulaSheet } from '@/server/repos/queries/formula-sheets'
import type { FormulaSheet } from '@/payload-types'
import { queryLessonBlocks } from '@/server/repos/queries/lesson-blocks'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { stripHtml } from '@/utils/strip-html'
import { notFound } from 'next/navigation'
import { EmptyLessonPlaceholder } from './_components/EmptyLessonPlaceholder'
import { ExercisesPager } from './_components/ExercisesPager'
import { LessonAnalytics } from './_components/LessonAnalytics'
import { LessonPager } from './_components/LessonPager'
import { PdfLessonPager } from './_components/PdfLessonPager'
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
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    notFound()
  }

  // Resolve formula sheet for this lesson (with course fallback)
  // JSON.parse(JSON.stringify()) strips non-serializable data (Dates, circular refs)
  // that would crash Next.js server → client prop serialization
  let formulaSheet: FormulaSheet | null = null
  try {
    const result = contentLocale
      ? await resolveFormulaSheet({
          lessonId: lesson.id,
          courseId: course.id,
          locale: contentLocale,
        })
      : null
    formulaSheet = result?.sheet ? JSON.parse(JSON.stringify(result.sheet)) : null
  } catch {
    // Formula sheet resolution failed — continue without it
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

  // Server-side block: for paid mode, check entitlement
  if (effectiveAccessType === 'paid') {
    const { requiresEntitlement, isAuthenticated } = await checkPaidAccess(course.id)

    if (requiresEntitlement) {
      return (
        <AccessGateProvider
          accessType={effectiveAccessType}
          courseSlug={courseSlug}
          gatedDelayMs={gatedDelayMs}
          gatedWarningMs={gatedWarningMs}
          requiresEntitlement={true}
          isAuthenticated={isAuthenticated}
        >
          <div className="min-h-screen" />
        </AccessGateProvider>
      )
    }
  }

  // Resolve content files (PDFs, etc.) — needed by both blocks and legacy paths
  const validFiles =
    lesson.contentFiles
      ?.map((file) => (typeof file === 'string' ? null : file))
      .filter((file): file is Media => file !== null && Boolean(file.url)) || []

  // Try blocks-based path first (new architecture)
  const resolvedBlocks = await queryLessonBlocks({ lessonId: lesson.id })
  const hasBlocks = resolvedBlocks.length > 0

  if (hasBlocks) {
    // Extract exercises from blocks for media fetching
    const blockExercises = resolvedBlocks
      .filter((b) => b.type === 'exercise')
      .map((b) => b.data as import('@/payload-types').Exercise)
    const mediaMap =
      blockExercises.length > 0 ? await queryMediaByIds(extractAllMediaIds(blockExercises)) : {}
    const hasExercises = blockExercises.length > 0

    // Pre-render content page bodies server-side
    const contentPageBodies: Record<string, React.ReactNode> = {}
    for (const block of resolvedBlocks) {
      if (
        block.type === 'contentPage' &&
        block.data.body &&
        Array.isArray(block.data.body) &&
        block.data.body.length > 0
      ) {
        contentPageBodies[block.data.id] = (
          <RenderBlocks blocks={block.data.body} defaultSpacing={block.data.defaultBlockSpacing} />
        )
      }
    }

    return (
      <AccessGateProvider
        accessType={effectiveAccessType}
        courseSlug={courseSlug}
        gatedDelayMs={gatedDelayMs}
        gatedWarningMs={gatedWarningMs}
      >
        <LessonAnalytics
          lessonId={lesson.id}
          courseId={course.id}
          lessonTitle={lesson.title}
          contentType="blocks"
        />
        <LessonPager
          blocks={resolvedBlocks}
          lessonTitle={lesson.title}
          backUrl="/study"
          courseSlug={courseSlug}
          chapterSlug={chapterSlug}
          lessonSlug={lessonSlug}
          lessonId={lesson.id}
          mediaMap={mediaMap}
          contentPageBodies={contentPageBodies}
          validFiles={validFiles}
          chatLessonId={lesson.id}
          hasExercises={hasExercises}
          formulaSheet={formulaSheet}
        />
      </AccessGateProvider>
    )
  }

  // Legacy path: exercises-only (lessons without blocks field)
  const exercises = await queryExercisesByLesson({ lessonId: lesson.id })

  // Use lesson-scoped chat context to keep history stable across refreshes
  const chatLessonId = lesson.id
  const backUrl = '/study'

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
        <LessonAnalytics
          lessonId={lesson.id}
          courseId={course.id}
          lessonTitle={lesson.title}
          contentType="exercises"
        />
        {hasExercises ? (
          <ExercisesPager
            exercises={exercises}
            lessonTitle={lesson.title}
            backUrl={backUrl}
            courseSlug={courseSlug}
            chapterSlug={chapterSlug}
            lessonSlug={lessonSlug}
            lessonId={lesson.id}
            mediaMap={mediaMap}
            hasExercises={hasExercises}
            formulaSheet={formulaSheet}
          />
        ) : (
          // Empty lesson: show ExerciseWorkspace with DynamicLesson as primaryContent
          <>
            <ExerciseWorkspace
              exerciseTitle={lesson.title}
              backUrl={backUrl}
              primaryContent={<EmptyLessonPlaceholder />}
              chatContent={null}
            />
          </>
        )}
      </AccessGateProvider>
    )
  }

  // Case 2: Document exists -> Use PdfLessonPager with intro/outro flow
  return (
    <AccessGateProvider
      accessType={effectiveAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <LessonAnalytics
        lessonId={lesson.id}
        courseId={course.id}
        lessonTitle={lesson.title}
        contentType="pdf"
      />
      <PdfLessonPager
        validFiles={validFiles}
        lessonTitle={lesson.title}
        backUrl={backUrl}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
        lessonId={lesson.id}
        chatLessonId={chatLessonId}
        hasExercises={hasExercises}
        formulaSheet={formulaSheet}
      />
    </AccessGateProvider>
  )
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
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
    title: `${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: lesson.description
      ? stripHtml(lesson.description)
      : `Lesson ${lesson.order}: ${lesson.title}`,
  }
}
