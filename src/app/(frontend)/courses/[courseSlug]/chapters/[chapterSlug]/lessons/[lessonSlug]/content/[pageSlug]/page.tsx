import '@/infra/config/server-init'

import type { Exercise } from '@/payload-types'
import { SystemParams } from '@/infra/config/system-params'
import { resolveAccessType } from '@/server/constants/access-types'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBlocks } from '@/server/repos/queries/lesson-blocks'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { notFound } from 'next/navigation'
import { RenderBlocks } from '@/server/payload/blocks/RenderBlocks'
import { LessonPager } from '../../_components/LessonPager'
import { LessonAnalytics } from '../../_components/LessonAnalytics'

interface ContentPageRouteProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
    pageSlug: string
  }>
}

export default async function ContentPageRoute({ params }: ContentPageRouteProps) {
  const { courseSlug, chapterSlug, lessonSlug, pageSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) notFound()

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) notFound()
  if (!lessonChapter || lessonChapter.slug !== chapterSlug) notFound()

  // Resolve blocks and verify the content page exists in this lesson
  const resolvedBlocks = await queryLessonBlocks({ lessonId: lesson.id })
  const hasContentPage = resolvedBlocks.some(
    (b) => b.type === 'contentPage' && (b.data.slug === pageSlug || b.data.id === pageSlug),
  )

  if (!hasContentPage) notFound()

  // Access control
  const effectiveAccessType = resolveAccessType(lesson.accessType, course.accessType)
  const [gatedDelayMs, gatedWarningMs] = await Promise.all([
    SystemParams.getGatedDelayMs(),
    SystemParams.getGatedWarningMs(),
  ])

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

  // Media map for exercises in blocks
  const blockExercises = resolvedBlocks
    .filter((b) => b.type === 'exercise')
    .map((b) => b.data as Exercise)
  const mediaMap =
    blockExercises.length > 0 ? await queryMediaByIds(extractAllMediaIds(blockExercises)) : {}

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
      />
    </AccessGateProvider>
  )
}
