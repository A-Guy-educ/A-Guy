/**
 * Tests for PDF segmentation using pdf-lib
 * Serverless-compatible solution for Vercel
 *
 * @see src/server/utils/pdf-metadata.ts
 * @see src/server/payload/jobs/pdf-to-exercises-task.ts
 */
import { getPageCount, getPdfMetadata } from '@/server/utils/pdf-metadata'
import { describe, expect, it } from 'vitest'

describe('PDF Metadata with pdf-lib', () => {
  // Minimal valid PDF for testing (1 page)
  const createMinimalPdf = () =>
    Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
196
%%EOF`)

  // Multi-page PDF for segmentation testing
  const createMultiPagePdf = (pageCount: number) => {
    let pdfContent = '%PDF-1.4\n'
    pdfContent += '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'

    const pageRefs: string[] = []
    let objectNum = 3

    for (let i = 0; i < pageCount; i++) {
      pageRefs.push(`${objectNum} 0 R`)
      pdfContent += `${objectNum} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n`
      objectNum++
    }

    pdfContent += `2 0 obj << /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageCount} >> endobj\n`

    pdfContent += `xref\n0 ${objectNum}\n`
    pdfContent += '0000000000 65535 f\n'

    for (let i = 1; i < objectNum; i++) {
      pdfContent += `000000000${i < 10 ? '0' + i : i} 00000 n\n`
    }

    pdfContent += `trailer << /Size ${objectNum} /Root 1 0 R >>\n`
    pdfContent += `startxref\n${pdfContent.length + 50}\n`
    pdfContent += '%%EOF'

    return Buffer.from(pdfContent)
  }

  it('should load pdf-lib and extract page count', async () => {
    const pdfBuffer = createMinimalPdf()
    const pageCount = await getPageCount(pdfBuffer)

    expect(pageCount).toBe(1)
  })

  it('should extract full metadata', async () => {
    const pdfBuffer = createMinimalPdf()
    const metadata = await getPdfMetadata(pdfBuffer)

    expect(metadata).toBeDefined()
    expect(metadata.pageCount).toBe(1)
    expect(metadata.title).toBeUndefined()
    expect(metadata.author).toBeUndefined()
  })

  it('should segment single-page PDF correctly', async () => {
    const pdfBuffer = createMinimalPdf()
    const pageCount = await getPageCount(pdfBuffer)

    const maxPagesPerSegment = 5
    const segments: { pageStart: number; pageEnd: number; pageCount: number }[] = []

    for (let start = 1; start <= pageCount; start += maxPagesPerSegment) {
      const end = Math.min(start + maxPagesPerSegment - 1, pageCount)
      segments.push({ pageStart: start, pageEnd: end, pageCount: end - start + 1 })
    }

    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({ pageStart: 1, pageEnd: 1, pageCount: 1 })
  })

  it('should segment multi-page PDF correctly', async () => {
    const pageCount = 12
    const pdfBuffer = createMultiPagePdf(pageCount)
    const actualPageCount = await getPageCount(pdfBuffer)

    expect(actualPageCount).toBe(pageCount)

    const maxPagesPerSegment = 5
    const segments: { pageStart: number; pageEnd: number; pageCount: number }[] = []

    for (let start = 1; start <= actualPageCount; start += maxPagesPerSegment) {
      const end = Math.min(start + maxPagesPerSegment - 1, actualPageCount)
      segments.push({ pageStart: start, pageEnd: end, pageCount: end - start + 1 })
    }

    expect(segments).toHaveLength(3)
    expect(segments[0]).toEqual({ pageStart: 1, pageEnd: 5, pageCount: 5 })
    expect(segments[1]).toEqual({ pageStart: 6, pageEnd: 10, pageCount: 5 })
    expect(segments[2]).toEqual({ pageStart: 11, pageEnd: 12, pageCount: 2 })
  })

  it('should handle edge case of exactly max pages per segment', async () => {
    const pageCount = 10
    const pdfBuffer = createMultiPagePdf(pageCount)
    const actualPageCount = await getPageCount(pdfBuffer)

    const maxPagesPerSegment = 5
    const segments: { pageStart: number; pageEnd: number; pageCount: number }[] = []

    for (let start = 1; start <= actualPageCount; start += maxPagesPerSegment) {
      const end = Math.min(start + maxPagesPerSegment - 1, actualPageCount)
      segments.push({ pageStart: start, pageEnd: end, pageCount: end - start + 1 })
    }

    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ pageStart: 1, pageEnd: 5, pageCount: 5 })
    expect(segments[1]).toEqual({ pageStart: 6, pageEnd: 10, pageCount: 5 })
  })
})
