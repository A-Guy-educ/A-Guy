import { generateId } from '@/server/payload/collections/Exercises/types'
import type {
  RichTextBlock,
  LatexBlock,
  QuestionSelectMcqBlock,
  InlineRichText,
} from '@/server/payload/collections/Exercises/types'

export function makeRichTextBlock(value: string): RichTextBlock {
  return {
    id: generateId(),
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

export function makeLatexBlock(latex: string): LatexBlock {
  return {
    id: generateId(),
    type: 'latex',
    latex,
    renderMode: 'block',
  }
}

export function makeInlineRichText(value: string): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

export function makeMcqBlock(
  prompt: string,
  options: Array<{ text: string; isCorrect: boolean }>,
): QuestionSelectMcqBlock {
  const mcqOptions = options.map((opt) => ({
    id: generateId(),
    content: makeInlineRichText(opt.text),
  }))

  const correctIds = mcqOptions.filter((_, i) => options[i].isCorrect).map((o) => o.id)

  return {
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: correctIds.length > 1 ? 'multiple' : 'single',
    prompt: makeInlineRichText(prompt),
    answer: {
      multiSelect: correctIds.length > 1,
      options: mcqOptions,
      correctOptionIds: correctIds.length > 0 ? correctIds : [mcqOptions[0].id],
    },
  }
}
