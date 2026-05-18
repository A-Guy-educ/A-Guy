import { notFound } from 'next/navigation'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBySlug, queryLessonsByCourse } from '@/server/repos/queries/lessons'
import type { Metadata } from 'next'
import { CompleteContent } from './CompleteContent'

type NextLesson = { id: string; title: string; href: string }
type RecommendedCourse = { id: string; title: string; href: string }

interface CompletePageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
  }>
}

export async function generateMetadata({ params }: CompletePageProps): Promise<Metadata> {
  const { courseSlug, chapterSlug, lessonSlug } = await params
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlug({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return { title: 'Lesson Complete' }
  }

  const lessonChapter = typeof lesson.chapter === 'string' ? null : lesson.chapter
  const lessonCourseId = lessonChapter
    ? typeof lessonChapter.course === 'string'
      ? lessonChapter.course
      : lessonChapter.course?.id
    : null

  if (!lessonCourseId || lessonCourseId !== course.id) {
    return { title: 'Lesson Complete' }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return { title: 'Lesson Complete' }
  }

  return {
    title: `${lesson.title} - Complete`,
    description: `You've completed all exercises in this lesson`,
  }
}

export default async function CompletePage({ params }: CompletePageProps) {
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

  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`
  const courseChapterUrl = backUrl

  // Determine next lesson and recommended courses
  let nextLesson: NextLesson | undefined
  let recommendedCourses: RecommendedCourse[] | undefined
  const isLastLesson = lesson.isLastLessonInCourse === true

  // Check for manual override first
  if (lesson.recommendedNextLesson && typeof lesson.recommendedNextLesson !== 'string') {
    const nextLessonId =
      typeof lesson.recommendedNextLesson.id === 'string'
        ? lesson.recommendedNextLesson.id
        : lesson.recommendedNextLesson

    // Fetch the recommended next lesson to get its details
    const recommendedNextLessonData = await queryLessonBySlug({
      slug: nextLessonId as unknown as string,
    })
    if (recommendedNextLessonData) {
      const nextChapter =
        typeof recommendedNextLessonData.chapter === 'object' &&
        recommendedNextLessonData.chapter !== null
          ? recommendedNextLessonData.chapter
          : null
      const nextChapterSlug = nextChapter?.slug ?? ''
      nextLesson = {
        id: recommendedNextLessonData.id,
        title: recommendedNextLessonData.title,
        href: `/courses/${courseSlug}/chapters/${nextChapterSlug}/lessons/${recommendedNextLessonData.slug}/complete`,
      }
    }
  } else if (!isLastLesson) {
    // Auto-find next lesson from course lessons
    const courseLessons = await queryLessonsByCourse({ courseId: course.id })
    const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id)
    if (currentIndex !== -1 && currentIndex < courseLessons.length - 1) {
      const next = courseLessons[currentIndex + 1]
      const nextChapter =
        typeof next.chapter === 'object' && next.chapter !== null ? next.chapter : null
      const nextChapterSlug = nextChapter?.slug ?? ''
      nextLesson = {
        id: next.id,
        title: next.title,
        href: `/courses/${courseSlug}/chapters/${nextChapterSlug}/lessons/${next.slug}/complete`,
      }
    }
  }

  // Get recommended courses if this is the last lesson
  if (isLastLesson && course.recommendedNextCourses?.length) {
    recommendedCourses = course.recommendedNextCourses
      .map((c) => {
        const courseObj = typeof c === 'object' && c !== null ? c : null
        if (!courseObj) return null
        const id = 'id' in courseObj ? courseObj.id : (c as string)
        const title = 'title' in courseObj ? courseObj.title : ''
        const slug = 'slug' in courseObj ? courseObj.slug : ''
        if (!title || !slug) return null
        return {
          id,
          title,
          href: `/courses/${slug}`,
        }
      })
      .filter((c): c is RecommendedCourse => c !== null)
  }

  return (
    <CompleteContent
      backUrl={backUrl}
      lessonId={lesson.id}
      gradeLevel={course.courseLabel}
      nextLesson={nextLesson}
      recommendedCourses={recommendedCourses}
      isLastLesson={isLastLesson}
      courseChapterUrl={courseChapterUrl}
    />
  )
}
