/**
 * Utilities for flat block list (no containers, no hierarchy)
 */

import type {
  ContentBlock,
  ContentSlot,
  InlineRichText,
  RichContent,
} from '@/server/payload/collections/Exercises/types'

export const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'b-' + Math.random().toString(36).substr(2, 9)
}

// Type guard for ContentSlot (inline to avoid circular dependency)
function isContentSlotValue(value: unknown): value is ContentSlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    (value as ContentSlot).version === 2 &&
    'items' in value &&
    Array.isArray((value as ContentSlot).items)
  )
}

/**
 * Deep clone a ContentSlot with new item IDs
 */
export function deepCloneContentSlot(slot: ContentSlot): ContentSlot {
  return {
    version: 2,
    items: slot.items.map((item) => ({
      id: generateId(),
      data: JSON.parse(JSON.stringify(item.data)),
    })),
  }
}

/**
 * Deep clone a RichContent value (handles both v1 InlineRichText and v2 ContentSlot)
 */
function deepCloneRichContent(content: RichContent): RichContent {
  if (isContentSlotValue(content)) {
    return deepCloneContentSlot(content)
  }
  // InlineRichText (v1) - clone and regenerate IDs for nested structures if any
  return JSON.parse(JSON.stringify(content)) as InlineRichText
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

  // Clone RichContent fields (prompt, hint, solution, fullSolution, etc.)
  // These can be either InlineRichText (v1) or ContentSlot (v2)
  // Use unknown intermediate to avoid union type indexing issues
  const unknownBlock = cloned as unknown as Record<string, RichContent | undefined>

  const richContentFields = ['prompt', 'hint', 'solution', 'fullSolution'] as const

  for (const fieldName of richContentFields) {
    const content = unknownBlock[fieldName]
    if (content) {
      unknownBlock[fieldName] = deepCloneRichContent(content)
    }
  }

  // Regenerate nested IDs based on block type
  if (cloned.type === 'question_select' && cloned.variant === 'mcq') {
    // Regenerate MCQ option IDs and update correctOptionIds mapping
    const oldToNewIdMap = new Map<string, string>()

    if (cloned.answer?.options) {
      cloned.answer.options = cloned.answer.options.map((option) => {
        const newId = generateId()
        oldToNewIdMap.set(option.id, newId)
        return { ...option, id: newId, content: deepCloneRichContent(option.content) }
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
      return { ...opt, id: newId, content: deepCloneRichContent(opt.content) }
    })
    cloned.rightColumn = cloned.rightColumn.map((opt) => {
      const newId = generateId()
      oldToNewRight.set(opt.id, newId)
      return { ...opt, id: newId, content: deepCloneRichContent(opt.content) }
    })
    cloned.correctPairs = cloned.correctPairs.map((pair) => ({
      optionId: oldToNewLeft.get(pair.optionId) || pair.optionId,
      matchId: oldToNewRight.get(pair.matchId) || pair.matchId,
    }))
  } else if (cloned.type === 'question_select' && cloned.variant === 'true_false') {
    // Clone True/False option labels
    cloned.options = cloned.options.map((opt) => ({
      ...opt,
      label: deepCloneRichContent(opt.label),
    }))
  } else if (cloned.type === 'svg') {
    // Clone SVG caption if present
    if (cloned.caption) {
      cloned.caption = deepCloneRichContent(cloned.caption)
    }
  } else if (cloned.type === 'question_axis' || cloned.type === 'question_geometry') {
    // Clone prompt for axis/geometry blocks (already handled above, but ensure)
    // Graph specs don't need ID regeneration (they use internal IDs)
  } else if (cloned.type === 'question_multi_axis') {
    // Clone prompt if present
    if (cloned.prompt) {
      cloned.prompt = deepCloneRichContent(cloned.prompt)
    }
  }

  return cloned
}
