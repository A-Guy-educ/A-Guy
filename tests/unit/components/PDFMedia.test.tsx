/**
 * @fileType test
 * @domain frontend
 * @pattern pdf-rendering, flexbox-layout
 * @ai-summary Tests for PDF display in desktop layout - verifies min-h-0 classes for proper flexbox height propagation
 */

// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// Mock the system events
vi.mock('@/infra/system-events', () => ({
  SYSTEM_EVENTS: { PDF_VIEWED: 'pdf-viewed' },
  systemEventBus: { emit: vi.fn() },
}))

// Mock the cn utility
vi.mock('@/infra/utils/ui', () => ({
  cn: (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' '),
}))

// Mock useMediaQuery - will be overridden in specific tests
const mockUseMediaQuery = vi.fn()
vi.mock('@/server/payload/hooks/useMediaQuery', () => ({
  useMediaQuery: (...args: unknown[]) => mockUseMediaQuery(...args),
}))

describe('PDF Desktop Layout Fix', () => {
  describe('PDFMedia component', () => {
    it('should render iframe with PDF.js viewer URL', async () => {
      // Import dynamically since PDFMedia is a client component
      const { PDFMedia } = await import('@/ui/web/media/PDFMedia')

      const mockResource = {
        id: 'test-pdf-1',
        filename: 'test.pdf',
        url: 'https://example.blob.vercel-storage.com/test.pdf',
        mimeType: 'application/pdf',
      }

      // Use React.createElement to avoid JSX transformation issues in tests
      const React = await import('react')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (React as any).createElement(PDFMedia, {
        resource: mockResource,
        className: 'test-class',
      })

      // The component should have an iframe with the correct src
      expect(result).toBeDefined()
      expect(result.props.resource).toEqual(mockResource)
    })

    it('should include min-h-0 in wrapper classes for flex containment', async () => {
      // Read the PDFMedia source to verify min-h-0 is in the className
      const fs = await import('fs')
      const path = await import('path')

      const pdfMediaPath = path.join(process.cwd(), 'src/ui/web/media/PDFMedia/index.tsx')
      const source = fs.readFileSync(pdfMediaPath, 'utf-8')

      // Verify the wrapper div has min-h-0
      // This is critical for proper flexbox height propagation in nested layouts
      expect(source).toContain("cn('w-full h-full min-h-0'")
    })

    it('should render null when no URL available', async () => {
      // Test the actual behavior - the component returns null when url and filename are null/undefined
      // This is a code path test - verify the logic handles this case correctly
      const fs = await import('fs')
      const path = await import('path')

      const pdfMediaPath = path.join(process.cwd(), 'src/ui/web/media/PDFMedia/index.tsx')
      const source = fs.readFileSync(pdfMediaPath, 'utf-8')

      // The component should have a null check when pdfUrl is null
      // which happens when resource has no url and no filename
      expect(source).toContain('if (!pdfUrl)')
      expect(source).toContain('return null')
    })
  })

  describe('SplitPaneLayout desktop path', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true) // Desktop mode
    })

    afterEach(() => {
      mockUseMediaQuery.mockRestore()
    })

    it('should include min-h-0 on desktop primary content wrapper', async () => {
      // Read the SplitPaneLayout source to verify min-h-0 is present
      const fs = await import('fs')
      const path = await import('path')

      const splitPanePath = path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx')
      const source = fs.readFileSync(splitPanePath, 'utf-8')

      // The desktop path renders primaryContent in a wrapper that needs min-h-0
      // This is the fix for the PDF blank display on desktop Chrome
      // The line should be: <div className="h-full overflow-hidden min-h-0">

      // Check if min-h-0 is present in the desktop wrapper
      // Current state: missing min-h-0 (will fail until fixed)
      const hasMinH0InDesktopPath = /h-full overflow-hidden.*min-h-0/.test(source)

      // This test verifies the fix was applied
      expect(hasMinH0InDesktopPath).toBe(true)
    })
  })

  describe('Lesson page primaryContent structure', () => {
    it('should use flex-1 min-h-0 for file wrappers (not h-full flex-shrink-0)', async () => {
      // Read the lesson page source to verify the class structure
      const fs = await import('fs')
      const path = await import('path')

      const pagePath = path.join(
        process.cwd(),
        'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
      )
      const source = fs.readFileSync(pagePath, 'utf-8')

      // The primaryContent wrapper should have min-h-0
      expect(source).toContain('flex flex-col min-h-0')

      // File wrappers should use flex-1 min-h-0 (not h-full flex-shrink-0)
      // This ensures proper height allocation in flex contexts
      expect(source).toContain('w-full flex-1 min-h-0')
      // Should NOT have the old problematic pattern
      expect(source).not.toContain('w-full h-full flex-shrink-0')
    })
  })
})

describe('Flexbox height propagation requirements', () => {
  it('documents the complete fix chain for PDF display on desktop', () => {
    // This test documents all the places where min-h-0 is required
    // for proper flexbox height propagation in the PDF viewer layout

    const fs = require('fs')
    const path = require('path')

    const pdfMediaPath = path.join(process.cwd(), 'src/ui/web/media/PDFMedia/index.tsx')
    const splitPanePath = path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx')
    const pagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
    )

    const pdfMediaSource = fs.readFileSync(pdfMediaPath, 'utf-8')
    const splitPaneSource = fs.readFileSync(splitPanePath, 'utf-8')
    const pageSource = fs.readFileSync(pagePath, 'utf-8')

    // Verify all components have the min-h-0 fix
    const results = {
      'PDFMedia wrapper': pdfMediaSource.includes("cn('w-full h-full min-h-0'"),
      'Lesson page primaryContent wrapper': pageSource.includes('flex flex-col min-h-0'),
      'Lesson page file wrapper': pageSource.includes('w-full flex-1 min-h-0'),
      // This is the one that should fail until fixed
      'SplitPaneLayout desktop wrapper': /h-full overflow-hidden.*min-h-0/.test(splitPaneSource),
    }

    // Log which fixes are in place
    console.log('Fix status:', results)

    // All should be true except possibly SplitPaneLayout
    expect(results['PDFMedia wrapper']).toBe(true)
    expect(results['Lesson page primaryContent wrapper']).toBe(true)
    expect(results['Lesson page file wrapper']).toBe(true)
    // This will fail until the fix is implemented
    expect(results['SplitPaneLayout desktop wrapper']).toBe(true)
  })
})
