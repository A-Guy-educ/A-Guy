/**
 * Memory Extraction Service
 * Extracts important information from conversations to store as long-term memory
 *
 * Key Features:
 * - AI-powered extraction of preferences, decisions, facts
 * - Server-side filtering for quality control
 * - Deduplication via vector similarity
 * - Selective storage (quality over quantity)
 */

import { logger } from '@/utilities/logger'
import { readFileSync } from 'fs'
import { OpenAI } from 'openai'
import { dirname, join } from 'path'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'
import { featureFlags } from '../feature-flags'
import { ChatRole } from './chat-message-role'
import type { Message } from './context-policy'
import { generateEmbeddings } from './embeddings'
import { logMaintenance } from './observability'
import { findSimilarMemoryItem, type MemoryItem } from './vector-search'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Lazy initialization to avoid errors at module load time
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true, // Safe in Node.js/test environment
    })
  }
  return openai
}

// Load prompt from external file with a safe fallback so that missing files
// do not crash the agent chat endpoint at module load time (e.g. in serverless environments).
// First tries to load the main prompt file, then falls back to the default file, then to inline default.
let MEMORY_EXTRACTION_PROMPT: string = ''

try {
  const promptPath = join(__dirname, 'prompts/memory-extraction-system-prompt.md')
  MEMORY_EXTRACTION_PROMPT = readFileSync(promptPath, 'utf-8')
} catch (error: unknown) {
  logger.warn(
    { err: error, path: join(__dirname, 'prompts/memory-extraction-system-prompt.md') },
    '[MemoryExtraction] Failed to load memory extraction prompt from markdown file, trying default fallback',
  )

  // Try to load the default fallback file
  try {
    const defaultPath = join(__dirname, 'prompts/memory-extraction-system-prompt.default.md')
    MEMORY_EXTRACTION_PROMPT = readFileSync(defaultPath, 'utf-8')
    logger.info('[MemoryExtraction] Loaded default memory extraction prompt from fallback file')
  } catch (fallbackError: unknown) {
    logger.warn(
      { err: fallbackError },
      '[MemoryExtraction] Failed to load default fallback file, using inline default',
    )
    // Final fallback: inline default (matches memory-extraction-system-prompt.default.md)
    MEMORY_EXTRACTION_PROMPT = [
      'You are a memory extraction assistant for an educational platform.',
      '',
      'Analyze the conversation and extract important information worth remembering long-term.',
      '',
      'Focus on:',
      '',
      '- User preferences (learning style, pace, topics of interest)',
      '- Decisions made (chose X over Y, wants to focus on Z)',
      "- Important facts (user's background, goals, constraints)",
      '- Open loops (questions to follow up on later)',
      '- Profile information (skill level, prior knowledge)',
      '',
      'Output format (JSON):',
      '{',
      '"memories": [',
      '{',
      '"type": "preference|decision|fact|open_loop|profile|constraint|other",',
      '"text": "Concise statement (max 200 chars)",',
      '"importance": 1-5,',
      '"scope": "user|conversation",',
      '"reason": "Why this is worth remembering"',
      '}',
      ']',
      '}',
      '',
      'Filtering rules:',
      '',
      '- Omit greetings, acknowledgments, small talk',
      '- Omit temporary/ephemeral content',
      '- Be selective: quality over quantity (max 3-5 items per extraction)',
      '- Each item must be actionable or informative',
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
 * Extract memory candidates from recent messages
 * Uses AI to identify important information
 */
export async function extractMemoryCandidates(
  recentMessages: Message[],
  existingSummary?: string,
): Promise<MemoryCandidate[]> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('[MemoryExtraction] OPENAI_API_KEY not set, skipping extraction')
    return []
  }

  // Build context
  const messagesText = recentMessages
    .slice(-10) // Last 10 messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n')

  let userPrompt = `Recent messages:\n\n${messagesText}`
  if (existingSummary) {
    userPrompt = `Conversation summary:\n${existingSummary}\n\n---\n\n${userPrompt}`
  }

  try {
    // Call model
    const client = getOpenAIClient()
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

    // Apply server-side filtering
    const filtered = (result.memories || []).filter((mem) => {
      // Reject too short
      if (mem.text.length < 10) return false
      // Reject too long
      if (mem.text.length > 2000) return false
      // Validate importance range
      if (mem.importance < 1 || mem.importance > 5) return false
      // Validate type
      const validTypes = [
        'preference',
        'decision',
        'fact',
        'open_loop',
        'profile',
        'constraint',
        'other',
      ]
      if (!validTypes.includes(mem.type)) return false

      return true
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
 * Checks for similar existing memories before creating new ones
 */
export async function persistMemoryItems(
  payload: Payload,
  userId: string,
  conversationId: string,
  candidates: MemoryCandidate[],
  sourceTimestamp: Date,
  sourceRole: ChatRole,
): Promise<number> {
  if (!featureFlags.MEMORY_EXTRACTION_ENABLED) {
    return 0
  }

  if (candidates.length === 0) {
    return 0
  }

  // Access MongoDB directly for vector search (not part of Payload's public API)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (payload.db as any).connection.db

  try {
    // Batch generate all embeddings at once
    const texts = candidates.map((c) => c.text)
    const embeddingResults = await generateEmbeddings(texts) // Single API call

    // Prepare similarity checks in parallel (with concurrency limit)
    const similarityChecks = embeddingResults.map((result, idx) =>
      findSimilarMemoryItem(db, userId, result.embedding, 0.9).then((similar) => ({
        candidate: candidates[idx],
        embedding: result.embedding,
        similar,
      })),
    )

    // Execute similarity checks with concurrency limit (avoid overwhelming DB)
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

    // Process results (create/update)
    let persisted = 0
    for (const { candidate, embedding, similar } of results) {
      if (similar) {
        // Update existing (server-side override)
        await payload.update({
          collection: 'memory_items',
          id: similar._id.toString(),
          data: {
            text: candidate.text, // Update with new phrasing
            importance: Math.max(similar.importance, candidate.importance), // Take higher importance
            embedding,
            updatedAt: new Date().toISOString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true, // Server-side write, bypass user access control
        })
        logger.debug(
          { memoryId: similar._id.toString(), text: candidate.text.slice(0, 50) },
          '[MemoryExtraction] Updated existing memory item',
        )
      } else {
        // Create new (server-side override)
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
            source: {
              sourceConversationId: conversationId,
              sourceMessageTimestamp: sourceTimestamp.toISOString(),
              sourceMessageRole: sourceRole, // ChatRole enum values match Payload schema ('user' | 'assistant')
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true, // Server-side write, bypass user access control
        })
        logger.debug(
          { text: candidate.text.slice(0, 50) },
          '[MemoryExtraction] Created new memory item',
        )
        persisted++ // Only count new creations, not updates
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
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return 0
  }
}
