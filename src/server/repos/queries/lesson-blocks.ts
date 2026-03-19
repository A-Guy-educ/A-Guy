import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Exercise, ContentPage } from '@/payload-types'

export type ResolvedExerciseBlock = {
  type: 'exercise'
  data: Exercise
}

export type ResolvedContentPageBlock = {
  type: 'contentPage'
  data: ContentPage
}

export type ResolvedLessonBlock = ResolvedExerciseBlock | ResolvedContentPageBlock

/**
 * Resolves a lesson's blocks array into ordered content.
 * Batch-fetches all referenced exercises and content pages to prevent N+1 queries.
 * Returns blocks in the exact order defined by the lesson's blocks array.
 */
export const queryLessonBlocks = cache(
  async ({ lessonId }: { lessonId: string }): Promise<ResolvedLessonBlock[]> => {
    const payload = await getPayload({ config: configPromise })

    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: false,
    })

    if (!lesson?.blocks || !Array.isArray(lesson.blocks) || lesson.blocks.length === 0) {
      return []
    }

    // Collect IDs by type
    const exerciseIds: string[] = []
    const contentPageIds: string[] = []

    for (const block of lesson.blocks) {
      if (block.blockType === 'exerciseRef' && block.exercise) {
        const id = typeof block.exercise === 'string' ? block.exercise : block.exercise.id
        exerciseIds.push(id)
      } else if (block.blockType === 'contentPageRef' && block.contentPage) {
        const id = typeof block.contentPage === 'string' ? block.contentPage : block.contentPage.id
        contentPageIds.push(id)
      }
    }

    // Batch-fetch in parallel
    const [exercisesResult, contentPagesResult] = await Promise.all([
      exerciseIds.length > 0
        ? payload.find({
            collection: 'exercises',
            where: { id: { in: exerciseIds } },
            limit: exerciseIds.length,
            pagination: false,
            depth: 1,
            overrideAccess: false,
          })
        : null,
      contentPageIds.length > 0
        ? payload.find({
            collection: 'content-pages',
            where: {
              and: [
                { id: { in: contentPageIds } },
                { status: { equals: 'published' } },
                { isActive: { equals: true } },
              ],
            },
            limit: contentPageIds.length,
            pagination: false,
            depth: 1,
            overrideAccess: false,
          })
        : null,
    ])

    // Build lookup maps
    const exerciseMap = new Map<string, Exercise>()
    if (exercisesResult) {
      for (const doc of exercisesResult.docs) {
        exerciseMap.set(doc.id, doc)
      }
    }

    const contentPageMap = new Map<string, ContentPage>()
    if (contentPagesResult) {
      for (const doc of contentPagesResult.docs) {
        contentPageMap.set(doc.id, doc)
      }
    }

    // Resolve in order, skip missing references
    const resolved: ResolvedLessonBlock[] = []

    for (const block of lesson.blocks) {
      if (block.blockType === 'exerciseRef' && block.exercise) {
        const id = typeof block.exercise === 'string' ? block.exercise : block.exercise.id
        const exercise = exerciseMap.get(id)
        if (exercise) {
          resolved.push({ type: 'exercise', data: exercise })
        }
      } else if (block.blockType === 'contentPageRef' && block.contentPage) {
        const id = typeof block.contentPage === 'string' ? block.contentPage : block.contentPage.id
        const contentPage = contentPageMap.get(id)
        if (contentPage) {
          resolved.push({ type: 'contentPage', data: contentPage })
        }
      }
    }

    return resolved
  },
)
