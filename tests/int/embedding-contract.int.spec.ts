import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIMock } from '../mocks/openai.mock'

describe('embedding contract', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns embeddings with 1536 dimensions', async () => {
    const { MockOpenAI } = createOpenAIMock({ embeddingDimension: 1536 })
    vi.doMock('openai', () => ({ OpenAI: MockOpenAI }))

    const { generateEmbedding } = await import('@/lib/ai/embeddings')
    const result = await generateEmbedding('Test input')

    expect(result.embedding).toHaveLength(1536)
    expect(result.tokensUsed).toBeGreaterThan(0)
  })

  it('throws when embedding dimension is invalid', async () => {
    const { MockOpenAI } = createOpenAIMock({ embeddingDimension: 1024 })
    vi.doMock('openai', () => ({ OpenAI: MockOpenAI }))

    const { generateEmbedding } = await import('@/lib/ai/embeddings')
    await expect(generateEmbedding('Test input')).rejects.toThrow('Embedding dimension mismatch')
  })

  it('handles batch embeddings and empty input', async () => {
    const { MockOpenAI } = createOpenAIMock({ embeddingDimension: 1536 })
    vi.doMock('openai', () => ({ OpenAI: MockOpenAI }))

    const { generateEmbeddings } = await import('@/lib/ai/embeddings')
    const results = await generateEmbeddings(['One', 'Two'])

    expect(results).toHaveLength(2)
    expect(results[0].embedding).toHaveLength(1536)
    expect(await generateEmbeddings([])).toEqual([])
    expect(await generateEmbeddings(['', '   '])).toEqual([])
  })
})
