/**
 * Phase 2: Lesson-level translation
 *
 * Clones a lesson, translates metadata, and optionally triggers
 * Phase 1 for each child exercise.
 */
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { handleExerciseTranslation } from './handle-exercise-translation'

interface LessonTranslationInput {
  lessonId: string
  targetLocale: ContentLocale
  targetChapterId: string
  includeExercises: boolean
}

interface TranslatedExercise {
  sourceId: string
  newId: string
  title: string
}

export async function handleLessonTranslation(
  req: PayloadRequest,
  input: LessonTranslationInput,
  reqLogger: Logger,
) {
  const { payload } = req
  const { lessonId, targetLocale, targetChapterId, includeExercises } = input

  try {
  reqLogger.info({ lessonId, targetLocale }, 'Starting lesson translation')

  const source = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    overrideAccess: true,
  })

  if (!source) {
    return Response.json({ success: false, error: 'Lesson not found' }, { status: 404 })
  }

  const sourceLocale = (source.locale as ContentLocale) || 'he'

  if (sourceLocale === targetLocale) {
    return Response.json(
      { success: false, error: 'Source and target locale are the same' },
      { status: 400 },
    )
  }

  const titlePrefix = targetLocale === 'en' ? '[EN]' : '[HE]'
  const timestamp = Date.now().toString().slice(-6)
  const slug = source.slug ? `${source.slug}-${targetLocale}-${timestamp}` : undefined

  const newLesson = await payload.create({
    collection: 'lessons',
    draft: false,
    data: {
      tenant: typeof source.tenant === 'string' ? source.tenant : source.tenant.id,
      chapter: targetChapterId,
      type: source.type,
      title: `${titlePrefix} ${source.title}`,
      description: source.description ?? undefined,
      order: source.order,
      status: 'published',
      isActive: true,
      accessType: source.accessType,
      introEnabled: source.introEnabled ?? false,
      introDescription: source.introDescription ?? undefined,
      locale: targetLocale,
      translatedFrom: lessonId,
      contentStatus: 'none',
      contentStatusVisible: false,
      slug,
    },
  })

  reqLogger.info({ newLessonId: newLesson.id }, 'Lesson shell created')

  const translatedExercises: TranslatedExercise[] = []

  if (includeExercises) {
    const exercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      sort: 'order',
      limit: 500,
      overrideAccess: true,
    })

    reqLogger.info({ exerciseCount: exercises.docs.length }, 'Translating child exercises')

    for (const exercise of exercises.docs) {
      const result = await handleExerciseTranslation(
        req,
        {
          exerciseId: exercise.id,
          targetLocale,
          targetLessonId: newLesson.id,
        },
        reqLogger,
      )

      const body = await result.json()

      if (body.success) {
        translatedExercises.push({
          sourceId: exercise.id,
          newId: body.data.id,
          title: body.data.title,
        })
      } else {
        reqLogger.warn(
          { exerciseId: exercise.id, error: body.error },
          'Exercise translation failed, continuing with next',
        )
      }
    }
  }

  reqLogger.info(
    {
      newLessonId: newLesson.id,
      translatedCount: translatedExercises.length,
    },
    'Lesson translation complete',
  )

  return Response.json({
    success: true,
    data: {
      lessonId: newLesson.id,
      title: `${titlePrefix} ${source.title}`,
      exercises: translatedExercises,
    },
  })
  } catch (error) {
    reqLogger.error({ err: error, lessonId }, 'Lesson translation threw unexpected error')
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error during lesson translation',
      },
      { status: 500 },
    )
  }
}
