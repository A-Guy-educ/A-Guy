/**
 * Shared Exercise Content Defaults
 *
 * Factory functions for creating default block structures.
 * Used by both server (validation) and client (admin UI).
 */

import type {
  ContentBlock,
  InlineRichText,
  LatexBlock,
  QuestionFreeResponseBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionTableBlock,
  RichTextBlock,
  TrueFalseAnswer,
} from './types'
import { generateId } from './types'

export { generateId }

// ---------------------------------
// Default Content Container
// ---------------------------------
export const DEFAULT_CONTENT: () => { blocks: RichTextBlock[] } = () => ({
  blocks: [
    {
      id: generateId(),
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
  ],
})

// ---------------------------------
// Helper for hint/solution blocks
// ---------------------------------
const DEFAULT_HINT_SOLUTION = (): InlineRichText => ({
  type: 'rich_text',
  format: 'md-math-v1',
  value: '',
  mediaIds: [],
})

// ---------------------------------
// True/False Answer
// ---------------------------------
const DEFAULT_TF_ANSWER: TrueFalseAnswer = {
  correctOptionId: 'true',
}

// ---------------------------------
// MCQ Answer
// ---------------------------------
const DEFAULT_MCQ_ANSWER: QuestionSelectMcqBlock['answer'] = {
  multiSelect: false,
  options: [
    {
      id: 'o1',
      content: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Option A',
        mediaIds: [],
      },
    },
    {
      id: 'o2',
      content: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Option B',
        mediaIds: [],
      },
    },
  ],
  correctOptionIds: ['o1'],
}

// ---------------------------------
// Free Response Answer
// ---------------------------------
const DEFAULT_FREE_RESPONSE_ANSWER: QuestionFreeResponseBlock['answer'] = {
  acceptedAnswers: ['4'],
}

// ---------------------------------
// Block Factories (for admin UI Add Block menu)
// ---------------------------------
export const ExerciseBlockDefaults: Record<string, () => ContentBlock> = {
  rich_text: (): RichTextBlock => ({
    id: generateId(),
    type: 'rich_text',
    format: 'md-math-v1',
    value: '',
    mediaIds: [],
  }),

  question_select: (): QuestionSelectTrueFalseBlock => ({
    id: generateId(),
    type: 'question_select',
    variant: 'true_false',
    selectionMode: 'single',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    options: [
      {
        id: 'true',
        value: true,
        label: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'True',
          mediaIds: [],
        },
      },
      {
        id: 'false',
        value: false,
        label: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'False',
          mediaIds: [],
        },
      },
    ],
    answer: { ...DEFAULT_TF_ANSWER },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_mcq: (): QuestionSelectMcqBlock => ({
    id: generateId(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'multiple',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    answer: {
      multiSelect: true,
      options: DEFAULT_MCQ_ANSWER.options.map((o) => ({
        id: o.id,
        content: { ...o.content },
      })),
      correctOptionIds: [...DEFAULT_MCQ_ANSWER.correctOptionIds],
    },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_free_response: (): QuestionFreeResponseBlock => ({
    id: generateId(),
    type: 'question_free_response',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    answer: { ...DEFAULT_FREE_RESPONSE_ANSWER },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_table: (): QuestionTableBlock => ({
    id: generateId(),
    type: 'question_table',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Complete the table:',
      mediaIds: [],
    },
    table: {
      solutionFill: false,
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rowsData: [
        ['', '', ''],
        ['', '', ''],
      ],
      answers: {},
      showBorders: true,
      showHeader: true,
      columnAlignment: ['left', 'center', 'right'],
    },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  latex: (): LatexBlock => ({
    id: generateId(),
    type: 'latex',
    latex: '',
    renderMode: 'block',
  }),
}
