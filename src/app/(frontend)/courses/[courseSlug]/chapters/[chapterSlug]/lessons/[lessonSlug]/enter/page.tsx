import '@/infra/config/server-init'

import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBlocks } from '@/server/repos/queries/lesson-blocks'
import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { queryUserProgressByGrade } from '@/server/repos/queries/userProgress'
import { getAuthenticatedUserServer } from '@/server/utils/access-gate-server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LessonEntryPage } from '@/ui/web/components/LessonEntryPage'
import type { User } from '@/payload-types'

type DisplayMode = 'interactive' | 'scroll' | 'pdf'

interface LessonEnterPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export async function generateMetadata({ params }: LessonEnterPageProps): Promise<Metadata> {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return { title: 'Lesson Entry' }
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) {
    return { title: 'Lesson Entry' }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return { title: 'Lesson Entry' }
  }

  return {
    title: `${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: lesson.description
      ? lesson.description.replace(/<[^>]*>/g, '').substring(0, 160)
      : `Lesson ${lesson.order}: ${lesson.title}`,
  }
}

export default async function LessonEnterPage({ params }: LessonEnterPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson, { user }] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
    getAuthenticatedUserServer(),
  ])

  if (!course || !lesson) {
    notFound()
  }

  // Fetch lesson blocks to count exercises for progress display
  const lessonBlocks = await queryLessonBlocks({ lessonId: lesson.id })
  const totalExercises = lessonBlocks.filter((b) => b.type === 'exercise').length

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) {
    notFound()
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  // Determine user progress state
  let isNewUser = true
  let progressPercent = 0

  if (user) {
    const userProgress = await queryUserProgressByGrade({
      userId: user.id,
      gradeLevel: course.courseLabel,
    })

    if (userProgress?.progressRecords) {
      const lessonRecord = userProgress.progressRecords.find(
        (record) => record.recordType === 'lesson' && record.recordId === lesson.id,
      )

      if (
        lessonRecord &&
        lessonRecord.completionPercentage &&
        lessonRecord.completionPercentage > 0
      ) {
        isNewUser = false
        progressPercent = Math.min(100, Math.max(0, lessonRecord.completionPercentage))
      }
    }
  }

  // Resolve display modes — intersect availableDisplayModes with visibleRenderers
  // so only modes that are actually enabled for this lesson appear in the toggle.
  const availableModesRaw = lesson.availableDisplayModes
  const visibleRenderersRaw = lesson.visibleRenderers
  const availableModes: DisplayMode[] =
    Array.isArray(availableModesRaw) && availableModesRaw.length > 0
      ? (availableModesRaw as DisplayMode[])
      : ['interactive']

  // Intersect with visibleRenderers (e.g., if admin disabled 'pdf', exclude it)
  const effectiveModes = availableModes.filter(
    (m) =>
      !visibleRenderersRaw ||
      (Array.isArray(visibleRenderersRaw) &&
        visibleRenderersRaw.includes(m as 'media' | 'pdf' | 'interactive')),
  ) as DisplayMode[]

  const effectiveModesNonEmpty: DisplayMode[] =
    effectiveModes.length > 0 ? effectiveModes : ['interactive']
  const defaultMode: DisplayMode =
    effectiveModesNonEmpty.length > 0 ? effectiveModesNonEmpty[0] : 'interactive'

  // Resolve creator info
  const createdBy = lesson.createdBy
    ? typeof lesson.createdBy === 'string'
      ? null
      : (lesson.createdBy as User)
    : null

  return (
    <LessonEntryPage
      lesson={{
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        description: lesson.description ?? null,
        estimatedTime: lesson.estimatedTime ?? 30,
        availableDisplayModes: effectiveModesNonEmpty,
        createdBy: createdBy,
      }}
      courseSlug={courseSlug}
      chapterSlug={chapterSlug}
      lessonSlug={lessonSlug}
      isNewUser={isNewUser}
      progressPercent={progressPercent}
      totalExercises={totalExercises}
      availableModes={effectiveModesNonEmpty}
      defaultMode={defaultMode}
      gradeLevel={course.courseLabel}
    />
  )
}
