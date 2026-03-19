/**
 * Phase 1: Exercise-level translation
 *
 * Clones an exercise, translates its content blocks via LLM,
 * and saves the new exercise linked to the target lesson.
 */
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import {
  translateContentBlocks,
  translateText,
} from '@/infra/llm/services/content-translation-service'

interface ExerciseTranslationInput {
  exerciseId: string
  targetLocale: ContentLocale
  targetLessonId: string
  promptId?: string
}

export async function handleExerciseTranslation(
  req: PayloadRequest,
  input: ExerciseTranslationInput,
  reqLogger: Logger,
) {
  const { payload } = req
  const { exerciseId, targetLocale, targetLessonId, promptId } = input

  try {
    reqLogger.info({ exerciseId, targetLocale }, 'Starting exercise translation')

    const source = await payload.findByID({
      collection: 'exercises',
      id: exerciseId,
      overrideAccess: true,
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

    let customSystemPrompt: string | undefined
    if (promptId) {
      const prompt = await payload.findByID({
        collection: 'prompts',
        id: promptId,
        overrideAccess: true,
      })
      customSystemPrompt = prompt?.template || undefined
    }

    const content = source.content as { blocks: unknown[] } | undefined
    const blocks = content?.blocks ?? []

    const translationResult = await translateContentBlocks(
      {
        blocks: blocks as Parameters<typeof translateContentBlocks>[0]['blocks'],
        sourceLocale,
        targetLocale,
        customSystemPrompt,
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

    const [translatedTitle] = source.title
      ? await translateText([source.title], sourceLocale, targetLocale, payload)
      : ['Exercise']

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
  } catch (error) {
    reqLogger.error({ err: error, exerciseId }, 'Exercise translation threw unexpected error')
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected error during exercise translation',
      },
      { status: 500 },
    )
  }
}
