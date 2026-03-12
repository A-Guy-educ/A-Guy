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
 * Parses exam.cls style MCQ questions.
 *
 * Pattern:
 *   \question <prompt text>
 *   \begin{choices}
 *   \choice <option>
 *   \CorrectChoice <correct option>
 *   \end{choices}
 */
export function parseExamClsMcq(text: string): QuestionSelectMcqBlock | null {
  const questionMatch = /\\question\s+([\s\S]*?)\\begin\{choices\}([\s\S]*?)\\end\{choices\}/m.exec(
    text,
  )
  if (!questionMatch) return null

  const promptText = questionMatch[1].trim()
  const choicesBlock = questionMatch[2]

  const choicePattern = /\\(CorrectChoice|choice)\s+([^\n\\]*(?:\\[^cC][^\n\\]*)*)/g
  const options: McqOption[] = []
  const correctOptionIds: string[] = []

  let match: RegExpExecArray | null
  while ((match = choicePattern.exec(choicesBlock)) !== null) {
    const isCorrect = match[1] === 'CorrectChoice'
    const optionText = match[2].trim()
    const id = generateId()
    options.push({ id, content: makeInlineRichText(optionText) })
    if (isCorrect) correctOptionIds.push(id)
  }

  if (options.length === 0) return null

  // Default to first option if no correct answer is marked
  const finalCorrectIds = correctOptionIds.length > 0 ? correctOptionIds : [options[0].id]
  const multiSelect = finalCorrectIds.length > 1

  const block: QuestionSelectMcqBlock = {
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: multiSelect ? 'multiple' : 'single',
    prompt: makeInlineRichText(promptText),
    answer: {
      multiSelect,
      options,
      correctOptionIds: finalCorrectIds,
    },
  }

  return block
}
