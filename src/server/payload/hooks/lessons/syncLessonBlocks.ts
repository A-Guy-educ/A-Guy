/**
 * @fileType utility
 * @domain lessons
 * @pattern hook-helper
 * @ai-summary Syncs lesson blocks array when exercises/content pages change
 */

import type { Payload, PayloadRequest } from 'payload'

interface BlockEntry {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string
  contentPage?: string
}

/** Parse the blocks textarea field (JSON string or array) into a typed array */
function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      // ignore
    }
  }
  return []
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

/**
 * Add a block reference to a lesson's blocks array (appended at end).
 * No-op if a block with the same ref ID already exists.
 */
export async function addBlockToLesson({
  payload,
  req,
  lessonId,
  refId,
  blockType,
}: {
  payload: Payload
  req: PayloadRequest
  lessonId: string
  refId: string
  blockType: 'exerciseRef' | 'contentPageRef'
}): Promise<void> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const blocks = parseBlocks(lesson.blocks)
  const refField = blockType === 'exerciseRef' ? 'exercise' : 'contentPage'

  // Check if already present
  const exists = blocks.some((b) => b.blockType === blockType && b[refField] === refId)
  if (exists) return

  const newBlock: BlockEntry = {
    id: generateBlockId(),
    blockType,
    [refField]: refId,
  }

  const updated = [...blocks, newBlock]

  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: JSON.stringify(updated) },
    overrideAccess: true,
    req,
    context: { _skipBlockSync: true },
  })
}

/**
 * Remove a block reference from a lesson's blocks array.
 */
export async function removeBlockFromLesson({
  payload,
  req,
  lessonId,
  refId,
  blockType,
}: {
  payload: Payload
  req: PayloadRequest
  lessonId: string
  refId: string
  blockType: 'exerciseRef' | 'contentPageRef'
}): Promise<void> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const blocks = parseBlocks(lesson.blocks)
  const refField = blockType === 'exerciseRef' ? 'exercise' : 'contentPage'
  const filtered = blocks.filter((b) => !(b.blockType === blockType && b[refField] === refId))

  if (filtered.length === blocks.length) return // nothing to remove

  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: JSON.stringify(filtered) },
    overrideAccess: true,
    req,
    context: { _skipBlockSync: true },
  })
}
