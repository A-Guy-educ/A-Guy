import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIMock } from '../mocks/openai.mock'

describe('OpenAI error handling', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('throws on embedding rate limit errors', async () => {
    const rateLimitError = Object.assign(new Error('Rate limit exceeded'), { status: 429 })
    const { MockOpenAI } = createOpenAIMock({ embeddingError: rateLimitError })

    vi.doMock('openai', () => ({ OpenAI: MockOpenAI }))

    const { generateEmbedding } = await import('@/infra/llm/embeddings')

    await expect(generateEmbedding('hello world')).rejects.toThrow('Rate limit exceeded')
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const { generateEmbedding } = await import('@/infra/llm/embeddings')
    await expect(generateEmbedding('hello world')).rejects.toThrow('OPENAI_API_KEY')
  })

  it('returns empty candidates when extraction fails', async () => {
    const { MockOpenAI } = createOpenAIMock({
      chatError: new Error('Timeout while calling OpenAI'),
    })

    vi.doMock('openai', () => ({ OpenAI: MockOpenAI }))

    const { extractMemoryCandidates } = await import('@/infra/llm/memory-extraction')

    const candidates = await extractMemoryCandidates([
      {
        role: 'user',
        content: 'Remember that I like TypeScript.',
        timestamp: new Date().toISOString(),
      },
    ])

    expect(candidates).toEqual([])
  })
})
