/**
 * AI Document Extractor Service
 * Extracts structured content from PDF documents using Claude
 *
 * Features:
 * - PDF text extraction using pdf-parse
 * - AI-powered structuring using Claude
 * - Preserves document hierarchy (sections, topics)
 * - Handles diagrams and educational content
 * - Timeout protection (30s max per PDF)
 * - Error handling with graceful degradation
 */

import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'
import { logger } from '@/utilities/logger'
import { getCachedExtraction, getFileHash, setCachedExtraction } from '../extraction-cache'

const EXTRACTION_TIMEOUT_MS = 30 * 1000 // 30 seconds

// Lazy initialization to avoid errors at module load time
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

export interface StructuredContent {
  content: string
  sections?: Array<{
    title: string
    content: string
    topics?: string[]
  }>
}

export interface ExtractionResult {
  success: boolean
  structuredContent?: string
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    fileSizeBytes: number
    cached: boolean
  }
}

/**
 * Extract structured content from PDF using Claude with vision
 * Returns plain text content with preserved structure
 */
export async function extractDocumentContent(
  pdfBuffer: Buffer,
  fileName: string,
): Promise<ExtractionResult> {
  const startTime = Date.now()
  const fileHash = getFileHash(pdfBuffer)

  // Check cache first
  const cached = getCachedExtraction(fileHash)
  if (cached) {
    return {
      success: true,
      structuredContent: cached,
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        processingTimeMs: Date.now() - startTime,
        fileSizeBytes: pdfBuffer.length,
        cached: true,
      },
    }
  }

  try {
    const client = getAnthropicClient()

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Extraction timeout after 30 seconds'))
      }, EXTRACTION_TIMEOUT_MS)
    })

    // Extract text from PDF first
    let rawText: string
    try {
      // Convert Buffer to Uint8Array for PDFParse
      const uint8Array = new Uint8Array(pdfBuffer)
      const pdfParser = new PDFParse({ data: uint8Array })
      const textResult = await pdfParser.getText()
      rawText = textResult.text

      if (!rawText || rawText.trim().length < 50) {
        logger.warn({ fileName, textLength: rawText?.length }, 'PDF parsing returned minimal text')
        return {
          success: false,
          error: 'PDF contains no extractable text content',
          metadata: {
            model: 'claude-3-5-sonnet-20241022',
            processingTimeMs: Date.now() - startTime,
            fileSizeBytes: pdfBuffer.length,
            cached: false,
          },
        }
      }
    } catch (parseError) {
      logger.error({ err: parseError, fileName }, 'PDF parsing failed')
      return {
        success: false,
        error: `PDF parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        metadata: {
          model: 'claude-3-5-sonnet-20241022',
          processingTimeMs: Date.now() - startTime,
          fileSizeBytes: pdfBuffer.length,
          cached: false,
        },
      }
    }

    // Structure the extracted text using Claude
    const structuringPrompt = `Extract and structure the content from this educational document. Preserve the document structure including:

- Section titles and headings
- Paragraph content
- Lists and bullet points
- Mathematical formulas (preserve as LaTeX if possible)
- Key concepts and topics

Return the content as structured plain text, maintaining the original hierarchy. Group related content by sections when possible.

Format the output with clear section markers (use ## for main sections, ### for subsections). For each section, include:
- Section title (if present)
- All text content in that section
- Any important topics or concepts covered

Document content:
${rawText.substring(0, 100000)}${rawText.length > 100000 ? '\n\n[... content truncated ...]' : ''}`

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: structuringPrompt,
          },
        ],
      }),
      timeoutPromise,
    ])

    const structuredContent =
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n\n') || ''

    if (!structuredContent || structuredContent.trim().length < 50) {
      logger.warn({ fileName, contentLength: structuredContent.length }, 'Claude returned minimal content')
      return {
        success: false,
        error: 'Extracted content too short or empty',
        metadata: {
          model: 'claude-3-5-sonnet-20241022',
          processingTimeMs: Date.now() - startTime,
          fileSizeBytes: pdfBuffer.length,
          cached: false,
        },
      }
    }

    // Cache the result
    setCachedExtraction(fileHash, structuredContent)

    const processingTimeMs = Date.now() - startTime

    logger.info(
      {
        fileName,
        fileSizeBytes: pdfBuffer.length,
        contentLength: structuredContent.length,
        processingTimeMs,
      },
      'Document extraction successful',
    )

    return {
      success: true,
      structuredContent,
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        processingTimeMs,
        fileSizeBytes: pdfBuffer.length,
        cached: false,
      },
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime

    logger.error(
      {
        err: error,
        fileName,
        fileSizeBytes: pdfBuffer.length,
        processingTimeMs,
      },
      'Document extraction failed',
    )

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during extraction',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        processingTimeMs,
        fileSizeBytes: pdfBuffer.length,
        cached: false,
      },
    }
  }
}
