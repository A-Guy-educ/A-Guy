/**
 * Phase 1: Exercise-level translation
 *
 * Clones an exercise, translates its content blocks via LLM,
 * and saves the new exercise linked to the target lesson.
 */
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { translateContentBlocks } from '@/infra/llm/services/content-translation-service'

interface ExerciseTranslationInput {
  exerciseId: string
  targetLocale: ContentLocale
  targetLessonId: string
}

export async function handleExerciseTranslation(
  req: PayloadRequest,
  input: ExerciseTranslationInput,
  reqLogger: Logger,
) {
  const { payload } = req
  const { exerciseId, targetLocale, targetLessonId } = input

  reqLogger.info({ exerciseId, targetLocale }, 'Starting exercise translation')

  const source = await payload.findByID({
    collection: 'exercises',
    id: exerciseId,
  })

  if (!source) {
    return Response.json({ success: false, error: 'Exercise not found' }, { status: 404 })
  }

  const sourceLocale = (source.locale as ContentLocale) || 'he'

  if (sourceLocale === targetLocale) {
    return Response.json(
      { success: false, error: 'Source and target locale are the same' },
      { status: 400 },
    )
  }

  const content = source.content as { blocks: unknown[] } | undefined
  const blocks = content?.blocks ?? []

  const translationResult = await translateContentBlocks(
    {
      blocks: blocks as Parameters<typeof translateContentBlocks>[0]['blocks'],
      sourceLocale,
      targetLocale,
    },
    payload,
  )

  if (!translationResult.success || !translationResult.data) {
    reqLogger.error({ error: translationResult.error }, 'Block translation failed')
    return Response.json(
      { success: false, error: translationResult.error ?? 'Translation failed' },
      { status: 500 },
    )
  }

  const titlePrefix = targetLocale === 'en' ? '[EN]' : '[HE]'
  const translatedTitle = source.title
    ? `${titlePrefix} ${source.title}`
    : `${titlePrefix} Exercise`

  const newExercise = await payload.create({
    collection: 'exercises',
    draft: false,
    data: {
      tenant: typeof source.tenant === 'string' ? source.tenant : source.tenant.id,
      title: translatedTitle,
      order: source.order,
      lesson: targetLessonId,
      content: translationResult.data as unknown as Record<string, unknown>,
      locale: targetLocale,
      translatedFrom: exerciseId,
      origin: 'manual',
    },
  })

  reqLogger.info({ newExerciseId: newExercise.id }, 'Exercise translated successfully')

  return Response.json({
    success: true,
    data: { id: newExercise.id, title: translatedTitle },
  })
}
