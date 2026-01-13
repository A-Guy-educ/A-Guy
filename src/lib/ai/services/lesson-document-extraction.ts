/**
 * Lesson Document Extraction Service
 * Orchestrates PDF extraction and memory creation for lesson conversations
 *
 * Features:
 * - Downloads PDFs from Vercel Blob storage
 * - Extracts and chunks text
 * - Creates document memories asynchronously
 * - Graceful error handling
 */

import { logger } from '@/utilities/logger'
import { createDocumentMemories, hasDocumentMemories } from '@/lib/ai/document-memory-service'
import { chunkText, extractTextFromPDF } from '@/lib/ai/services/pdf-extractor-service'
import type { Payload } from 'payload'
import type { Lesson, Media } from '@/payload-types'

/**
 * Extract and store document memories from lesson PDFs
 * Runs asynchronously in background (non-blocking)
 */
export async function extractAndStoreLessonDocuments(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
): Promise<void> {
  try {
    // Check if memories already exist
    const alreadyExists = await hasDocumentMemories(payload, conversationId)
    if (alreadyExists) {
      logger.debug({ conversationId }, 'Document memories already exist, skipping extraction')
      return
    }

    // Fetch lesson with contentFiles
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 2, // Populate contentFiles
    })) as Lesson

    if (!lesson.contentFiles || lesson.contentFiles.length === 0) {
      logger.info({ lessonId }, 'No PDF documents found for lesson')
      return
    }

    // Filter for PDF files only
    const pdfFiles = lesson.contentFiles.filter((file) => {
      if (typeof file === 'string') return false
      const media = file as Media
      const mimeType = media.mimeType || ''
      const filename = media.filename || ''
      return mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
    }) as Media[]

    if (pdfFiles.length === 0) {
      logger.info({ lessonId }, 'No PDF documents found in lesson contentFiles')
      return
    }

    // Process each PDF
    for (const pdfFile of pdfFiles) {
      try {
        await processPDFFile(payload, userId, conversationId, lessonId, pdfFile)
      } catch (error) {
        logger.error(
          { err: error, fileName: pdfFile.filename, lessonId },
          'Failed to process PDF file, continuing with other files',
        )
        // Continue with other PDFs even if one fails
      }
    }
  } catch (error) {
    logger.error(
      { err: error, conversationId, lessonId },
      'Document extraction failed, chat continues without document context',
    )
    // Don't throw - graceful degradation
  }
}

/**
 * Process a single PDF file: download, extract, chunk, and store
 */
async function processPDFFile(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
  pdfFile: Media,
): Promise<void> {
  const fileName = pdfFile.filename || 'unknown.pdf'

  try {
    // Download PDF from Vercel Blob
    const url = pdfFile.url
    if (!url) {
      logger.warn({ fileName }, 'PDF file has no URL, skipping')
      return
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`)
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer())

    // Extract text
    const text = await extractTextFromPDF({ pdfBuffer })

    if (text.trim().length === 0) {
      logger.warn({ fileName }, 'PDF contains no extractable text')
      return
    }

    // Chunk text
    const chunks = chunkText(text)

    if (chunks.length === 0) {
      logger.warn({ fileName }, 'No chunks created from PDF text')
      return
    }

    // Create document memories
    const created = await createDocumentMemories(
      payload,
      userId,
      conversationId,
      lessonId,
      chunks,
      fileName,
    )

    logger.info(
      { conversationId, fileName, created, totalChunks: chunks.length },
      'Document memories created from PDF',
    )
  } catch (error) {
    logger.error({ err: error, fileName }, 'Failed to process PDF file')
    throw error // Re-throw to be caught by caller
  }
}
