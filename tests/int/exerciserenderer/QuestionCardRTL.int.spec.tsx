// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuestionCard } from '@/ui/web/exerciserenderer/components/QuestionCard'

const mockProps = {
  showCheckButton: false,
  onCheckAnswer: vi.fn(),
  disabled: false,
  checked: false,
  checkResult: null,
  checkAnswerText: 'Check',
  correctText: 'Correct',
  incorrectText: 'Incorrect',
}

describe('QuestionCard RTL alignment', () => {
  it('applies justify-start without flex-row-reverse for RTL question label', () => {
    render(
      <QuestionCard {...mockProps} dir="rtl" questionLabel="א">
        <div>Content</div>
      </QuestionCard>,
    )

    // The outer container has mb-4 and the RTL-specific classes
    // The inner circle has justify-center which we should NOT match
    const outerContainer = screen.getByText('א').closest('.mb-4')
    expect(outerContainer).toBeTruthy()
    expect(outerContainer?.className).toContain('flex')
    expect(outerContainer?.className).toContain('items-center')

    // In RTL, justify-start aligns to the RIGHT logical edge
    // flex-row-reverse would flip items and place circle on LEFT physical side - this is the bug
    expect(outerContainer?.className).toContain('justify-start')
    expect(outerContainer?.className).not.toContain('flex-row-reverse')
    expect(outerContainer?.className).not.toContain('justify-end')
    expect(outerContainer?.className).not.toContain('text-right')
  })

  it('applies justify-start text-left for LTR question label', () => {
    render(
      <QuestionCard {...mockProps} dir="ltr" questionLabel="A">
        <div>Content</div>
      </QuestionCard>,
    )

    const outerContainer = screen.getByText('A').closest('.mb-4')
    expect(outerContainer).toBeTruthy()
    expect(outerContainer?.className).toContain('flex')
    expect(outerContainer?.className).toContain('items-center')

    expect(outerContainer?.className).toContain('justify-start')
    expect(outerContainer?.className).toContain('text-left')
  })
})
