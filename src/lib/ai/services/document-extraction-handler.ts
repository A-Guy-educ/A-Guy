/**
 * Document Extraction Handler
 * Handles automatic document extraction for lesson conversations
 *
 * Triggered on first message in a lesson conversation
 * Runs asynchronously to avoid blocking chat response
 */

import { logger } from '@/utilities/logger'
import type { Media } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'
import { extractDocumentContent } from './ai-document-extractor'
import { chunkDocumentContent, createDocumentMemories, hasDocumentMemories } from '../document-memory-service'

/**
 * Extract and store document memories for a lesson conversation
 * Runs asynchronously (non-blocking)
 */
export async function handleDocumentExtraction(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
  req: PayloadRequest,
): Promise<void> {
  const reqLogger = logger.child({ conversationId, lessonId, userId })

  try {
    // Check if document memories already exist
    const hasMemories = await hasDocumentMemories(payload, userId, conversationId)
    if (hasMemories) {
      reqLogger.debug('Document memories already exist, skipping extraction')
      return
    }

    // Fetch lesson with contentFiles
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 1,
      user: req.user,
      overrideAccess: false,
    })

    if (!lesson) {
      reqLogger.warn('Lesson not found')
      return
    }

    const contentFiles = lesson.contentFiles as (Media | string)[] | null | undefined
    if (!contentFiles || contentFiles.length === 0) {
      reqLogger.info('No content files found for lesson')
      return
    }

    // Filter for PDF files only
    const pdfFiles = contentFiles
      .filter((file): file is Media => typeof file !== 'string' && file !== null)
      .filter((file) => {
        const mimeType = file.mimeType || ''
        return mimeType === 'application/pdf' || file.filename?.toLowerCase().endsWith('.pdf')
      })

    if (pdfFiles.length === 0) {
      reqLogger.info('No PDF files found in lesson contentFiles')
      return
    }

    reqLogger.info({ pdfCount: pdfFiles.length }, 'Processing PDF files for extraction')

    // Process each PDF file
    for (const pdfFile of pdfFiles) {
      if (!pdfFile.url) {
        reqLogger.warn({ fileName: pdfFile.filename }, 'PDF file has no URL')
        continue
      }

      try {
        // Fetch PDF from storage
        let pdfUrl: string
        const isAbsolute = pdfFile.url.startsWith('http')

        if (isAbsolute) {
          pdfUrl = pdfFile.url
        } else {
          // Build absolute URL from request origin
          const requestUrl = new URL(req.url || 'http://localhost:3000')
          const origin = `${requestUrl.protocol}//${requestUrl.host}`
          pdfUrl = `${origin}${pdfFile.url}`
        }

        // Fetch PDF buffer
        const fetchOptions: RequestInit = {}
        if (!isAbsolute) {
          const cookieHeader = req.headers.get('cookie')
          if (cookieHeader) {
            fetchOptions.headers = { cookie: cookieHeader }
          }
        }

        const pdfResponse = await fetch(pdfUrl, fetchOptions)
        if (!pdfResponse.ok) {
          reqLogger.warn(
            { fileName: pdfFile.filename, status: pdfResponse.status },
            'Failed to fetch PDF file',
          )
          continue
        }

        const arrayBuffer = await pdfResponse.arrayBuffer()
        const pdfBuffer = Buffer.from(arrayBuffer)

        // Extract structured content
        const extractionResult = await extractDocumentContent(pdfBuffer, pdfFile.filename || 'unknown.pdf')

        if (!extractionResult.success || !extractionResult.structuredContent) {
          reqLogger.warn(
            {
              fileName: pdfFile.filename,
              error: extractionResult.error,
            },
            'Document extraction failed or returned minimal content',
          )
          continue
        }

        // Chunk the content
        const chunks = chunkDocumentContent(extractionResult.structuredContent)

        if (chunks.length === 0) {
          reqLogger.warn({ fileName: pdfFile.filename }, 'No chunks created from extracted content')
          continue
        }

        // Create memory items
        const created = await createDocumentMemories(
          payload,
          userId,
          conversationId,
          lessonId,
          pdfFile.filename || 'unknown.pdf',
          chunks,
          new Date(),
        )

        reqLogger.info(
          {
            fileName: pdfFile.filename,
            chunksCreated: created,
            totalChunks: chunks.length,
          },
          'Document extraction completed',
        )
      } catch (error) {
        reqLogger.error(
          { err: error, fileName: pdfFile.filename },
          'Error processing PDF file',
        )
        // Continue with next file
      }
    }
  } catch (error) {
    reqLogger.error({ err: error }, 'Document extraction handler failed')
    // Don't throw - allow chat to continue without document context
  }
}
