import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { ContentPage, Exercise } from '@/payload-types'

export type LessonBlockExercise = {
  blockType: 'exerciseRef'
  exercise: Exercise
}

export type LessonBlockContentPage = {
  blockType: 'contentPageRef'
  contentPage: ContentPage
}

export type LessonBlock = LessonBlockExercise | LessonBlockContentPage

/**
 * Resolve a lesson's blocks array into ordered, populated content.
 * Batch-resolves all referenced exercises and content pages to avoid N+1 queries.
 */
export const queryLessonBlocks = cache(
  async ({ lessonId }: { lessonId: string }): Promise<LessonBlock[]> => {
    const payload = await getPayload({ config: configPromise })

    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
    })

    const blocks = lesson.blocks
    if (!blocks || blocks.length === 0) return []

    // Collect IDs to batch-fetch
    const exerciseIds: string[] = []
    const contentPageIds: string[] = []

    for (const block of blocks) {
      if (block.blockType === 'exerciseRef') {
        const id = typeof block.exercise === 'string' ? block.exercise : block.exercise?.id
        if (id) exerciseIds.push(id)
      } else if (block.blockType === 'contentPageRef') {
        const id = typeof block.contentPage === 'string' ? block.contentPage : block.contentPage?.id
        if (id) contentPageIds.push(id)
      }
    }

    // Batch-fetch exercises and content pages in parallel
    const [exercises, contentPages] = await Promise.all([
      exerciseIds.length > 0
        ? payload
            .find({
              collection: 'exercises',
              where: { id: { in: exerciseIds } },
              limit: exerciseIds.length,
              pagination: false,
              depth: 1,
            })
            .then((r) => r.docs)
        : Promise.resolve([]),
      contentPageIds.length > 0
        ? payload
            .find({
              collection: 'content-pages',
              where: { id: { in: contentPageIds } },
              limit: contentPageIds.length,
              pagination: false,
              depth: 1,
            })
            .then((r) => r.docs)
        : Promise.resolve([]),
    ])

    const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
    const contentPageMap = new Map(contentPages.map((cp) => [cp.id, cp]))

    // Reassemble in order
    const resolved: LessonBlock[] = []

    for (const block of blocks) {
      if (block.blockType === 'exerciseRef') {
        const id = typeof block.exercise === 'string' ? block.exercise : block.exercise?.id
        const exercise = id ? exerciseMap.get(id) : undefined
        if (exercise) {
          resolved.push({ blockType: 'exerciseRef', exercise })
        }
      } else if (block.blockType === 'contentPageRef') {
        const id = typeof block.contentPage === 'string' ? block.contentPage : block.contentPage?.id
        const contentPage = id ? contentPageMap.get(id) : undefined
        if (contentPage) {
          resolved.push({ blockType: 'contentPageRef', contentPage })
        }
      }
    }

    return resolved
  },
)

/**
 * Check if a content page slug belongs to a lesson's blocks array.
 */
export const isContentPageInLesson = cache(
  async ({ lessonId, pageSlug }: { lessonId: string; pageSlug: string }): Promise<boolean> => {
    const blocks = await queryLessonBlocks({ lessonId })
    return blocks.some((b) => b.blockType === 'contentPageRef' && b.contentPage.slug === pageSlug)
  },
)
