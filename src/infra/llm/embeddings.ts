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

import { logger } from '@/utilities/logger'
import { OpenAI } from 'openai'

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

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions
const EXPECTED_DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  model: string
  tokensUsed: number
}

/**
 * Generate embedding for a single text
 * Validates output dimensions (CRITICAL)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text')
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  try {
    const client = getOpenAIClient()
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
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return []
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  // Filter out empty texts
  const validTexts = texts.filter((t) => t && t.trim().length > 0)

  if (validTexts.length === 0) {
    return []
  }

  try {
    const client = getOpenAIClient()
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
