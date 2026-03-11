import { notFound, redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryCourseBySlug } from '@/server/repos/queries/courses'
import { queryLessonBySlugDirectly } from '@/server/repos/queries/lessons'
import {
  queryExerciseById,
  queryExerciseBySlug,
  queryExercisesByLesson,
} from '@/server/repos/queries/exercises'
import { queryMediaByIds } from '@/server/repos/queries/media'
import { extractAllMediaIds } from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { ExercisesPager } from '../../_components/ExercisesPager'

export const revalidate = 300 // ISR: revalidate every 5 minutes

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

function isObjectId(value: string): boolean {
  return OBJECT_ID_REGEX.test(value)
}

interface ExercisePageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
    lessonSlug: string
    exerciseSlug: string
  }>
}

async function resolveExercise(lessonId: string, param: string) {
  const exerciseBySlug = await queryExerciseBySlug({ lessonId, slug: param })

  if (exerciseBySlug) {
    return { exercise: exerciseBySlug, mode: 'slug' as const }
  }

  if (isObjectId(param)) {
    const exerciseById = await queryExerciseById({ id: param })

    if (exerciseById) {
      const exerciseLesson = typeof exerciseById.lesson === 'string' ? null : exerciseById.lesson
      if (exerciseLesson && exerciseLesson.id === lessonId) {
        if (exerciseById.slug) {
          return {
            exercise: exerciseById,
            mode: 'redirect' as const,
            canonicalSlug: exerciseById.slug,
          }
        }
        return { exercise: exerciseById, mode: 'id' as const }
      }
    }
  }

  return { exercise: null, mode: 'not-found' as const }
}

export default async function ExercisePage({ params }: ExercisePageProps) {
  const { courseSlug, chapterSlug, lessonSlug, exerciseSlug } = await params
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined

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

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    notFound()
  }

  const [resolved, exercises] = await Promise.all([
    resolveExercise(lesson.id, exerciseSlug),
    queryExercisesByLesson({ lessonId: lesson.id }),
  ])

  if (resolved.mode === 'not-found' || !resolved.exercise) {
    notFound()
  }

  if (resolved.mode === 'redirect') {
    const redirectUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${resolved.canonicalSlug}`
    redirect(redirectUrl)
  }

  const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`

  const mediaMap = await queryMediaByIds(extractAllMediaIds(exercises))

  return (
    <ExercisesPager
      exercises={exercises}
      lessonTitle={lesson.title}
      backUrl={backUrl}
      courseSlug={courseSlug}
      chapterSlug={chapterSlug}
      lessonSlug={lessonSlug}
      lessonId={lesson.id}
      mediaMap={mediaMap}
    />
  )
}

export async function generateMetadata({ params }: ExercisePageProps) {
  const { courseSlug, chapterSlug, lessonSlug, exerciseSlug } = await params
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined

  const [course, lesson] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug, locale: contentLocale }),
    queryLessonBySlugDirectly({ slug: lessonSlug }),
  ])

  if (!course || !lesson) {
    return {
      title: 'Exercise Not Found',
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
      title: 'Exercise Not Found',
    }
  }

  if (!lessonChapter || lessonChapter.slug !== chapterSlug) {
    return {
      title: 'Exercise Not Found',
    }
  }

  const resolved = await resolveExercise(lesson.id, exerciseSlug)

  if (resolved.mode === 'not-found' || !resolved.exercise) {
    return {
      title: 'Exercise Not Found',
    }
  }

  if (resolved.mode === 'redirect') {
    return {
      title: 'Exercise Not Found',
    }
  }

  const exercise = resolved.exercise

  return {
    title: `${exercise.title} - ${lesson.title} - ${lessonChapter.title} - ${course.title}`,
    description: `Practice exercise: ${exercise.title}`,
  }
}
