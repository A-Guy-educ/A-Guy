/**
 * Phase 3: Course-level translation
 *
 * Creates a parallel course structure in the target language.
 * Cascades: Course → Chapters → Lessons → Exercises.
 */
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { formatSlug } from '@/server/payload/fields/formatSlug'
import { translateText } from '@/infra/llm/services/content-translation-service'
import { handleLessonTranslation } from './handle-lesson-translation'

interface CourseTranslationInput {
  courseId: string
  targetLocale: ContentLocale
}

export async function handleCourseTranslation(
  req: PayloadRequest,
  input: CourseTranslationInput,
  reqLogger: Logger,
) {
  const { payload } = req
  const { courseId, targetLocale } = input

  try {
    reqLogger.info({ courseId, targetLocale }, 'Starting course translation')

    const source = await payload.findByID({
      collection: 'courses',
      id: courseId,
      overrideAccess: true,
    })

    if (!source) {
      return Response.json({ success: false, error: 'Course not found' }, { status: 404 })
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

    const newCourse = await payload.create({
      collection: 'courses',
      draft: false,
      data: {
        tenant: typeof source.tenant === 'string' ? source.tenant : source.tenant.id,
        locale: targetLocale,
        courseLabel: source.courseLabel,
        title: translatedTitle,
        description: source.description ?? undefined,
        order: source.order,
        status: 'published',
        isActive: true,
        pageAccessType: source.pageAccessType,
        accessType: source.accessType,
        categories: Array.isArray(source.categories)
          ? source.categories.map((c: unknown) =>
              typeof c === 'string' ? c : (c as { id: string }).id,
            )
          : [],
        slug: source.slug
          ? `${formatSlug(source.slug)}-${targetLocale}-${Date.now().toString().slice(-6)}`
          : undefined,
        contentStatus: 'none',
        contentStatusVisible: false,
        translatedFrom: courseId,
      },
    })

    reqLogger.info({ newCourseId: newCourse.id }, 'Course shell created')

    const chapters = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      sort: 'order',
      limit: 500,
      overrideAccess: true,
    })

    const translatedChapters: Array<{
      sourceId: string
      newId: string
      lessons: unknown[]
    }> = []

    for (const chapter of chapters.docs) {
      const newChapter = await payload.create({
        collection: 'chapters',
        draft: false,
        data: {
          tenant: typeof chapter.tenant === 'string' ? chapter.tenant : chapter.tenant.id,
          course: newCourse.id,
          chapterLabel: chapter.chapterLabel ?? undefined,
          title: (await translateText([chapter.title], sourceLocale, targetLocale, payload))[0],
          description: chapter.description ?? undefined,
          order: chapter.order,
          status: 'published',
          isActive: true,
          locale: targetLocale,
          translatedFrom: chapter.id,
          slug: chapter.slug
            ? `${chapter.slug}-${targetLocale}-${Date.now().toString().slice(-6)}`
            : undefined,
        },
      })

      const lessons = await payload.find({
        collection: 'lessons',
        where: { chapter: { equals: chapter.id } },
        sort: 'order',
        limit: 500,
        overrideAccess: true,
      })

      const lessonResults: unknown[] = []

      for (const lesson of lessons.docs) {
        const result = await handleLessonTranslation(
          req,
          {
            lessonId: lesson.id,
            targetLocale,
            targetChapterId: newChapter.id,
            includeExercises: true,
          },
          reqLogger,
        )
        const body = await result.json()
        lessonResults.push(body.data ?? { error: body.error })
      }

      translatedChapters.push({
        sourceId: chapter.id,
        newId: newChapter.id,
        lessons: lessonResults,
      })
    }

    reqLogger.info(
      {
        newCourseId: newCourse.id,
        chapterCount: translatedChapters.length,
      },
      'Course translation complete',
    )

    return Response.json({
      success: true,
      data: {
        courseId: newCourse.id,
        title: translatedTitle,
        chapters: translatedChapters,
      },
    })
  } catch (error) {
    reqLogger.error({ err: error, courseId }, 'Course translation threw unexpected error')
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected error during course translation',
      },
      { status: 500 },
    )
  }
}
