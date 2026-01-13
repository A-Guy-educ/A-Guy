/**
 * Document Memory Service
 * Creates memory items from extracted document content
 *
 * Features:
 * - Semantic chunking (respects 2000 char limit)
 * - Creates memory items with type='document'
 * - Highest importance (5) for source material
 * - Conversation-scoped isolation
 * - Background processing (non-blocking)
 */

import { logger } from '@/utilities/logger'
import type { Payload } from 'payload'
import { ChatRole } from './chat-message-role'
import { generateEmbeddings } from './embeddings'

const MAX_CHUNK_LENGTH = 2000
const MAX_CHUNKS_PER_DOCUMENT = 50
const CHUNK_OVERLAP = 100 // Overlap between chunks for context preservation

interface DocumentChunk {
  text: string
  chunkIndex: number
  sectionTitle?: string
  topics?: string[]
}

/**
 * Chunk structured content into memory-sized pieces
 * Respects section boundaries and 2000 char limit
 */
export function chunkDocumentContent(structuredContent: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = []

  // Split by sections (look for section markers like "## Section Title" or similar patterns)
  const sectionPattern = /(?:^|\n)(#{1,3}\s+.+?|Section\s+\d+[.:]\s+.+?|Chapter\s+\d+[.:]\s+.+?)/i
  const sections = structuredContent.split(sectionPattern).filter((s) => s.trim().length > 0)

  let currentChunk = ''
  let chunkIndex = 0
  let currentSectionTitle: string | undefined

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]

    // Check if this is a section title
    if (section.match(sectionPattern)) {
      currentSectionTitle = section.replace(/^#+\s+/, '').trim()
      continue
    }

    // Try to add section to current chunk
    if (currentChunk.length + section.length + 1 <= MAX_CHUNK_LENGTH) {
      // Fits in current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + section
      } else {
        currentChunk = section
      }
    } else {
      // Doesn't fit - save current chunk and start new one
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          sectionTitle: currentSectionTitle,
        })

        if (chunkIndex >= MAX_CHUNKS_PER_DOCUMENT) {
          logger.warn(
            { totalChunks: chunkIndex, maxChunks: MAX_CHUNKS_PER_DOCUMENT },
            'Document exceeds max chunks limit',
          )
          break
        }
      }

      // Start new chunk with overlap from previous
      const overlapText =
        currentChunk.length > CHUNK_OVERLAP
          ? currentChunk.slice(-CHUNK_OVERLAP)
          : currentChunk

      // If section itself is too long, split it further
      if (section.length > MAX_CHUNK_LENGTH) {
        // Split long section by sentences
        const sentences = section.split(/([.!?]\s+)/)
        currentChunk = overlapText ? overlapText + '\n\n' : ''

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= MAX_CHUNK_LENGTH) {
            currentChunk += sentence
          } else {
            if (currentChunk.trim()) {
              chunks.push({
                text: currentChunk.trim(),
                chunkIndex: chunkIndex++,
                sectionTitle: currentSectionTitle,
              })

              if (chunkIndex >= MAX_CHUNKS_PER_DOCUMENT) {
                break
              }
            }
            currentChunk = sentence
          }
        }
      } else {
        currentChunk = (overlapText ? overlapText + '\n\n' : '') + section
      }
    }
  }

  // Add final chunk
  if (currentChunk.trim() && chunkIndex < MAX_CHUNKS_PER_DOCUMENT) {
    chunks.push({
      text: currentChunk.trim(),
      chunkIndex: chunkIndex,
      sectionTitle: currentSectionTitle,
    })
  }

  // Validate chunk lengths
  for (const chunk of chunks) {
    if (chunk.text.length > MAX_CHUNK_LENGTH) {
      logger.warn(
        { chunkIndex: chunk.chunkIndex, length: chunk.text.length, maxLength: MAX_CHUNK_LENGTH },
        'Chunk exceeds max length, truncating',
      )
      chunk.text = chunk.text.substring(0, MAX_CHUNK_LENGTH)
    }
  }

  return chunks
}

/**
 * Create memory items from document chunks
 * Returns number of memory items created
 */
export async function createDocumentMemories(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
  fileName: string,
  chunks: DocumentChunk[],
  sourceTimestamp: Date,
): Promise<number> {
  if (chunks.length === 0) {
    return 0
  }

  try {
    // Check if document memories already exist for this conversation
    const existingMemories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: userId } },
          { conversationId: { equals: conversationId } },
          { type: { equals: 'document' } },
        ],
      },
      limit: 1,
      overrideAccess: true, // Server-side check
    })

    if (existingMemories.docs.length > 0) {
      logger.debug({ conversationId }, 'Document memories already exist, skipping creation')
      return 0
    }

    // Generate embeddings for all chunks in batch
    const texts = chunks.map((chunk) => chunk.text)
    const embeddingResults = await generateEmbeddings(texts)

    // Create memory items
    let created = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddingResults[i]?.embedding

      if (!embedding) {
        logger.warn({ chunkIndex: chunk.chunkIndex }, 'Failed to generate embedding for chunk')
        continue
      }

      try {
        await payload.create({
          collection: 'memory_items',
          data: {
            userId,
            conversationId,
            type: 'document',
            text: chunk.text,
            embedding,
            importance: 5, // Highest importance for source material
            status: 'active',
            source: {
              sourceConversationId: conversationId,
              sourceMessageTimestamp: sourceTimestamp.toISOString(),
              sourceMessageRole: ChatRole.Assistant, // Document extraction triggered by system
              lessonId: lessonId,
              fileName: fileName,
              chunkIndex: chunk.chunkIndex,
              sectionTitle: chunk.sectionTitle,
              topics: chunk.topics?.map((topic) => ({ topic })) || [],
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true, // Server-side write
        })

        created++
        logger.debug(
          {
            chunkIndex: chunk.chunkIndex,
            textLength: chunk.text.length,
            sectionTitle: chunk.sectionTitle,
          },
          'Created document memory item',
        )
      } catch (error) {
        logger.error(
          { err: error, chunkIndex: chunk.chunkIndex },
          'Failed to create document memory item',
        )
        // Continue with other chunks
      }
    }

    logger.info(
      {
        conversationId,
        lessonId,
        fileName,
        totalChunks: chunks.length,
        created,
      },
      'Document memories created',
    )

    return created
  } catch (error) {
    logger.error(
      { err: error, conversationId, lessonId, fileName },
      'Failed to create document memories',
    )
    return 0
  }
}

/**
 * Check if conversation already has document memories
 */
export async function hasDocumentMemories(
  payload: Payload,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  try {
    const result = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: userId } },
          { conversationId: { equals: conversationId } },
          { type: { equals: 'document' } },
        ],
      },
      limit: 1,
      overrideAccess: true, // Server-side check
    })

    return result.docs.length > 0
  } catch (error) {
    logger.error({ err: error, conversationId }, 'Failed to check for document memories')
    return false
  }
}
