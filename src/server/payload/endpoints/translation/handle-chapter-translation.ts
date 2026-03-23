/**
 * Chapter-level translation
 *
 * Clones a chapter, translates metadata, and triggers
 * lesson translation for each child lesson (which cascades to exercises).
 */
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { translateText } from '@/infra/llm/services/content-translation-service'
import { handleLessonTranslation } from './handle-lesson-translation'

interface ChapterTranslationInput {
  chapterId: string
  targetLocale: ContentLocale
  targetCourseId: string
  promptId?: string
}

export async function handleChapterTranslation(
  req: PayloadRequest,
  input: ChapterTranslationInput,
  reqLogger: Logger,
) {
  const { payload } = req
  const { chapterId, targetLocale, targetCourseId, promptId } = input

  try {
    reqLogger.info({ chapterId, targetLocale }, 'Starting chapter translation')

    const source = await payload.findByID({
      collection: 'chapters',
      id: chapterId,
      overrideAccess: true,
    })

    if (!source) {
      return Response.json({ success: false, error: 'Chapter not found' }, { status: 404 })
    }

    const sourceLocale = (source.locale as ContentLocale) || 'he'

    if (sourceLocale === targetLocale) {
      return Response.json(
        { success: false, error: 'Source and target locale are the same' },
        { status: 400 },
      )
    }

    const [translatedTitle] = await translateText(
      [source.title],
      sourceLocale,
      targetLocale,
      payload,
    )

    const translatedAdminTitle = source.adminTitle
      ? (await translateText([source.adminTitle], sourceLocale, targetLocale, payload))[0]
      : undefined

    const timestamp = Date.now().toString().slice(-6)
    const slug = source.slug ? `${source.slug}-${targetLocale}-${timestamp}` : undefined

    const newChapter = await payload.create({
      collection: 'chapters',
      draft: false,
      data: {
        tenant: typeof source.tenant === 'string' ? source.tenant : source.tenant.id,
        course: targetCourseId,
        chapterLabel: source.chapterLabel,
        title: translatedTitle,
        adminTitle: translatedAdminTitle,
        description: source.description ?? undefined,
        order: source.order,
        status: 'published',
        isActive: true,
        locale: targetLocale,
        translatedFrom: chapterId,
        slug,
      },
    })

    reqLogger.info({ newChapterId: newChapter.id }, 'Chapter shell created')

    // Translate all child lessons
    const lessons = await payload.find({
      collection: 'lessons',
      where: { chapter: { equals: chapterId } },
      sort: 'order',
      limit: 500,
      overrideAccess: true,
    })

    reqLogger.info({ lessonCount: lessons.docs.length }, 'Translating child lessons')

    const translatedLessons: Array<{ sourceId: string; newId: string; title: string }> = []

    for (const lesson of lessons.docs) {
      const result = await handleLessonTranslation(
        req,
        {
          lessonId: lesson.id,
          targetLocale,
          targetChapterId: newChapter.id,
          includeExercises: true,
          promptId,
        },
        reqLogger,
      )

      const body = await result.json()

      if (body.success) {
        translatedLessons.push({
          sourceId: lesson.id,
          newId: body.data.lessonId,
          title: body.data.title,
        })
      } else {
        reqLogger.warn(
          { lessonId: lesson.id, error: body.error },
          'Lesson translation failed, continuing with next',
        )
      }
    }

    reqLogger.info(
      {
        newChapterId: newChapter.id,
        translatedCount: translatedLessons.length,
      },
      'Chapter translation complete',
    )

    return Response.json({
      success: true,
      data: {
        chapterId: newChapter.id,
        title: translatedTitle,
        lessons: translatedLessons,
      },
    })
  } catch (error) {
    reqLogger.error({ err: error, chapterId }, 'Chapter translation threw unexpected error')
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected error during chapter translation',
      },
      { status: 500 },
    )
  }
}
