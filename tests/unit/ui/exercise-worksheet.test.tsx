// @vitest-environment jsdom
/**
 * Tests for ExerciseWorksheet — the read-only worksheet-style renderer used
 * by the PDF tab of DualModeLessonView. Verifies prompt/options visibility
 * per question type and that LaTeX blocks are dropped.
 */

import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { ExerciseWorksheet } from '@/ui/web/exerciserenderer/ExerciseWorksheet'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="rich">{block.value}</div>
  ),
}))
vi.mock('@/ui/web/exerciserenderer/blocks/HtmlBlockRenderer', () => ({
  HtmlBlockRenderer: ({ block }: { block: { html: string } }) => (
    <div data-testid="html">{block.html}</div>
  ),
}))
vi.mock('@/ui/web/exerciserenderer/blocks/SvgRenderer', () => ({
  SvgRenderer: () => <div data-testid="svg" />,
}))
vi.mock('@/ui/web/exerciserenderer/blocks/GeometryRenderer', () => ({
  GeometryRenderer: () => <div data-testid="geometry" />,
}))
vi.mock('@/ui/web/exerciserenderer/blocks/AxisRenderer', () => ({
  AxisRenderer: () => <div data-testid="axis" />,
}))
vi.mock('@/ui/web/exerciserenderer/blocks/MultiAxisRenderer', () => ({
  MultiAxisRenderer: () => <div data-testid="multi-axis" />,
}))

function renderWith(locale: 'en' | 'he', blocks: ContentBlock[]) {
  return render(
    <I18nProvider locale={locale} messages={locale === 'en' ? enMessages : heMessages}>
      <ExerciseWorksheet blocks={blocks} />
    </I18nProvider>,
  )
}

describe('ExerciseWorksheet', () => {
  afterEach(() => cleanup())

  it('hides latex blocks but renders rich_text alongside', () => {
    const blocks = [
      {
        id: 'rt-1',
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Visible prose',
        mediaIds: [],
      },
      { id: 'lx-1', type: 'latex', latex: 'E = mc^2', renderMode: 'block' },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByTestId('rich')).toHaveTextContent('Visible prose')
    expect(screen.queryByText('E = mc^2')).not.toBeInTheDocument()
  })

  it('renders MCQ choices as a static list (no inputs)', () => {
    const blocks = [
      {
        id: 'q1',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Pick one', mediaIds: [] },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'a',
              content: { type: 'rich_text', format: 'md-math-v1', value: 'Choice A', mediaIds: [] },
            },
            {
              id: 'b',
              content: { type: 'rich_text', format: 'md-math-v1', value: 'Choice B', mediaIds: [] },
            },
          ],
          correctOptionIds: ['a'],
        },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
    expect(screen.getByText('Choice A')).toBeInTheDocument()
    expect(screen.getByText('Choice B')).toBeInTheDocument()
    // No input controls in worksheet view.
    expect(document.querySelectorAll('input').length).toBe(0)
    expect(document.querySelectorAll('button').length).toBe(0)
  })

  it('renders True/False prompt and labels', () => {
    const blocks = [
      {
        id: 'q-tf',
        type: 'question_select',
        variant: 'true_false',
        selectionMode: 'single',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Sky is blue', mediaIds: [] },
        options: [
          {
            id: 'true',
            value: true,
            label: { type: 'rich_text', format: 'md-math-v1', value: 'True', mediaIds: [] },
          },
          {
            id: 'false',
            value: false,
            label: { type: 'rich_text', format: 'md-math-v1', value: 'False', mediaIds: [] },
          },
        ],
        answer: { correctOptionId: 'true' },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByText('Sky is blue')).toBeInTheDocument()
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })

  it('renders free response prompt only (no input)', () => {
    const blocks = [
      {
        id: 'q-fr',
        type: 'question_free_response',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Explain', mediaIds: [] },
        answer: { acceptedAnswers: ['anything'] },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByText('Explain')).toBeInTheDocument()
    expect(document.querySelectorAll('input,textarea').length).toBe(0)
  })

  it('passes axis blocks through GraphWithPrompt with locale-aware layout', () => {
    const blocks = [
      {
        id: 'g1',
        type: 'question_axis',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Graph it', mediaIds: [] },
        axis: {},
      },
    ] as unknown as ContentBlock[]

    renderWith('he', blocks)
    expect(screen.getByTestId('axis')).toBeInTheDocument()
    expect(screen.getByText('Graph it')).toBeInTheDocument()
  })
})
