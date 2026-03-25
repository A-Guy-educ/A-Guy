// @vitest-environment jsdom
/**
 * Unit Tests for FormulaSheetContent Component
 *
 * Tests content rendering based on content type:
 * - HTML blocks render via dangerouslySetInnerHTML
 * - Media blocks render images or download links
 * - Empty blocks show empty state message
 * - PDF type with no file shows empty state
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock useTranslations
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      formulaSheetEmpty: 'No content available',
    }
    return translations[key] ?? key
  },
}))

// Mock PDFEmbed
vi.mock('@/ui/web/courses/PDFViewer/PDFEmbed', () => ({
  PDFEmbed: ({ pdfUrl, title }: { pdfUrl: string; title: string }) => (
    <div data-testid="pdf-embed" data-url={pdfUrl} data-title={title} />
  ),
}))

import { FormulaSheetContent } from '@/ui/web/shared/FormulaSheetViewer/FormulaSheetContent'
// Use loose typing for test fixtures — Payload types have many required fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestFormulaSheet = any

function makeSheet(overrides: Partial<TestFormulaSheet> = {}): TestFormulaSheet {
  return {
    id: 'sheet-1',
    title: 'Test Sheet',
    contentType: 'blocks',
    status: 'published',
    locale: 'he',
    tenant: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    bodyBlocks: null,
    pdfFile: null,
    richTextContent: null,
    ...overrides,
  }
}

describe('FormulaSheetContent', () => {
  describe('empty states', () => {
    it('shows empty message when blocks type has no blocks', () => {
      const sheet = makeSheet({ contentType: 'blocks', bodyBlocks: [] })
      const { getByText } = render(<FormulaSheetContent sheet={sheet} />)
      expect(getByText('No content available')).toBeDefined()
    })

    it('shows empty message when blocks type has null blocks', () => {
      const sheet = makeSheet({ contentType: 'blocks', bodyBlocks: null })
      const { getByText } = render(<FormulaSheetContent sheet={sheet} />)
      expect(getByText('No content available')).toBeDefined()
    })

    it('shows empty message for pdf type with no file', () => {
      const sheet = makeSheet({ contentType: 'pdf', pdfFile: null })
      const { getByText } = render(<FormulaSheetContent sheet={sheet} />)
      expect(getByText('No content available')).toBeDefined()
    })

    it('shows empty message for pdf type with string-only file ref', () => {
      const sheet = makeSheet({ contentType: 'pdf', pdfFile: 'some-id' })
      const { getByText } = render(<FormulaSheetContent sheet={sheet} />)
      expect(getByText('No content available')).toBeDefined()
    })
  })

  describe('HTML blocks', () => {
    it('renders HTML block content via dangerouslySetInnerHTML', () => {
      const sheet = makeSheet({
        contentType: 'blocks',
        bodyBlocks: [
          {
            blockType: 'html',
            html: '<h2>Algebra</h2><p>a² + b² = c²</p>',
            id: 'block-1',
            blockName: null,
          },
        ],
      })
      const { container } = render(<FormulaSheetContent sheet={sheet} />)
      expect(container.querySelector('.rich-text-content')).toBeDefined()
      expect(container.innerHTML).toContain('Algebra')
      expect(container.innerHTML).toContain('a² + b² = c²')
    })

    it('renders multiple HTML blocks', () => {
      const sheet = makeSheet({
        contentType: 'blocks',
        bodyBlocks: [
          { blockType: 'html', html: '<p>Block 1</p>', id: 'b1', blockName: null },
          { blockType: 'html', html: '<p>Block 2</p>', id: 'b2', blockName: null },
        ],
      })
      const { container } = render(<FormulaSheetContent sheet={sheet} />)
      const blocks = container.querySelectorAll('.rich-text-content')
      expect(blocks.length).toBe(2)
    })
  })

  describe('media blocks', () => {
    it('renders image for image media type', () => {
      const sheet = makeSheet({
        contentType: 'blocks',
        bodyBlocks: [
          {
            blockType: 'mediaBlock',
            id: 'mb-1',
            blockName: null,
            media: {
              id: 'media-1',
              url: '/media/formula.png',
              mimeType: 'image/png',
              alt: 'Formula diagram',
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      })
      const { container } = render(<FormulaSheetContent sheet={sheet} />)
      const img = container.querySelector('img')
      expect(img).toBeDefined()
      expect(img?.getAttribute('src')).toBe('/media/formula.png')
      expect(img?.getAttribute('alt')).toBe('Formula diagram')
    })

    it('renders download link for non-image media', () => {
      const sheet = makeSheet({
        contentType: 'blocks',
        bodyBlocks: [
          {
            blockType: 'mediaBlock',
            id: 'mb-2',
            blockName: null,
            media: {
              id: 'media-2',
              url: '/media/data.csv',
              mimeType: 'text/csv',
              filename: 'data.csv',
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      })
      const { container } = render(<FormulaSheetContent sheet={sheet} />)
      const link = container.querySelector('a')
      expect(link).toBeDefined()
      expect(link?.getAttribute('href')).toBe('/media/data.csv')
      expect(link?.textContent).toBe('data.csv')
    })

    it('skips media block with string-only media reference', () => {
      const sheet = makeSheet({
        contentType: 'blocks',
        bodyBlocks: [
          {
            blockType: 'mediaBlock',
            id: 'mb-3',
            blockName: null,
            media: 'some-media-id',
          },
        ],
      })
      const { container } = render(<FormulaSheetContent sheet={sheet} />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('a')).toBeNull()
    })
  })

  describe('PDF content type', () => {
    it('renders PDFEmbed when pdf file is resolved', () => {
      const sheet = makeSheet({
        contentType: 'pdf',
        pdfFile: {
          id: 'pdf-1',
          url: '/media/formulas.pdf',
          filename: 'formulas.pdf',
          mimeType: 'application/pdf',
          updatedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      })
      const { getByTestId } = render(<FormulaSheetContent sheet={sheet} />)
      const pdfEmbed = getByTestId('pdf-embed')
      expect(pdfEmbed.getAttribute('data-url')).toBe('/media/formulas.pdf')
    })
  })

  describe('richText content type falls through to blocks', () => {
    it('shows empty when richText type has no blocks', () => {
      const sheet = makeSheet({ contentType: 'richText', bodyBlocks: null })
      const { getByText } = render(<FormulaSheetContent sheet={sheet} />)
      expect(getByText('No content available')).toBeDefined()
    })
  })
})
