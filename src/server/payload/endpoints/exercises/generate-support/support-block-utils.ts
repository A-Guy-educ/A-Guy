/**
 * Utility functions for support generation block operations
 */
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { GeneratedSupport } from '@/infra/llm/services/support-generation-service'

const QUESTION_BLOCK_TYPES = [
  'question_select',
  'question_free_response',
  'question_table',
  'question_matching',
  'question_geometry',
  'question_axis',
  'svg',
]

export function isQuestionBlock(block: ContentBlock): boolean {
  return QUESTION_BLOCK_TYPES.includes(block.type)
}

export function hasExistingSupport(block: ContentBlock): boolean {
  if (!('hint' in block)) return false
  const b = block as ContentBlock & {
    hint?: InlineRichText
    solution?: InlineRichText
    fullSolution?: InlineRichText
  }
  return Boolean(b.hint?.value || b.solution?.value || b.fullSolution?.value)
}

export function createInlineRichText(value: string): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

export function applyGeneratedSupport(
  block: ContentBlock,
  generated: GeneratedSupport,
  overwrite: boolean,
): ContentBlock {
  const updated = { ...block } as ContentBlock & {
    hint?: InlineRichText
    solution?: InlineRichText
    fullSolution?: InlineRichText
  }

  if (generated.hints && generated.hints.length > 0) {
    const hintText = generated.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')
    if (overwrite || !updated.hint?.value) {
      updated.hint = createInlineRichText(hintText)
    }
  }

  if (generated.solution) {
    if (overwrite || !updated.solution?.value) {
      updated.solution = createInlineRichText(generated.solution)
    }
  }

  if (generated.fullSolution) {
    if (overwrite || !updated.fullSolution?.value) {
      updated.fullSolution = createInlineRichText(generated.fullSolution)
    }
  }

  return updated as ContentBlock
}
