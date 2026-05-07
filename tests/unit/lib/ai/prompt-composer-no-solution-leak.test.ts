/**
 * Regression guard for audit F5: ensure neither the composer nor the lesson
 * context builder ever emit `solution`, `answer`, or `fullSolution` fields
 * from question_* blocks into the system prompt.
 *
 * Audit F5 turned out to be a false alarm — current code only emits `prompt`
 * and `hint` — but a future change to formatExerciseContent or
 * buildLessonContextBlock could introduce a leak. This test asserts the
 * invariant.
 */
import { composeSystemInstructions } from '@/infra/llm/prompt-composer.server'
import { describe, expect, it } from 'vitest'

const SECRET_SOLUTION = 'SECRET_SOLUTION_TEXT_THAT_MUST_NOT_LEAK'
const SECRET_ANSWER = 'SECRET_ANSWER_TEXT_THAT_MUST_NOT_LEAK'
const SECRET_FULL = 'SECRET_FULL_SOLUTION_TEXT_THAT_MUST_NOT_LEAK'

describe('composeSystemInstructions — no solution/answer leak (audit F5)', () => {
  it('does not include solution/answer/fullSolution from question_* blocks in the exercises section', () => {
    const exercises = [
      {
        id: 'ex1',
        title: 'Exercise with secrets',
        content: {
          blocks: [
            {
              id: 'b1',
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Visible body text',
              mediaIds: [],
            },
            {
              id: 'b2',
              type: 'question_select',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Visible prompt',
                mediaIds: [],
              },
              hint: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Visible hint',
                mediaIds: [],
              },
              solution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: SECRET_SOLUTION,
                mediaIds: [],
              },
              answer: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: SECRET_ANSWER,
                mediaIds: [],
              },
              fullSolution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: SECRET_FULL,
                mediaIds: [],
              },
            },
            {
              id: 'b3',
              type: 'question_free_response',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Visible free-response prompt',
                mediaIds: [],
              },
              solution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: SECRET_SOLUTION + '_2',
                mediaIds: [],
              },
              answer: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: SECRET_ANSWER + '_2',
                mediaIds: [],
              },
            },
          ],
        },
      },
    ]

    const out = composeSystemInstructions(
      [],
      'You are a tutor.',
      undefined,
      undefined,
      undefined,
      undefined,
      exercises,
      false,
    )

    // Visible content reaches the prompt
    expect(out).toContain('Visible body text')
    expect(out).toContain('Visible prompt')
    // Secrets MUST NOT
    expect(out).not.toContain(SECRET_SOLUTION)
    expect(out).not.toContain(SECRET_ANSWER)
    expect(out).not.toContain(SECRET_FULL)
  })
})
