/**
 * Exercise Context Formatting Utility
 *
 * Formats exercise content into a readable message for the LLM.
 * - Strips solutions and correct answers (prevent leakage)
 * - Includes hints (helps LLM guide student)
 * - Caps output at 2000 characters
 */

import type {
  LatexBlock,
  QuestionAxisBlock,
  QuestionFreeResponseBlock,
  QuestionGeometryBlock,
  QuestionMatchingBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionTableBlock,
  RichTextBlock,
  SvgBlock,
} from '@/server/payload/collections/Exercises/types'

export interface MediaItem {
  id: string
  url?: string | null
  filename?: string
  mimeType?: string
  altText?: string
}

const MAX_OUTPUT_LENGTH = 2000
const TRUNCATE_SUFFIX = '...'

/**
 * Format exercise content blocks into a readable message for the LLM.
 */
export function formatExerciseContextMessage(
  exerciseTitle: string,
  blocks: Array<{
    id: string
    type: string
    [key: string]: unknown
  }>,
  mediaMap?: Record<string, MediaItem>,
): string {
  const parts: string[] = []

  // Header
  parts.push('[EXERCISE CONTEXT]')
  parts.push(`Exercise: "${exerciseTitle}"`)
  parts.push('')
  parts.push('Content Blocks:')
  parts.push('')

  // Format each block
  let currentLength = parts.join('\n').length
  let blockIndex = 0

  for (const block of blocks) {
    // Check if we're at the limit
    const remaining = MAX_OUTPUT_LENGTH - currentLength
    if (remaining < 50) {
      break
    }

    blockIndex++
    const line = formatBlock(block, blockIndex, mediaMap, remaining)

    if (line) {
      parts.push(line)
      currentLength += line.length + 1 // +1 for newline
    }
  }

  // Footer
  parts.push('')
  parts.push('[END EXERCISE CONTEXT]')

  const result = parts.join('\n')
  return result.length > MAX_OUTPUT_LENGTH
    ? result.substring(0, MAX_OUTPUT_LENGTH - TRUNCATE_SUFFIX.length) + TRUNCATE_SUFFIX
    : result
}

/**
 * Format a single content block into a readable line.
 */
function formatBlock(
  block: {
    id: string
    type: string
    [key: string]: unknown
  },
  index: number,
  mediaMap?: Record<string, MediaItem>,
  maxLength?: number,
): string | null {
  switch (block.type) {
    case 'rich_text':
      return formatRichTextBlock(block as unknown as RichTextBlock, index, maxLength)

    case 'question_select':
      if ((block as unknown as QuestionSelectTrueFalseBlock).variant === 'true_false') {
        return formatTrueFalseBlock(block as unknown as QuestionSelectTrueFalseBlock, index)
      }
      return formatMcqBlock(block as unknown as QuestionSelectMcqBlock, index)

    case 'question_free_response':
      return formatFreeResponseBlock(block as unknown as QuestionFreeResponseBlock, index)

    case 'question_table':
      return formatTableBlock(block as unknown as QuestionTableBlock, index)

    case 'latex':
      return formatLatexBlock(block as unknown as LatexBlock, index)

    case 'question_matching':
      return formatMatchingBlock(block as unknown as QuestionMatchingBlock, index)

    case 'svg':
      return formatSvgBlock(block as unknown as SvgBlock, index)

    case 'question_geometry':
      return formatGeometryBlock(block as unknown as QuestionGeometryBlock, index)

    case 'question_axis':
      return formatAxisBlock(block as unknown as QuestionAxisBlock, index)

    default:
      return `${index}. [${block.type}]`
  }
}

function formatRichTextBlock(block: RichTextBlock, index: number, maxLength?: number): string {
  const preview = truncateText(block.value, maxLength ? maxLength - 50 : 150)
  const mediaInfo = block.mediaIds.length > 0 ? ` | Media: ${block.mediaIds.length} item(s)` : ''
  return `${index}. [RichText] ${preview}${mediaInfo}`
}

function formatTrueFalseBlock(block: QuestionSelectTrueFalseBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 100)
  const options = block.options.map((o) => o.label.value).join(', ')
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: True/False] ${prompt} | Options: ${options}${hint}`
}

function formatMcqBlock(block: QuestionSelectMcqBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 100)
  const options = block.answer.options.map((o) => truncateText(o.content.value, 30)).join(', ')
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: MCQ] ${prompt} | Options: ${options}${hint}`
}

function formatFreeResponseBlock(block: QuestionFreeResponseBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 100)
  const answerCount = block.answer.acceptedAnswers.length
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: FreeResponse] ${prompt} | Accepted: ${answerCount} answer(s)${hint}`
}

function formatTableBlock(block: QuestionTableBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 80)
  const rows = block.table.rowsData.length
  const cols = block.table.headers.length
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: Table] ${prompt} | ${cols} columns × ${rows} rows${hint}`
}

function formatLatexBlock(block: LatexBlock, index: number): string {
  const preview = truncateText(block.latex, 100)
  return `${index}. [LaTeX] ${preview}`
}

function formatMatchingBlock(block: QuestionMatchingBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 80)
  const leftCount = block.leftColumn.length
  const rightCount = block.rightColumn.length
  const pairs = block.correctPairs.length
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: Matching] ${prompt} | ${leftCount} items → ${rightCount} targets | ${pairs} pairs${hint}`
}

function formatSvgBlock(block: SvgBlock, index: number): string {
  const description = block.altText || 'Diagram'
  return `${index}. [SVG] ${description}`
}

function formatGeometryBlock(block: QuestionGeometryBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 100)
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: Geometry] ${prompt}${hint}`
}

function formatAxisBlock(block: QuestionAxisBlock, index: number): string {
  const prompt = truncateText(block.prompt.value, 100)
  const hint = block.hint ? ` | Hint: ${truncateText(block.hint.value, 50)}` : ''
  return `${index}. [Question: Axis] ${prompt}${hint}`
}

/**
 * Truncate text to a maximum length with ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}
