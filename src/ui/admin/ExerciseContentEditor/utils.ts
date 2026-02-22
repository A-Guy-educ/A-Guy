/**
 * Utilities for flat block list (no containers, no hierarchy)
 */

import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

export const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'b-' + Math.random().toString(36).substr(2, 9)
}

/**
 * Deep clone a block with new IDs
 * Recursively regenerates IDs for the block and all nested structures
 * (MCQ options, table answer keys, etc.)
 */
export function deepCloneBlock(block: ContentBlock): ContentBlock {
  // Parse and stringify for deep copy
  const cloned = JSON.parse(JSON.stringify(block)) as ContentBlock

  // Regenerate block ID
  cloned.id = generateId()

  // Regenerate nested IDs based on block type
  if (cloned.type === 'question_select' && cloned.variant === 'mcq') {
    // Regenerate MCQ option IDs and update correctOptionIds mapping
    const oldToNewIdMap = new Map<string, string>()

    if (cloned.answer?.options) {
      cloned.answer.options = cloned.answer.options.map((option) => {
        const newId = generateId()
        oldToNewIdMap.set(option.id, newId)
        return { ...option, id: newId }
      })
    }

    // Update correctOptionIds to use new IDs
    if (cloned.answer?.correctOptionIds) {
      cloned.answer.correctOptionIds = cloned.answer.correctOptionIds.map(
        (oldId) => oldToNewIdMap.get(oldId) || oldId,
      )
    }
  } else if (cloned.type === 'question_table') {
    // For table blocks, we don't need to regenerate answer keys
    // since they're position-based (e.g., "0-1" for row 0, col 1)
    // The answer keys remain valid for the cloned table structure
  } else if (cloned.type === 'question_matching') {
    const oldToNewLeft = new Map<string, string>()
    const oldToNewRight = new Map<string, string>()

    cloned.leftColumn = cloned.leftColumn.map((opt) => {
      const newId = generateId()
      oldToNewLeft.set(opt.id, newId)
      return { ...opt, id: newId }
    })
    cloned.rightColumn = cloned.rightColumn.map((opt) => {
      const newId = generateId()
      oldToNewRight.set(opt.id, newId)
      return { ...opt, id: newId }
    })
    cloned.correctPairs = cloned.correctPairs.map((pair) => ({
      optionId: oldToNewLeft.get(pair.optionId) || pair.optionId,
      matchId: oldToNewRight.get(pair.matchId) || pair.matchId,
    }))
  }

  return cloned
}
