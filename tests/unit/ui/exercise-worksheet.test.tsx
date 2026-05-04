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

  it('geometry block with very-wide canvas (aspect > 5/3) renders GeometryRenderer (wrapped below)', () => {
    const blocks = [
      {
        id: 'geo1',
        type: 'question_geometry',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Wide geo', mediaIds: [] },
        geometry: {
          kind: 'euclidean',
          canvas: { width: 800, height: 300, background: undefined, grid: false, axis: false },
          elements: {},
          interactionSpec: {},
        },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    // aspect 800/300 ≈ 2.67 > 5/3 → 3/5 wrap rule → stacked
    expect(screen.getByTestId('geometry')).toBeInTheDocument()
    expect(screen.getByText('Wide geo')).toBeInTheDocument()
  })

  it('geometry block with default 600×400 canvas (aspect 1.5 < 5/3) renders GeometryRenderer (side-by-side)', () => {
    const blocks = [
      {
        id: 'geo2',
        type: 'question_geometry',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Default geo', mediaIds: [] },
        geometry: {
          kind: 'euclidean',
          canvas: { width: 600, height: 400, background: undefined, grid: false, axis: false },
          elements: {},
          interactionSpec: {},
        },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByTestId('geometry')).toBeInTheDocument()
    expect(screen.getByText('Default geo')).toBeInTheDocument()
  })

  it('axis block renders AxisRenderer (aspect 1.5 < 5/3 → side-by-side)', () => {
    const blocks = [
      {
        id: 'axis1',
        type: 'question_axis',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Axis question', mediaIds: [] },
        axis: {},
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByTestId('axis')).toBeInTheDocument()
    expect(screen.getByText('Axis question')).toBeInTheDocument()
  })

  it('narrow table (3 cols <= 4) renders side-by-side container', () => {
    const blocks = [
      {
        id: 'tbl1',
        type: 'question_table',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Table prompt', mediaIds: [] },
        table: {
          solutionFill: false,
          headers: ['A', 'B', 'C'],
          rowsData: [['1', '2', '3']],
          showBorders: true,
          showHeader: true,
        },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByText('Table prompt')).toBeInTheDocument()
    // The side-by-side container has sm:flex-row and gap-content-gap
    const sideBySideContainer = document.querySelector('[dir="ltr"]')
    expect(sideBySideContainer?.className).toContain('sm:flex-row')
  })

  it('wide table (6 cols > 4) renders stacked container (no sm:flex-row)', () => {
    const blocks = [
      {
        id: 'tbl2',
        type: 'question_table',
        prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Wide table', mediaIds: [] },
        table: {
          solutionFill: false,
          headers: ['A', 'B', 'C', 'D', 'E', 'F'],
          rowsData: [['1', '2', '3', '4', '5', '6']],
          showBorders: true,
          showHeader: true,
        },
      },
    ] as unknown as ContentBlock[]

    renderWith('en', blocks)
    expect(screen.getByText('Wide table')).toBeInTheDocument()
    // Wide table → stacked → no sm:flex-row side-by-side container
    const sideBySideContainer = document.querySelector('[dir="ltr"]')
    expect(sideBySideContainer).not.toBeInTheDocument()
  })
})
