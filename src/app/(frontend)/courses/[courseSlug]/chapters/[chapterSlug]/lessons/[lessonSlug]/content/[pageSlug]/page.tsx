import '@/infra/config/server-init'

import { SystemParams } from '@/infra/config/system-params'
import { resolveAccessType } from '@/server/constants/access-types'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBlocks } from '@/server/repos/queries/lessonBlocks'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { isAuthenticatedServer } from '@/server/utils/access-gate-server'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { notFound } from 'next/navigation'
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

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  // Resolve blocks and verify the content page belongs to this lesson
  const lessonBlocks = await queryLessonBlocks({ lessonId: lesson.id })
  const contentPageExists = lessonBlocks.some(
    (b) =>
      b.blockType === 'contentPageRef' &&
      (b.contentPage.slug === pageSlug || b.contentPage.id === pageSlug),
  )

  if (!contentPageExists) {
    notFound()
  }

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

  const exerciseBlocks = lessonBlocks
    .filter((b) => b.blockType === 'exerciseRef')
    .map(
      (b) =>
        (b as { blockType: 'exerciseRef'; exercise: { id: string; content: unknown } }).exercise,
    )

  const mediaMap =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exerciseBlocks.length > 0
      ? await queryMediaByIds(extractAllMediaIds(exerciseBlocks as any))
      : {}

  return (
    <AccessGateProvider
      accessType={effectiveAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
      <LessonPager
        blocks={lessonBlocks}
        lessonTitle={lesson.title}
        backUrl={`/courses/${courseSlug}/chapters/${chapterSlug}`}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
        lessonId={lesson.id}
        introDescription={lesson.introEnabled ? lesson.introDescription : null}
        introMedia={lesson.introEnabled ? lesson.introMedia : null}
        mediaMap={mediaMap}
      />
    </AccessGateProvider>
  )
}
