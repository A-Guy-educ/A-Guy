/**
 * Document Memory Service
 * Creates and manages document-type memory items from PDF content
 *
 * Features:
 * - Batch embedding generation
 * - Deduplication check (prevent duplicate memories)
 * - Type-safe memory item creation with document metadata
 */

import { logger } from '@/utilities/logger'
import type { Payload } from 'payload'
import { generateEmbeddings } from './embeddings'

export interface DocumentChunk {
  text: string
  chunkIndex: number
}

/**
 * Check if document memories already exist for a conversation
 */
export async function hasDocumentMemories(
  payload: Payload,
  conversationId: string,
): Promise<boolean> {
  try {
    const existing = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { conversationId: { equals: conversationId } },
          { type: { equals: 'document' } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
    })

    return existing.docs.length > 0
  } catch (error) {
    logger.error({ err: error, conversationId }, 'Failed to check for existing document memories')
    return false // Fail safe: assume no memories exist
  }
}

/**
 * Create document memory items from text chunks
 * @returns Number of memory items created
 */
export async function createDocumentMemories(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
  chunks: string[],
  fileName: string,
): Promise<number> {
  if (chunks.length === 0) {
    return 0
  }

  // Check if memories already exist
  const alreadyExists = await hasDocumentMemories(payload, conversationId)
  if (alreadyExists) {
    logger.debug({ conversationId }, 'Document memories already exist, skipping creation')
    return 0
  }

  try {
    // Generate embeddings for all chunks in batch
    const embeddingResults = await generateEmbeddings(chunks)

    // Create memory items
    let created = 0
    const sourceTimestamp = new Date()

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddingResults[i]?.embedding

      if (!embedding) {
        logger.warn({ chunkIndex: i, fileName }, 'Failed to generate embedding for chunk, skipping')
        continue
      }

      try {
        await payload.create({
          collection: 'memory_items',
          data: {
            userId,
            conversationId,
            type: 'document',
            text: chunk,
            embedding,
            importance: 5, // Highest importance for source material
            status: 'active',
            source: {
              sourceConversationId: conversationId,
              sourceMessageTimestamp: sourceTimestamp.toISOString(),
              sourceMessageRole: 'assistant',
              lessonId,
              fileName,
              chunkIndex: i,
            },
            overrideAccess: true, // Server-side write
          } as any,
        })

        created++
      } catch (error) {
        logger.error(
          { err: error, chunkIndex: i, fileName },
          'Failed to create document memory item',
        )
        // Continue with other chunks even if one fails
      }
    }

    logger.info(
      { conversationId, fileName, created, total: chunks.length },
      'Created document memory items',
    )

    return created
  } catch (error) {
    logger.error(
      { err: error, conversationId, fileName },
      'Failed to create document memories, will retry in background',
    )
    // Return 0 to indicate failure, but don't throw (graceful degradation)
    return 0
  }
}
