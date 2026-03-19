/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, bug-reproduction
 * @ai-summary Reproduction test for redundant "1" label in ExerciseRenderer - verifies the number bubble is NOT rendered
 */
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'

// Minimal test messages
const testMessages = {
  courses: {
    invalidAnswerType: 'Invalid answer type',
    selectTrueFalse: 'Select True or False',
    noCorrectAnswer: 'No correct answer defined',
    selectAnAnswer: 'Select an answer',
    enterAnAnswer: 'Enter an answer',
    unknownVariant: 'Unknown variant',
    validationFailed: 'Validation failed',
    validationError: 'Validation error',
    connectionError: 'Connection error',
    checkAnswer: 'Check Answer',
    correct: 'Correct!',
    incorrect: 'Incorrect',
    videoUnavailable: 'Video unavailable',
    helpHint: 'Hint',
    helpGuidingQuestion: 'Guiding Question',
    helpSolution: 'Solution',
    exercise: 'Exercise',
    of: 'of',
    exerciseNumber: 'Exercise',
  },
}

// Helper to wrap component with I18n provider
const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={testMessages}>
      {component}
    </I18nProvider>,
  )
}

describe('ExerciseRenderer - Number Bubble Bug', () => {
  afterEach(() => {
    cleanup()
  })

  // Create minimal valid content
  const minimalContent: ExerciseContentData = {
    blocks: [
      {
        id: 'test-1',
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Test question content',
        mediaIds: [],
      },
    ],
  }

  it('should NOT render a number bubble at the top (bug reproduction)', () => {
    // Render ExerciseRenderer with minimal content
    const { container } = renderWithI18n(
      <ExerciseRenderer content={minimalContent} mode="student" showCheckAnswer={true} />,
    )

    // The bug: there was a bubble with "1" rendered at the top
    // After fix: there should be NO bubble element
    // Look for the bubble pattern: a div with specific styling (w-7 h-7 rounded-full)
    const bubbleElements = container.querySelectorAll('.rounded-full.bg-slate-50')

    // This test expects NO bubble - if bubble exists, test fails (proving bug)
    expect(bubbleElements).toHaveLength(0)
  })

  it('should render the exercise content without the number bubble', () => {
    const { container } = renderWithI18n(
      <ExerciseRenderer content={minimalContent} mode="student" showCheckAnswer={true} />,
    )

    // The content should still be rendered
    expect(container.textContent).toContain('Test question content')

    // But the number "1" in the bubble context should NOT exist as a standalone element
    // Specifically check that there's no span with "1" inside the bubble container
    const bubbleSpans = container.querySelectorAll('.rounded-full span.font-bold')
    expect(bubbleSpans).toHaveLength(0)
  })
})
