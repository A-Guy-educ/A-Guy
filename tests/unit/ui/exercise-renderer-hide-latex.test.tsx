// @vitest-environment jsdom
/**
 * Tests the hideLatexBlocks prop on ExerciseRenderer. Defaults to true so the
 * exercise viewer never renders raw LaTeX blocks — the script converter keeps
 * them in stored content as a source-of-truth reference, with parsed
 * structured blocks inserted alongside. Admin/preview contexts can pass
 * `hideLatexBlocks={false}` to display the raw LaTeX.
 */

import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'

// Mock the two block renderers we care about with tiny test stubs so we can
// assert DOM presence without pulling in KaTeX / markdown machinery.
vi.mock('@/ui/web/exerciserenderer/blocks/LatexBlockRenderer', () => ({
  LatexBlockRenderer: ({ block }: { block: { latex: string } }) => (
    <div data-testid="latex-block">{block.latex}</div>
  ),
}))
vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="rich-text">{block.value}</div>
  ),
}))

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {ui}
    </I18nProvider>,
  )
}

function buildContent(): ExerciseContentData {
  return {
    blocks: [
      {
        id: 'rt-1',
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Plain prose block',
        mediaIds: [],
      },
      {
        id: 'lx-1',
        type: 'latex',
        latex: 'E = mc^2',
        renderMode: 'block',
      },
    ] as ExerciseContentData['blocks'],
  }
}

describe('ExerciseRenderer — hideLatexBlocks prop', () => {
  afterEach(() => {
    cleanup()
  })

  it('hides latex blocks by default (hideLatexBlocks not set) and keeps other blocks intact', () => {
    renderWithI18n(<ExerciseRenderer content={buildContent()} />)
    expect(screen.getByTestId('rich-text')).toHaveTextContent('Plain prose block')
    expect(screen.queryByTestId('latex-block')).not.toBeInTheDocument()
  })

  it('renders latex blocks when hideLatexBlocks is explicitly false', () => {
    renderWithI18n(<ExerciseRenderer content={buildContent()} hideLatexBlocks={false} />)
    expect(screen.getByTestId('latex-block')).toHaveTextContent('E = mc^2')
  })

  it('skips latex blocks when hideLatexBlocks is true but keeps other blocks intact', () => {
    renderWithI18n(<ExerciseRenderer content={buildContent()} hideLatexBlocks={true} />)
    expect(screen.getByTestId('rich-text')).toHaveTextContent('Plain prose block')
    expect(screen.queryByTestId('latex-block')).not.toBeInTheDocument()
  })

  it('filters multiple latex blocks in one exercise when hideLatexBlocks is true', () => {
    const content: ExerciseContentData = {
      blocks: [
        {
          id: 'lx-a',
          type: 'latex',
          latex: 'FIRST',
          renderMode: 'block',
        },
        {
          id: 'rt-1',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'middle prose',
          mediaIds: [],
        },
        {
          id: 'lx-b',
          type: 'latex',
          latex: 'SECOND',
          renderMode: 'block',
        },
      ] as ExerciseContentData['blocks'],
    }
    renderWithI18n(<ExerciseRenderer content={content} hideLatexBlocks />)
    expect(screen.queryByText('FIRST')).not.toBeInTheDocument()
    expect(screen.queryByText('SECOND')).not.toBeInTheDocument()
    expect(screen.getByTestId('rich-text')).toHaveTextContent('middle prose')
  })
})
