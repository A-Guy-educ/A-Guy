/**
 * Verifies the exercises section in composeSystemInstructions stays
 * within budget — implements audit F4. Without this cap a 31-exercise
 * lesson with multi-part question_geometry blocks pushed the system
 * prompt past 14 KB, diluting the model's attention.
 */
import { composeSystemInstructions } from '@/infra/llm/prompt-composer.server'
import { describe, expect, it } from 'vitest'

function makeExercise(idx: number, opts?: { longBody?: boolean }) {
  const body = opts?.longBody ? 'x'.repeat(2000) : 'short body'
  return {
    id: `ex-${idx}`,
    title: `Exercise ${idx}`,
    content: {
      blocks: [{ id: 'b1', type: 'rich_text', format: 'md-math-v1', value: body, mediaIds: [] }],
    },
  }
}

describe('composeSystemInstructions — exercises section size cap (audit F4)', () => {
  it('truncates oversized per-exercise content', () => {
    const exercises = [makeExercise(1, { longBody: true })]
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
    // Content was 2000 chars, cap is 400 → must contain truncation marker
    expect(out).toContain('…(truncated)')
    // Title still present
    expect(out).toContain('**Exercise 1**')
  })

  it('lists later exercises by title only when section budget is reached', () => {
    // 30 exercises, each with a 1000-char body → far exceeds 4 KB section budget
    const exercises = Array.from({ length: 30 }, (_, i) => makeExercise(i + 1, { longBody: true }))
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

    // Every title should still appear (titles-only mode for the tail)
    for (let i = 1; i <= 30; i++) {
      expect(out).toContain(`**Exercise ${i}**`)
    }

    // The exercises section length should be bounded — measured between
    // its header and the next mandatory block.
    const sectionStart = out.indexOf('## Lesson Exercises')
    const sectionEnd = out.indexOf('## Math Formatting (CRITICAL)')
    const sectionLength = sectionEnd - sectionStart
    expect(sectionLength).toBeLessThan(8000) // generous upper bound; would be 30 KB without the cap
  })

  it('emits all content when section fits the budget', () => {
    const exercises = [makeExercise(1), makeExercise(2)]
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
    // Both bodies fit inside the budget, no truncation
    expect(out).not.toContain('…(truncated)')
    expect(out).toContain('short body')
  })
})
