import { generateId } from '@/server/payload/collections/Exercises/types'
import type {
  QuestionSelectMcqBlock,
  InlineRichText,
  McqOption,
} from '@/server/payload/collections/Exercises/types'

function makeInlineRichText(value: string): InlineRichText {
  return { type: 'rich_text', format: 'md-math-v1', value: value.trim(), mediaIds: [] }
}

/**
 * Parses inline MCQ questions where options are listed as (a) ... (b) ... (c) ...
 *
 * Supports both Latin letters (a)(b)(c)(d) and Hebrew letters (א)(ב)(ג)(ד).
 *
 * Pattern:
 *   \item <prompt text>
 *   (a) <option1> \quad (b) <option2> ...
 */
export function parseInlineMcq(text: string): QuestionSelectMcqBlock | null {
  // Find first option marker to split prompt from options
  const firstMarkerIdx = text.search(/\(([a-zA-Z]|[\u05D0-\u05EA])\)(?:\s|\{|[^(])/)
  if (firstMarkerIdx === -1) return null

  const promptPart = text.slice(0, firstMarkerIdx)
  const optionsPart = text.slice(firstMarkerIdx)

  // Extract prompt text - strip \item prefix if present
  const promptText = promptPart
    .replace(/^\\item\s+/, '')
    .replace(/\n/g, ' ')
    .trim()

  if (!promptText) return null

  // Collect content-start positions for each marker
  const markerRegex = /\(([a-zA-Z]|[\u05D0-\u05EA])\)\s*/g
  const markerPositions: number[] = []
  let m: RegExpExecArray | null

  while ((m = markerRegex.exec(optionsPart)) !== null) {
    markerPositions.push(m.index + m[0].length)
  }

  if (markerPositions.length < 2) return null

  const options: McqOption[] = []
  for (let i = 0; i < markerPositions.length; i++) {
    const start = markerPositions[i]

    let rawText: string
    if (i + 1 < markerPositions.length) {
      // Slice up to the start of the next "(letter)" marker (3 chars back from content start)
      const nextMarkerStart = findMarkerStart(optionsPart, markerPositions[i + 1])
      rawText = optionsPart.slice(start, nextMarkerStart)
    } else {
      rawText = optionsPart.slice(start)
    }

    const optionText = rawText.replace(/\\quad\s*/g, '').trim()
    if (optionText) {
      options.push({ id: generateId(), content: makeInlineRichText(optionText) })
    }
  }

  if (options.length < 2) return null

  const block: QuestionSelectMcqBlock = {
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: makeInlineRichText(promptText),
    answer: {
      multiSelect: false,
      options,
      correctOptionIds: [options[0].id],
    },
  }

  return block
}

/** Find the start of the "(letter)" marker given the position where its content begins. */
function findMarkerStart(text: string, contentStart: number): number {
  // marker is: ( letter ) — 3 chars before the content start
  return Math.max(0, contentStart - 3)
}
