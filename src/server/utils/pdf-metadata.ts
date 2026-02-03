/**
 * PDF metadata extraction utilities using pdf-lib
 * Serverless-compatible - no worker threads, no external dependencies
 */

import { PDFDocument } from 'pdf-lib'

export interface PdfMetadata {
  pageCount: number
  title?: string
  author?: string
}

/**
 * Extract metadata from a PDF buffer using pdf-lib
 * Serverless-compatible for Vercel and other serverless platforms
 */
export async function getPdfMetadata(pdfBuffer: Buffer): Promise<PdfMetadata> {
  // Convert Buffer to Uint8Array for pdf-lib compatibility
  const uint8Array = new Uint8Array(pdfBuffer)

  const pdf = await PDFDocument.load(uint8Array, {
    ignoreEncryption: true,
    updateMetadata: false,
  })

  const title = pdf.getTitle() || undefined
  const author = pdf.getAuthor() || undefined

  return {
    pageCount: pdf.getPageCount(),
    title,
    author,
  }
}

/**
 * Get page count from a PDF buffer
 * Lightweight wrapper for segmentation use case
 */
export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  const metadata = await getPdfMetadata(pdfBuffer)
  return metadata.pageCount
}
