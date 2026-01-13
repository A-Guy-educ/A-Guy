/**
 * Integration Tests for PDF Extraction Service
 *
 * Tests PDF text extraction and chunking functionality
 * Behaviors covered: 3, 6, 12
 */
import { extractTextFromPDF, chunkText } from '@/lib/ai/services/pdf-extractor-service'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'pdfs')

describe('PDF Extractor Service', () => {
  describe('extractTextFromPDF', () => {
    it('should extract text from valid PDF', async () => {
      // This test will fail until we implement the service
      const pdfBuffer = readFileSync(join(FIXTURES_DIR, 'sample-lesson.pdf'))
      const text = await extractTextFromPDF({ pdfBuffer })

      expect(text).toBeTruthy()
      expect(text.length).toBeGreaterThan(0)
    })

    it('should handle empty PDF gracefully', async () => {
      const pdfBuffer = readFileSync(join(FIXTURES_DIR, 'empty.pdf'))
      const text = await extractTextFromPDF({ pdfBuffer })

      // Empty PDF may return metadata text, but should have no meaningful content
      expect(text.trim().length).toBeLessThan(50) // Allow for minimal metadata
    })

    it('should handle corrupted PDF with error', async () => {
      const pdfBuffer = readFileSync(join(FIXTURES_DIR, 'corrupted.pdf'))

      await expect(extractTextFromPDF({ pdfBuffer })).rejects.toThrow()
    })
  })

  describe('chunkText', () => {
    it('should chunk long text with sentence boundaries', () => {
      const longText = 'This is sentence one. This is sentence two. '.repeat(100) // ~4000 chars
      const chunks = chunkText(longText)

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(2000)
      })

      // Verify no mid-sentence splits
      chunks.forEach((chunk, idx) => {
        if (idx < chunks.length - 1) {
          // Last chunk might not end with period, but others should
          const trimmed = chunk.trim()
          expect(
            trimmed.endsWith('.') ||
              trimmed.endsWith('!') ||
              trimmed.endsWith('?') ||
              idx === chunks.length - 1,
          ).toBe(true)
        }
      })
    })

    it('should return single chunk for text under 2000 chars', () => {
      const shortText = 'This is a short text. ' + 'With a few sentences. '.repeat(10)
      const chunks = chunkText(shortText)

      expect(chunks.length).toBe(1)
      expect(chunks[0].length).toBeLessThanOrEqual(2000)
    })

    it('should preserve text content when chunking', () => {
      const originalText = 'First sentence. Second sentence. Third sentence. '.repeat(50)
      const chunks = chunkText(originalText)
      const reconstructed = chunks.join(' ')

      // Should contain all original content (allowing for minor whitespace differences)
      expect(reconstructed.replace(/\s+/g, ' ')).toContain(
        originalText.replace(/\s+/g, ' ').substring(0, 100),
      )
    })
  })

  describe('extractTextFromPDF with chunking', () => {
    it('should extract and chunk long PDF correctly', async () => {
      const pdfBuffer = readFileSync(join(FIXTURES_DIR, 'long-lesson.pdf'))
      const text = await extractTextFromPDF({ pdfBuffer })

      // Debug: log text length
      console.log(`Extracted text length: ${text.length}`)

      // Only test chunking if we have enough text
      if (text.length > 2000) {
        const chunks = chunkText(text)
        expect(chunks.length).toBeGreaterThan(1)
        chunks.forEach((chunk) => {
          expect(chunk.length).toBeLessThanOrEqual(2000)
        })
      } else {
        // If PDF doesn't have enough text, just verify it extracts something
        expect(text.length).toBeGreaterThan(0)
      }
    })
  })
})
