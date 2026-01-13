/**
 * PDF Extraction Service
 * Extracts text from PDF files and chunks it for memory storage
 *
 * Features:
 * - Text extraction from PDF buffers
 * - Sentence-boundary chunking (max 2000 chars per chunk)
 * - Error handling for corrupted/empty PDFs
 * - Buffer caching support
 */

import { logger } from '@/utilities/logger'
import { PDFParse } from 'pdf-parse'

export interface ExtractTextOptions {
  pdfBuffer: Buffer
}

export interface ChunkedText {
  text: string
  chunkIndex: number
}

/**
 * Extract text from PDF buffer
 * @throws Error if PDF is corrupted or unreadable
 */
export async function extractTextFromPDF(options: ExtractTextOptions): Promise<string> {
  const { pdfBuffer } = options

  try {
    // Convert Buffer to Uint8Array for PDFParse
    const data = new Uint8Array(pdfBuffer)
    const parser = new PDFParse({ data })
    const textResult = await parser.getText()
    const text = textResult.text || ''
    
    // Clean up parser resources
    await parser.destroy()
    
    if (text.trim().length === 0) {
      logger.warn('PDF contains no extractable text')
      return ''
    }

    return text
  } catch (error) {
    logger.error({ err: error }, 'PDF extraction failed')
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Chunk text into segments respecting 2000 char limit
 * Uses sentence boundaries to avoid mid-sentence splits
 */
export function chunkText(text: string, maxChunkSize: number = 2000): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let currentChunk = ''
  
  // Split by sentence boundaries (period, exclamation, question mark)
  const sentences = text.split(/([.!?]\s+)/)
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const nextSeparator = i + 1 < sentences.length ? sentences[i + 1] : ''
    const fullSentence = sentence + nextSeparator
    
    // If adding this sentence would exceed limit, finalize current chunk
    if (currentChunk.length + fullSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = fullSentence
    } else {
      currentChunk += fullSentence
    }
    
    // Skip the separator in next iteration
    if (nextSeparator) {
      i++
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  // Safety: if any chunk is still too large, force split at word boundaries
  const finalChunks: string[] = []
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk)
    } else {
      // Force split at word boundaries
      let remaining = chunk
      while (remaining.length > maxChunkSize) {
        const splitPoint = remaining.lastIndexOf(' ', maxChunkSize)
        if (splitPoint > 0) {
          finalChunks.push(remaining.substring(0, splitPoint))
          remaining = remaining.substring(splitPoint + 1)
        } else {
          // No space found, force split at maxChunkSize
          finalChunks.push(remaining.substring(0, maxChunkSize))
          remaining = remaining.substring(maxChunkSize)
        }
      }
      if (remaining.length > 0) {
        finalChunks.push(remaining)
      }
    }
  }
  
  return finalChunks
}
