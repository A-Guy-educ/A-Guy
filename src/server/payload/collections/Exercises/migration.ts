/**
 * Exercise Migration (v1 InlineRichText → v2 ContentSlot)
 *
 * This module provides migration utilities to convert exercises from
 * InlineRichText (v1) format to ContentSlot (v2) format.
 */

import { ContentSchema } from './schemas'
import {
  type ContentBlock,
  type ContentData,
  type RichContent,
  inlineRichTextToSlot,
  isInlineRichText,
} from './types'

/**
 * Convert a RichContent field from v1 to v2 if it is InlineRichText
 * Returns the same value if already ContentSlot (idempotent)
 */
function migrateRichContentField(field: RichContent): RichContent {
  if (isInlineRichText(field)) {
    return inlineRichTextToSlot(field)
  }
  // Already v2 ContentSlot - return as-is
  return field
}

/**
 * Convert an optional RichContent field from v1 to v2 if present
 */
function migrateOptionalRichContentField(field: RichContent | undefined): RichContent | undefined {
  if (field === undefined) return undefined
  return migrateRichContentField(field)
}

/**
 * Migrate a QuestionSelectTrueFalseBlock from v1 to v2
 */
function migrateTrueFalseBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_select' || block.variant !== 'true_false') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    options: block.options.map((opt) => ({
      ...opt,
      label: migrateRichContentField(opt.label),
    })),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionSelectMcqBlock from v1 to v2
 */
function migrateMcqBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_select' || block.variant !== 'mcq') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    answer: {
      ...block.answer,
      options: block.answer.options.map((opt) => ({
        ...opt,
        content: migrateRichContentField(opt.content),
      })),
    },
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionFreeResponseBlock from v1 to v2
 */
function migrateFreeResponseBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_free_response') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionTableBlock from v1 to v2
 */
function migrateTableBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_table') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionMatchingBlock from v1 to v2
 */
function migrateMatchingBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_matching') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    leftColumn: block.leftColumn.map((opt) => ({
      ...opt,
      content: migrateRichContentField(opt.content),
    })),
    rightColumn: block.rightColumn.map((opt) => ({
      ...opt,
      content: migrateRichContentField(opt.content),
    })),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate an SvgBlock from v1 to v2
 */
function migrateSvgBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'svg') {
    return block
  }

  return {
    ...block,
    caption: migrateOptionalRichContentField(block.caption),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionGeometryBlock from v1 to v2
 */
function migrateGeometryBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_geometry') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionAxisBlock from v1 to v2
 */
function migrateAxisBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_axis') {
    return block
  }

  return {
    ...block,
    prompt: migrateRichContentField(block.prompt),
    hint: migrateOptionalRichContentField(block.hint),
    solution: migrateOptionalRichContentField(block.solution),
    fullSolution: migrateOptionalRichContentField(block.fullSolution),
  }
}

/**
 * Migrate a QuestionMultiAxisBlock from v1 to v2
 */
function migrateMultiAxisBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'question_multi_axis') {
    return block
  }

  return {
    ...block,
    prompt: migrateOptionalRichContentField(block.prompt),
  }
}

/**
 * Migrate a single ContentBlock from v1 to v2
 * Returns the block unchanged if it's not a question block or is already migrated
 */
function migrateBlock(block: ContentBlock): ContentBlock {
  // Use discriminated union to identify block type
  switch (block.type) {
    case 'question_select':
      if (block.variant === 'true_false') {
        return migrateTrueFalseBlock(block)
      }
      return migrateMcqBlock(block)

    case 'question_free_response':
      return migrateFreeResponseBlock(block)

    case 'question_table':
      return migrateTableBlock(block)

    case 'question_matching':
      return migrateMatchingBlock(block)

    case 'svg':
      return migrateSvgBlock(block)

    case 'question_geometry':
      return migrateGeometryBlock(block)

    case 'question_axis':
      return migrateAxisBlock(block)

    case 'question_multi_axis':
      return migrateMultiAxisBlock(block)

    case 'rich_text':
    case 'latex':
    case 'html':
    case 'media':
      // These block types don't have RichContent fields to migrate
      return block

    default:
      // Unknown block type - return as-is
      return block
  }
}

/**
 * Migrate exercise content from v1 (InlineRichText) to v2 (ContentSlot)
 *
 * This function is idempotent - running it twice on the same exercise
 * should produce identical output.
 *
 * @param content - The exercise content in v1 format
 * @returns The migrated content in v2 format
 * @throws Error if the migrated content fails schema validation
 */
export function migrateExerciseToV2(content: ContentData): ContentData {
  // Migrate all blocks
  const migratedBlocks = content.blocks.map(migrateBlock)

  const migratedContent: ContentData = {
    blocks: migratedBlocks,
  }

  // Validate output against schema
  const validationResult = ContentSchema.safeParse(migratedContent)
  if (!validationResult.success) {
    const errors = validationResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new Error(`Migration validation failed: ${errors.join('; ')}`)
  }

  return migratedContent
}

/**
 * Check if content contains any v1 InlineRichText fields
 * Useful for determining if migration is needed
 */
export function hasV1Content(content: ContentData): boolean {
  for (const block of content.blocks) {
    if (block.type === 'question_select') {
      // Check prompt
      if (isInlineRichText(block.prompt)) return true

      // Check options - use variant-specific access
      if (block.variant === 'true_false') {
        for (const opt of block.options) {
          if (isInlineRichText(opt.label)) return true
        }
      } else if (block.variant === 'mcq') {
        for (const opt of block.answer.options) {
          if (isInlineRichText(opt.content)) return true
        }
      }

      // Check hints/solutions
      if (block.hint && isInlineRichText(block.hint)) return true
      if (block.solution && isInlineRichText(block.solution)) return true
      if (block.fullSolution && isInlineRichText(block.fullSolution)) return true
    }

    if (block.type === 'question_free_response' || block.type === 'question_table') {
      if (isInlineRichText(block.prompt)) return true
      if (block.hint && isInlineRichText(block.hint)) return true
      if (block.solution && isInlineRichText(block.solution)) return true
      if (block.fullSolution && isInlineRichText(block.fullSolution)) return true
    }

    if (block.type === 'question_matching') {
      if (isInlineRichText(block.prompt)) return true
      for (const opt of block.leftColumn) {
        if (isInlineRichText(opt.content)) return true
      }
      for (const opt of block.rightColumn) {
        if (isInlineRichText(opt.content)) return true
      }
      if (block.hint && isInlineRichText(block.hint)) return true
      if (block.solution && isInlineRichText(block.solution)) return true
      if (block.fullSolution && isInlineRichText(block.fullSolution)) return true
    }

    if (block.type === 'svg') {
      if (block.caption && isInlineRichText(block.caption)) return true
      if (block.hint && isInlineRichText(block.hint)) return true
      if (block.solution && isInlineRichText(block.solution)) return true
      if (block.fullSolution && isInlineRichText(block.fullSolution)) return true
    }

    if (block.type === 'question_geometry' || block.type === 'question_axis') {
      if (isInlineRichText(block.prompt)) return true
      if (block.hint && isInlineRichText(block.hint)) return true
      if (block.solution && isInlineRichText(block.solution)) return true
      if (block.fullSolution && isInlineRichText(block.fullSolution)) return true
    }

    if (block.type === 'question_multi_axis') {
      if (block.prompt && isInlineRichText(block.prompt)) return true
    }
  }

  return false
}
