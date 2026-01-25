/**
 * Memory Extraction Service
 * Extracts important information from conversations to store as long-term memory
 */

import { logger } from '@/infra/utils/logger'
import { readFileSync } from 'fs'
import OpenAI from 'openai'
import { dirname, join } from 'path'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'
import { ChatRole } from './chat-message-role'
import type { Message } from './context-policy'
import { generateEmbeddings } from './embeddings'
import { logMaintenance } from './observability'
import { getOpenAIClient } from './openai-client'
import { findSimilarMemoryItem, type MemoryItem } from './vector-search'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load prompt from external file with safe fallback
let MEMORY_EXTRACTION_PROMPT: string = ''

try {
  const promptPath = join(__dirname, 'prompts/memory-extraction-system-prompt.md')
  MEMORY_EXTRACTION_PROMPT = readFileSync(promptPath, 'utf-8')
} catch (error: unknown) {
  logger.warn(
    { err: error, path: join(__dirname, 'prompts/memory-extraction-system-prompt.md') },
    '[MemoryExtraction] Failed to load prompt, using default',
  )

  try {
    const defaultPath = join(__dirname, 'prompts/memory-extraction-system-prompt.default.md')
    MEMORY_EXTRACTION_PROMPT = readFileSync(defaultPath, 'utf-8')
  } catch {
    MEMORY_EXTRACTION_PROMPT = [
      'You are a memory extraction assistant for an educational platform.',
      'Extract important information worth remembering.',
    ].join('\n')
  }
}

interface MemoryCandidate {
  type: 'preference' | 'decision' | 'fact' | 'open_loop' | 'profile' | 'constraint' | 'other'
  text: string
  importance: number
  scope: 'user' | 'conversation'
  reason: string
}

interface ExtractionResult {
  memories: MemoryCandidate[]
}

/**
 * Get OpenAI client for memory extraction (always uses getSecret via getOpenAIClient)
 */
async function getMemoryExtractionClient(payload: Payload): Promise<OpenAI> {
  if (!payload) {
    throw new Error('Payload instance required for memory extraction')
  }
  return getOpenAIClient(payload)
}

/**
 * Extract memory candidates from recent messages
 */
export async function extractMemoryCandidates(
  payload: Payload,
  recentMessages: Message[],
  existingSummary?: string,
): Promise<MemoryCandidate[]> {
  const messagesText = recentMessages
    .slice(-10)
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n')

  let userPrompt = `Recent messages:\n\n${messagesText}`
  if (existingSummary) {
    userPrompt = `Conversation summary:\n${existingSummary}\n\n---\n\n${userPrompt}`
  }

  try {
    const client = await getMemoryExtractionClient(payload)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const result: ExtractionResult = JSON.parse(response.choices[0].message.content || '{}')

    // Server-side filtering
    const filtered = (result.memories || []).filter((mem) => {
      if (mem.text.length < 10 || mem.text.length > 2000) return false
      if (mem.importance < 1 || mem.importance > 5) return false
      const validTypes = [
        'preference',
        'decision',
        'fact',
        'open_loop',
        'profile',
        'constraint',
        'other',
      ]
      return validTypes.includes(mem.type)
    })

    logger.info(
      { candidateCount: filtered.length },
      '[MemoryExtraction] Extracted memory candidates',
    )
    return filtered
  } catch (error) {
    logger.error({ err: error }, '[MemoryExtraction] Extraction failed')
    return []
  }
}

/**
 * Persist memory items with deduplication
 */
export async function persistMemoryItems(
  payload: Payload,
  userId: string,
  conversationId: string,
  candidates: MemoryCandidate[],
  sourceTimestamp: Date,
  sourceRole: ChatRole,
  contextKey?: string,
  contextLevel?: string,
): Promise<number> {
  if (candidates.length === 0) return 0

  // Access MongoDB directly for vector search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (payload.db as any).connection?.db

  if (!db) {
    logger.warn('[MemoryExtraction] MongoDB connection not available, skipping persistence')
    return 0
  }

  try {
    const texts = candidates.map((c) => c.text)
    const embeddingResults = await generateEmbeddings(payload, texts)

    const similarityChecks = embeddingResults.map((result, idx) =>
      findSimilarMemoryItem(db, userId, result.embedding, 0.9)
        .then((similar) => ({ candidate: candidates[idx], embedding: result.embedding, similar }))
        .catch(() => ({ candidate: candidates[idx], embedding: result.embedding, similar: null })),
    )

    const CONCURRENCY_LIMIT = 5
    const results: Array<{
      candidate: MemoryCandidate
      embedding: number[]
      similar: MemoryItem | null
    }> = []

    for (let i = 0; i < similarityChecks.length; i += CONCURRENCY_LIMIT) {
      const batch = similarityChecks.slice(i, i + CONCURRENCY_LIMIT)
      const batchResults = await Promise.all(batch)
      results.push(...batchResults)
    }

    let persisted = 0
    for (const { candidate, embedding, similar } of results) {
      try {
        if (similar) {
          await payload.update({
            collection: 'memory_items',
            id: similar._id.toString(),
            data: {
              text: candidate.text,
              importance: Math.max(similar.importance, candidate.importance),
              embedding,
              updatedAt: new Date().toISOString(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            overrideAccess: true,
          })
        } else {
          await payload.create({
            collection: 'memory_items',
            data: {
              userId,
              conversationId: candidate.scope === 'conversation' ? conversationId : undefined,
              type: candidate.type,
              text: candidate.text,
              embedding,
              importance: candidate.importance,
              status: 'active',
              contextKey: contextKey ?? 'global',
              contextLevel,
              source: {
                sourceConversationId: conversationId,
                sourceMessageTimestamp: sourceTimestamp.toISOString(),
                sourceMessageRole: sourceRole,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            overrideAccess: true,
          })
          persisted++
        }
      } catch (error) {
        logger.error(
          { err: error, candidate: candidate.text.slice(0, 50) },
          '[MemoryExtraction] Failed to persist',
        )
      }
    }

    logMaintenance({
      conversationId,
      operation: 'extraction',
      success: true,
      memoryItemsCreated: persisted,
    })
    return persisted
  } catch (error) {
    logger.error({ err: error, conversationId }, '[MemoryExtraction] Persistence failed')
    logMaintenance({
      conversationId,
      operation: 'extraction',
      success: false,
      error: String(error),
    })
    return 0
  }
}
