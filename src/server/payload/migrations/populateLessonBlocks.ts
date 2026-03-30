/**
 * @fileType utility
 * @domain lessons
 * @pattern migration
 * @ai-summary One-time migration to populate lesson blocks from existing exercises and content pages
 */

import type { Payload } from 'payload'

interface BlockEntry {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string
  contentPage?: string
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      /* ignore */
    }
  }
  return []
}

export async function populateLessonBlocks(
  payload: Payload,
): Promise<{ lessonsUpdated: number; blocksAdded: number; errors: number }> {
  let lessonsUpdated = 0
  let blocksAdded = 0
  let errors = 0

  // Build a map: lessonId -> blocks to add
  const lessonBlocksMap = new Map<string, BlockEntry[]>()

  // 1. Fetch all exercises (sorted by order field, then creation date)
  let page = 1
  let hasMore = true
  while (hasMore) {
    const result = await payload.find({
      collection: 'exercises',
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      sort: 'order',
    })
    for (const exercise of result.docs) {
      const lessonId =
        typeof exercise.lesson === 'string'
          ? exercise.lesson
          : (exercise.lesson as { id?: string })?.id
      if (!lessonId) continue
      const existing = lessonBlocksMap.get(lessonId) || []
      existing.push({
        id: generateBlockId(),
        blockType: 'exerciseRef',
        exercise: exercise.id,
      })
      lessonBlocksMap.set(lessonId, existing)
    }
    hasMore = result.hasNextPage
    page++
  }

  // 2. Fetch all content pages (appended after exercises, sorted by creation date)
  page = 1
  hasMore = true
  while (hasMore) {
    const result = await payload.find({
      collection: 'content-pages',
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })
    for (const cp of result.docs) {
      const lessonId =
        typeof cp.lesson === 'string' ? cp.lesson : (cp.lesson as { id?: string })?.id
      if (!lessonId) continue
      const existing = lessonBlocksMap.get(lessonId) || []
      existing.push({
        id: generateBlockId(),
        blockType: 'contentPageRef',
        contentPage: cp.id,
      })
      lessonBlocksMap.set(lessonId, existing)
    }
    hasMore = result.hasNextPage
    page++
  }

  // 3. For each lesson, merge new blocks (skip duplicates, append missing at end)
  for (const [lessonId, newBlocks] of lessonBlocksMap) {
    try {
      const lesson = await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 0,
        overrideAccess: true,
      })

      const existingBlocks = parseBlocks(lesson.blocks)

      // Build set of existing ref IDs
      const existingRefs = new Set<string>()
      for (const b of existingBlocks) {
        if (b.blockType === 'exerciseRef' && b.exercise) existingRefs.add(`exercise:${b.exercise}`)
        if (b.blockType === 'contentPageRef' && b.contentPage)
          existingRefs.add(`contentPage:${b.contentPage}`)
      }

      // Only add blocks that don't already exist
      const toAdd = newBlocks.filter((b) => {
        const key =
          b.blockType === 'exerciseRef' ? `exercise:${b.exercise}` : `contentPage:${b.contentPage}`
        return !existingRefs.has(key)
      })

      if (toAdd.length === 0) continue

      const merged = [...existingBlocks, ...toAdd]
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { blocks: JSON.stringify(merged) },
        overrideAccess: true,
        context: { _skipBlockSync: true },
      })

      lessonsUpdated++
      blocksAdded += toAdd.length
    } catch {
      errors++
      payload.logger?.warn(`[populateLessonBlocks] Failed to populate blocks for lesson ${lessonId}`)
    }
  }

  return { lessonsUpdated, blocksAdded, errors }
}

export async function runPopulateLessonBlocksOnInit(payload: Payload): Promise<void> {
  const { lessonsUpdated, blocksAdded, errors } = await populateLessonBlocks(payload)
  if (lessonsUpdated > 0 || errors > 0) {
    payload.logger?.info(
      `[populateLessonBlocks] Updated ${lessonsUpdated} lessons, added ${blocksAdded} blocks (${errors} errors)`,
    )
  }
}
