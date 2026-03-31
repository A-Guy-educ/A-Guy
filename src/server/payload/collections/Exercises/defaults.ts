/**
 * Shared Exercise Content Defaults
 *
 * Factory functions for creating default block structures.
 * Used by both server (validation) and client (admin UI).
 */

import type {
  ContentBlock,
  HtmlBlock,
  InlineRichText,
  LatexBlock,
  MediaBlock,
  QuestionAxisBlock,
  QuestionMultiAxisBlock,
  QuestionFreeResponseBlock,
  QuestionGeometryBlock,
  QuestionMatchingBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionTableBlock,
  RichTextBlock,
  SvgBlock,
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

  html: (): HtmlBlock => ({
    id: generateId(),
    type: 'html',
    html: '',
  }),

  media: (): MediaBlock => ({
    id: generateId(),
    type: 'media',
    mediaId: '',
  }),

  question_matching: (): QuestionMatchingBlock => ({
    id: generateId(),
    type: 'question_matching',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    leftColumn: [
      {
        id: 'l1',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Item 1',
          mediaIds: [],
        },
      },
      {
        id: 'l2',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Item 2',
          mediaIds: [],
        },
      },
    ],
    rightColumn: [
      {
        id: 'r1',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Match A',
          mediaIds: [],
        },
      },
      {
        id: 'r2',
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Match B',
          mediaIds: [],
        },
      },
    ],
    correctPairs: [
      { optionId: 'l1', matchId: 'r1' },
      { optionId: 'l2', matchId: 'r2' },
    ],
    shuffleRightColumn: true,
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  svg: (): SvgBlock => ({
    id: generateId(),
    type: 'svg',
    value:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n  <circle cx="100" cy="100" r="50" fill="none" stroke="black" />\n</svg>',
    altText: '',
  }),

  question_geometry: (): QuestionGeometryBlock => ({
    id: generateId(),
    type: 'question_geometry',
    prompt: DEFAULT_HINT_SOLUTION(),
    layout: 'textRight' as const,
    geometry: {
      kind: 'euclidean',
      canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
      elements: {
        points: [
          { name: 'A', x: 150, y: 100, position: 'tl', visible: true },
          { name: 'B', x: 350, y: 100, position: 'tr', visible: true },
          { name: 'C', x: 250, y: 300, position: 'b', visible: true },
        ],
        lines: [],
        circles: [],
        angles: [],
      },
      interactionSpec: {
        enabled: false,
        toolsAllowed: [],
        evaluation: { mode: 'none' },
      },
    },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_axis: (): QuestionAxisBlock => ({
    id: generateId(),
    type: 'question_axis',
    prompt: DEFAULT_HINT_SOLUTION(),
    layout: 'textRight' as const,
    axis: {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: true, color: '#e0e0e0' },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      elements: { points: [], graphs: [] },
    },
    displaySize: 'full',
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_multi_axis: (): QuestionMultiAxisBlock => ({
    id: generateId(),
    type: 'question_multi_axis',
    prompt: DEFAULT_HINT_SOLUTION(),
    textPosition: 'above',
    graphs: [
      {
        id: generateId(),
        label: 'Graph 1',
        axis: {
          kind: 'cartesian',
          units: 1,
          grid: { enabled: true, color: '#e0e0e0' },
          axes: {
            showNumbers: true,
            showLabels: true,
            ticks: 1,
            labels: { x: 'x', y: 'y' },
            origin: { x: 0, y: 0 },
          },
          viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
          elements: { points: [], graphs: [] },
        },
        order: 0,
      },
    ],
  }),
}
