/**
 * Embeddings Service
 * Generates vector embeddings using OpenAI's text-embedding-3-small model
 *
 * Key Features:
 * - 1536 dimensions (matches Atlas vector index)
 * - Dimension validation (critical guardrail)
 * - Batch generation support
 * - Error handling and logging
 */

import { logger } from '@/infra/utils/logger'
import type { Payload } from 'payload'
import { getOpenAIClient } from './openai-client'

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions
const EXPECTED_DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  model: string
  tokensUsed: number
}

// Track if we're in test mode (no payload)
let testMode = false

/**
 * Enable test mode - uses process.env.OPENAI_API_KEY directly
 * @internal
 */
export function setEmbeddingsTestMode(enabled: boolean): void {
  testMode = enabled
}

/**
 * Get OpenAI client for embeddings (test-compatible)
 */
async function getEmbeddingClient(payload?: Payload): Promise<{ client: any; apiKey: string }> {
  // Test mode: use process.env directly
  if (testMode || !payload) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    const { OpenAI } = await import('openai')
    return { client: new OpenAI({ apiKey, dangerouslyAllowBrowser: true }), apiKey }
  }

  // Use tenant-scoped config
  const client = await getOpenAIClient(payload)
  return { client, apiKey: '' }
}

/**
 * Generate embedding for a single text
 * Validates output dimensions (CRITICAL)
 *
 * @param payloadOrText - Payload instance OR text (for backward compatibility)
 * @param text - Text to embed (if first arg is payload)
 */
export async function generateEmbedding(
  payloadOrText: Payload | string,
  textOrUndefined?: string,
): Promise<EmbeddingResult> {
  let payload: Payload | undefined
  let text: string

  if (typeof payloadOrText === 'string') {
    // Backward compatibility: first arg is text
    text = payloadOrText
    payload = undefined
  } else {
    // New signature: first arg is payload
    payload = payloadOrText
    text = textOrUndefined!
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text')
  }

  try {
    const { client } = await getEmbeddingClient(payload)
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
    })

    const embedding = response.data[0].embedding

    // Validate dimensions (critical guardrail)
    if (embedding.length !== EXPECTED_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`,
      )
    }

    return {
      embedding,
      model: response.model,
      tokensUsed: response.usage.total_tokens,
    }
  } catch (error) {
    logger.error({ err: error }, '[Embeddings] Generation failed')
    throw error
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than individual calls
 *
 * @param payloadOrTexts - Payload instance OR array of texts (backward compat)
 * @param texts - Array of texts to embed (if first arg is payload)
 */
export async function generateEmbeddings(
  payloadOrTexts: Payload | string[],
  textsOrUndefined?: string[],
): Promise<EmbeddingResult[]> {
  let payload: Payload | undefined
  let texts: string[]

  if (Array.isArray(payloadOrTexts)) {
    // Backward compatibility: first arg is texts array
    texts = payloadOrTexts
    payload = undefined
  } else {
    // New signature: first arg is payload
    payload = payloadOrTexts
    texts = textsOrUndefined!
  }

  if (texts.length === 0) {
    return []
  }

  // Filter out empty texts
  const validTexts = texts.filter((t) => t && t.trim().length > 0)

  if (validTexts.length === 0) {
    return []
  }

  try {
    const { client } = await getEmbeddingClient(payload)
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: validTexts.map((t) => t.trim()),
    })

    // Validate all embeddings
    const results: EmbeddingResult[] = response.data.map((item: { embedding: number[] }) => {
      if (item.embedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${item.embedding.length}`,
        )
      }

      return {
        embedding: item.embedding,
        model: response.model,
        tokensUsed: Math.round(response.usage.total_tokens / validTexts.length), // Approximate per-text
      }
    })

    return results
  } catch (error) {
    logger.error({ err: error }, '[Embeddings] Batch generation failed')
    throw error
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
