/**
 * Integration tests for V2 PDF Rendering and Vision Detection
 *
 * Tests:
 * - renderAllPages successfully renders PDF pages without Buffer rejection
 * - pdfjs-dist v4.x compatibility with Uint8Array conversion
 * - PageImage returns integer dimensions
 */

import { describe, it, expect } from 'vitest'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Helper to create a minimal test PDF buffer
async function createTestPdfBuffer(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size: 8.5 x 11 inches
  const { height } = page.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  page.drawText('Test Exercise Page', {
    x: 50,
    y: height - 50,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  })

  page.drawRectangle({
    x: 50,
    y: height - 200,
    width: 200,
    height: 100,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

describe('V2 PDF Render Service', () => {
  describe('renderAllPages', () => {
    it('should successfully render a single-page PDF', async () => {
      const pdfBuffer = await createTestPdfBuffer()

      const { renderAllPages } =
        await import('@/server/services/exercise-conversion/v2/pdf-render-service')

      const pages = await renderAllPages(pdfBuffer)

      expect(pages).toHaveLength(1)
      expect(pages[0].buffer).toBeDefined()
      expect(pages[0].width).toBeGreaterThan(0)
      expect(pages[0].height).toBeGreaterThan(0)
    })

    it('should return integer dimensions', async () => {
      const pdfBuffer = await createTestPdfBuffer()

      const { renderAllPages } =
        await import('@/server/services/exercise-conversion/v2/pdf-render-service')

      const pages = await renderAllPages(pdfBuffer)

      expect(Number.isInteger(pages[0].width)).toBe(true)
      expect(Number.isInteger(pages[0].height)).toBe(true)
    })

    it('should render all pages from multi-page PDF', async () => {
      const pdfDoc = await PDFDocument.create()

      for (let i = 0; i < 3; i++) {
        const page = pdfDoc.addPage([612, 792])
        page.drawText(`Page ${i + 1}`, {
          x: 50,
          y: 700,
          size: 24,
          font: await pdfDoc.embedFont(StandardFonts.Helvetica),
          color: rgb(0, 0, 0),
        })
      }

      const pdfBytes = await pdfDoc.save()
      const pdfBuffer = Buffer.from(pdfBytes)

      const { renderAllPages } =
        await import('@/server/services/exercise-conversion/v2/pdf-render-service')

      const pages = await renderAllPages(pdfBuffer)

      expect(pages).toHaveLength(3)
      for (const page of pages) {
        expect(page.width).toBeGreaterThan(0)
        expect(page.height).toBeGreaterThan(0)
      }
    })

    it('should return valid PNG buffers with correct magic bytes', async () => {
      const pdfBuffer = await createTestPdfBuffer()

      const { renderAllPages } =
        await import('@/server/services/exercise-conversion/v2/pdf-render-service')

      const pages = await renderAllPages(pdfBuffer)

      // PNG magic bytes: 0x89 0x50 0x4E 0x47
      expect(pages[0].buffer[0]).toBe(0x89)
      expect(pages[0].buffer[1]).toBe(0x50)
      expect(pages[0].buffer[2]).toBe(0x4e)
      expect(pages[0].buffer[3]).toBe(0x47)
    })
  })
})

describe('V2 Uint8Array Conversion Pattern', () => {
  it('should correctly convert Buffer to Uint8Array', () => {
    const originalBuffer = Buffer.from([1, 2, 3, 4, 5])
    const uint8Array = new Uint8Array(originalBuffer)

    expect(uint8Array.length).toBe(5)
    expect(uint8Array[0]).toBe(1)
    expect(uint8Array[4]).toBe(5)
  })

  it('should preserve all bytes when converting large buffers', async () => {
    const pdfDoc = await PDFDocument.create()
    for (let i = 0; i < 10; i++) {
      const page = pdfDoc.addPage([612, 792])
      page.drawText(`Page ${i + 1} with more content to make the buffer larger`, {
        x: 50,
        y: 700 - i * 20,
        size: 12,
        font: await pdfDoc.embedFont(StandardFonts.Helvetica),
        color: rgb(0, 0, 0),
      })
    }
    const pdfBytes = await pdfDoc.save()
    const buffer = Buffer.from(pdfBytes)

    const uint8Array = new Uint8Array(buffer)

    expect(uint8Array.length).toBe(buffer.length)

    for (let i = 0; i < buffer.length; i++) {
      expect(uint8Array[i]).toBe(buffer[i])
    }
  })
})
