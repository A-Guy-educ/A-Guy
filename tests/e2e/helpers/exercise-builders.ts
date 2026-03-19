/**
 * Exercise content builders for test data seeding.
 * Each function returns an exerciseContent object with blocks.
 */
import { generateId } from '@/server/payload/collections/Exercises/types'

function richText(value: string) {
  return {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value,
    mediaIds: [],
  }
}

export function buildMcqExercise() {
  const optA = generateId()
  const optB = generateId()
  const optC = generateId()
  return {
    blocks: [
      {
        id: generateId(),
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'What is 2 + 2?',
        mediaIds: [],
      },
      {
        id: generateId(),
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: richText('Select the correct answer:'),
        answer: {
          multiSelect: false,
          options: [
            { id: optA, content: richText('3') },
            { id: optB, content: richText('4') },
            { id: optC, content: richText('5') },
          ],
          correctOptionIds: [optB],
        },
        hint: richText('Think about basic addition.'),
        solution: richText('2 + 2 = 4'),
      },
    ],
  }
}

export function buildFreeResponseExercise() {
  return {
    blocks: [
      {
        id: generateId(),
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Solve the equation: $3x = 12$',
        mediaIds: [],
      },
      {
        id: generateId(),
        type: 'question_free_response',
        prompt: richText('Enter the value of x:'),
        answer: { acceptedAnswers: ['4'] },
        hint: richText('Divide both sides by 3.'),
      },
    ],
  }
}

export function buildMatchingExercise() {
  const l1 = generateId()
  const l2 = generateId()
  const r1 = generateId()
  const r2 = generateId()
  return {
    blocks: [
      {
        id: generateId(),
        type: 'question_matching',
        prompt: richText('Match each shape to its number of sides:'),
        leftColumn: [
          { id: l1, content: richText('Triangle') },
          { id: l2, content: richText('Square') },
        ],
        rightColumn: [
          { id: r1, content: richText('3') },
          { id: r2, content: richText('4') },
        ],
        correctPairs: [
          { optionId: l1, matchId: r1 },
          { optionId: l2, matchId: r2 },
        ],
        shuffleRightColumn: true,
        hint: richText('Count the edges of each shape.'),
      },
    ],
  }
}

export function buildTableExercise() {
  return {
    blocks: [
      {
        id: generateId(),
        type: 'question_table',
        prompt: richText('Fill in the missing values:'),
        table: {
          solutionFill: true,
          headers: ['x', 'x * 2'],
          rowsData: [
            ['1', '2'],
            ['2', ''],
            ['3', ''],
          ],
          answers: { '1-1': '4', '2-1': '6' },
          showBorders: true,
          showHeader: true,
        },
        hint: richText('Multiply x by 2.'),
      },
    ],
  }
}
