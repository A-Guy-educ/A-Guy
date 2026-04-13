/**
 * Exercise Context Injection
 *
 * Serializes an exercise's ContentBlock[] into a text format suitable for
 * LLM injection. Replaces the full lessonContextText with a focused,
 * exercise-specific context when the chat is scoped to an exercise.
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern single-responsibility, runtime-injection
 */
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

import { parseContextText } from '@/lib/context-exercise-parser'

/**
 * Format exercise content blocks into a readable message for client-side context injection.
 * Used by useNotebookChat to send exercise context as a hidden message.
 */
export function formatExerciseContextMessage(
  exerciseTitle: string,
  blocks: Array<{ id: string; type: string; [key: string]: unknown }>,
  _mediaMap?: Record<string, unknown>,
): string {
  const serialized = serializeContentBlocks(blocks as unknown as ContentBlock[])
  const parts = [
    '[EXERCISE CONTEXT]',
    `Exercise: "${exerciseTitle}"`,
    '',
    serialized || '[No content blocks]',
    '',
    '[END EXERCISE CONTEXT]',
  ]
  return parts.join('\n')
}

export const EXERCISE_CONTEXT_BLOCK_START = 'EXERCISE_CONTEXT_START'
export const EXERCISE_CONTEXT_BLOCK_END = 'EXERCISE_CONTEXT_END'
export const EXERCISE_CONTEXT_MAX_CHARS = 50_000 // ~25K tokens
const DEFAULT_PREAMBLE_MAX_CHARS = 2_000

/**
 * Serialize an InlineRichText prompt to plain string.
 */
function inlineToString(
  irt: { type: 'rich_text'; format: string; value: string } | undefined,
): string {
  return irt?.value ?? ''
}

/**
 * Serialize a single ContentBlock into a human-readable text representation.
 *
 * SECURITY: The following fields are intentionally EXCLUDED to prevent answer leakage:
 * - answer (correctOptionIds, acceptedAnswers, correctPairs, etc.)
 * - hint, solution, fullSolution
 * - table.answers, table.solutionFill
 * - correctHotspotIds (SVG)
 * Any new ContentBlock type MUST be reviewed for answer leakage before adding here.
 */
function serializeBlock(block: ContentBlock): string {
  switch (block.type) {
    case 'latex':
      return block.latex

    case 'rich_text':
      return block.value

    case 'question_select': {
      const prompt = inlineToString(block.prompt)
      if (block.variant === 'true_false') {
        return `${prompt}\n(True / False)`
      }
      // MCQ — list options without revealing correct answer
      const options = block.answer.options
        .map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          return `  ${letter}) ${inlineToString(opt.content)}`
        })
        .join('\n')
      return `${prompt}\n${options}`
    }

    case 'question_free_response':
      return inlineToString(block.prompt)

    case 'question_table': {
      const prompt = inlineToString(block.prompt)
      const { headers, rowsData } = block.table
      const headerRow = headers.length > 0 ? `| ${headers.join(' | ')} |` : ''
      const separator = headers.length > 0 ? `| ${headers.map(() => '---').join(' | ')} |` : ''
      const rows = rowsData.map((row) => `| ${row.join(' | ')} |`).join('\n')
      return [prompt, headerRow, separator, rows].filter(Boolean).join('\n')
    }

    case 'question_matching': {
      const prompt = inlineToString(block.prompt)
      const left = block.leftColumn.map((o) => `  - ${inlineToString(o.content)}`).join('\n')
      const right = block.rightColumn.map((o) => `  - ${inlineToString(o.content)}`).join('\n')
      return `${prompt}\nColumn A:\n${left}\nColumn B:\n${right}`
    }

    case 'question_geometry':
      return `${inlineToString(block.prompt)}\n[Geometry diagram]`

    case 'question_axis':
      return `${inlineToString(block.prompt)}\n[Graph diagram]`

    case 'question_multi_axis': {
      const prompt = block.prompt ? inlineToString(block.prompt) : ''
      return `${prompt}\n[Multiple graphs: ${block.graphs.length} diagrams]`.trim()
    }

    case 'svg':
      return block.altText || '[SVG diagram]'

    case 'html':
      return block.html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    case 'media':
      return '[Media attachment]'

    default:
      return ''
  }
}

/**
 * Serialize an exercise's ContentBlock[] into a text representation
 * suitable for LLM context injection.
 *
 * @param blocks - The exercise's content blocks
 * @returns Serialized text, or empty string if no blocks
 */
export function serializeContentBlocks(blocks: ContentBlock[]): string {
  if (!blocks || blocks.length === 0) return ''

  return blocks
    .map((block) => serializeBlock(block))
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Extract the LaTeX preamble (text before the first exercise) from lessonContextText.
 * This typically contains document class, package declarations, and section headers.
 *
 * @param lessonContextText - The full lesson context LaTeX text
 * @param maxChars - Maximum characters to include (default 2000)
 * @returns The preamble text, or empty string if none found
 */
export function extractLessonPreamble(
  lessonContextText: string,
  maxChars: number = DEFAULT_PREAMBLE_MAX_CHARS,
): string {
  if (!lessonContextText?.trim()) return ''

  const segments = parseContextText(lessonContextText)
  if (segments.length === 0 || segments[0].exercises.length === 0) return ''

  const firstExerciseStart = segments[0].exercises[0].startIndex
  if (firstExerciseStart <= 0) return ''

  const preamble = segments[0].originalText.slice(0, firstExerciseStart).trim()
  if (preamble.length <= maxChars) return preamble
  return preamble.slice(0, maxChars) + '\n[... preamble truncated]'
}

/**
 * Build a system prompt with exercise-specific context injected.
 *
 * @param baseSystemPrompt - The base system prompt to enhance
 * @param exerciseTitle - Title of the current exercise
 * @param serializedBlocks - Serialized content blocks text
 * @param preamble - Optional lesson/course preamble for shared context
 * @returns Enhanced system prompt with exercise context
 * @throws Error if the combined context exceeds EXERCISE_CONTEXT_MAX_CHARS
 */
export function buildExerciseContextPrompt(
  baseSystemPrompt: string,
  exerciseTitle: string,
  serializedBlocks: string,
  preamble?: string,
): string {
  if (!serializedBlocks.trim()) return baseSystemPrompt

  const contextParts = [`## Current Exercise: ${exerciseTitle}`, '']

  if (preamble?.trim()) {
    contextParts.push('### Lesson Context')
    contextParts.push(preamble.trim())
    contextParts.push('')
  }

  contextParts.push('### Exercise Content')
  contextParts.push(serializedBlocks.trim())

  const contextBody = contextParts.join('\n')

  if (contextBody.length > EXERCISE_CONTEXT_MAX_CHARS) {
    throw new Error('Exercise context exceeds maximum allowed size')
  }

  return [
    baseSystemPrompt,
    '',
    EXERCISE_CONTEXT_BLOCK_START,
    contextBody,
    EXERCISE_CONTEXT_BLOCK_END,
  ].join('\n')
}
