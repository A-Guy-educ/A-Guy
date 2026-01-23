import type { ContentBlock } from './schemas'

/**
 * Generate unique ID - browser and server compatible
 */
const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'b-' + Math.random().toString(36).substr(2, 9)
}

// ---------------------------------
// Defaults
// ---------------------------------
export const DEFAULT_CONTENT = () => ({
  blocks: [
    {
      id: generateId(),
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Write the exercise instructions here.',
      mediaIds: [] as string[],
    },
  ],
})

// Shared helper/solution content structure
const DEFAULT_HINT_SOLUTION = () => ({
  type: 'rich_text' as const,
  format: 'md-math-v1' as const,
  value: '',
  mediaIds: [] as string[],
})

// True/False answer with optional correctOptionId (teacher must set this)
const DEFAULT_TF_ANSWER = {
  correctOptionId: 'true', // Default to 'true' as correct answer
}

const DEFAULT_MCQ_ANSWER = {
  multiSelect: false,
  options: [
    {
      id: 'o1',
      content: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'Option A',
        mediaIds: [] as string[],
      },
    },
    {
      id: 'o2',
      content: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'Option B',
        mediaIds: [] as string[],
      },
    },
  ],
  correctOptionIds: ['o1'],
}

const DEFAULT_FREE_RESPONSE_ANSWER = {
  acceptedAnswers: ['4'],
}

// ---------------------------------
// Block factories for editor UI (Add Block menu)
// Keys are used in the admin UI, values create the actual block structure
// ---------------------------------
export const ExerciseBlockDefaults: Record<string, () => ContentBlock> = {
  rich_text: () => ({
    id: generateId(),
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Write text here.',
    mediaIds: [] as string[],
  }),

  question_select: () => ({
    id: generateId(),
    type: 'question_select' as const,
    variant: 'true_false' as const,
    selectionMode: 'single' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Statement: ...',
      mediaIds: [] as string[],
    },
    options: [
      {
        id: 'true' as const,
        value: true as const,
        label: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'True',
          mediaIds: [] as string[],
        },
      },
      {
        id: 'false' as const,
        value: false as const,
        label: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'False',
          mediaIds: [] as string[],
        },
      },
    ] as const,
    answer: { ...DEFAULT_TF_ANSWER },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),

  question_mcq: () => ({
    id: generateId(),
    type: 'question_select' as const,
    variant: 'mcq' as const,
    selectionMode: 'multiple' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Choose the correct option:',
      mediaIds: [] as string[],
    },
    answer: {
      multiSelect: true, // Enable multiple selection by default
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

  question_free_response: () => ({
    id: generateId(),
    type: 'question_free_response' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Enter your answer:',
      mediaIds: [] as string[],
    },
    answer: { ...DEFAULT_FREE_RESPONSE_ANSWER },
    hint: DEFAULT_HINT_SOLUTION(),
    solution: DEFAULT_HINT_SOLUTION(),
    fullSolution: DEFAULT_HINT_SOLUTION(),
  }),
}
