/**
 * Prompt builder for support generation
 * Extracts block context into a structured user prompt
 */
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

export interface SupportPromptInput {
  block: ContentBlock
  exerciseTitle?: string
  targetFields: ('hints' | 'solution' | 'fullSolution')[]
}

export function buildSupportUserPrompt(input: SupportPromptInput): string {
  const { block, exerciseTitle } = input
  const parts: string[] = []

  if (exerciseTitle) {
    parts.push(`Exercise: "${exerciseTitle}"`)
  }

  parts.push(`Block Type: ${block.type}`)
  if ('variant' in block) {
    parts.push(`Variant: ${(block as { variant: string }).variant}`)
  }

  parts.push('')
  parts.push(`Question: ${extractPromptText(block)}`)
  parts.push('')
  parts.push(`Answer/Correct Response: ${extractAnswerText(block)}`)

  if (hasOptions(block)) {
    parts.push('')
    parts.push(`Options: ${extractOptionsText(block)}`)
  }

  parts.push('')
  parts.push('Return a JSON object with ALL three keys: "hints", "solution", "fullSolution".')

  return parts.join('\n')
}

function extractPromptText(block: ContentBlock): string {
  if ('prompt' in block && block.prompt) {
    return block.prompt.value || '(empty prompt)'
  }
  return '(no prompt)'
}

function extractAnswerText(block: ContentBlock): string {
  if (block.type === 'question_select') {
    if (block.variant === 'true_false') {
      return `Correct: ${block.answer.correctOptionId ?? 'not set'}`
    }
    if (block.variant === 'mcq') {
      const correctLabels = block.answer.correctOptionIds
        .map((id) => {
          const opt = block.answer.options.find((o) => o.id === id)
          return opt ? opt.content.value : id
        })
        .join(', ')
      return `Correct option(s): ${correctLabels}`
    }
  }

  if (block.type === 'question_free_response') {
    return `Accepted answers: ${block.answer.acceptedAnswers.join(', ')}`
  }

  if (block.type === 'question_table') {
    if (block.table.solutionFill && block.table.answers) {
      const entries = Object.entries(block.table.answers)
        .map(([key, val]) => `Cell [${key}]: ${val}`)
        .join('; ')
      return `Table answers: ${entries}`
    }
    return '(table without solution fill)'
  }

  if (block.type === 'question_matching') {
    const pairs = block.correctPairs
      .map((p) => {
        const left = block.leftColumn.find((o) => o.id === p.optionId)
        const right = block.rightColumn.find((o) => o.id === p.matchId)
        const leftText = left?.content.value ?? p.optionId
        const rightText = right?.content.value ?? p.matchId
        return `${leftText} -> ${rightText}`
      })
      .join('; ')
    return `Matching pairs: ${pairs}`
  }

  return '(answer not extractable for this block type)'
}

function hasOptions(block: ContentBlock): boolean {
  return block.type === 'question_select' && block.variant === 'mcq'
}

function extractOptionsText(block: ContentBlock): string {
  if (block.type === 'question_select' && block.variant === 'mcq') {
    return block.answer.options.map((opt) => `[${opt.id}] ${opt.content.value}`).join(' | ')
  }
  return ''
}
