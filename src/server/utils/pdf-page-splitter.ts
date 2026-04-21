/**
 * PDF Page Splitter Utility
 *
 * Splits a multi-page PDF buffer into individual single-page PDF buffers.
 * Used for iterative page-by-page processing in the Convert Context pipeline.
 *
 * @fileType utility
 * @domain conversion
 * @pattern pdf-processing
 */
import { PDFDocument } from 'pdf-lib'

/**
 * Split a PDF buffer into an array of single-page PDF buffers.
 *
 * @param buffer - The full PDF file as a Buffer
 * @returns An array of Buffers, each containing a single-page PDF
 */
export async function splitPdfIntoPages(buffer: Buffer): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const pages: Buffer[] = []

  for (let i = 0; i < pageCount; i++) {
    const singlePageDoc = await PDFDocument.create()
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i])
    singlePageDoc.addPage(copiedPage)
    const pdfBytes = await singlePageDoc.save()
    pages.push(Buffer.from(pdfBytes))
  }

  return pages
}
