import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock OpenAI client
const createMock = vi.fn()

class FakeOpenAI {
  embeddings = {
    create: createMock,
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: any) {}
}

vi.mock('openai', () => ({
  OpenAI: FakeOpenAI,
}))

// Mock the openai-client module to return our fake OpenAI
vi.mock('@/infra/llm/openai-client', () => ({
  getOpenAIClient: vi.fn(async () => {
    const { OpenAI } = await import('openai')
    return new OpenAI({ apiKey: 'test-key' })
  }),
}))

describe('embeddings service', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('generates embedding with correct dimensions', async () => {
    const { generateEmbedding } = await import('@/infra/llm/embeddings')

    // Mock OpenAI response with 1536-dimension embedding
    createMock.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
      usage: { total_tokens: 10 },
      model: 'text-embedding-3-small',
    })

    const mockPayload = {} as any
    const result = await generateEmbedding(mockPayload, 'test text')

    expect(result.embedding).toHaveLength(1536)
    expect(result.model).toBe('text-embedding-3-small')
    expect(result.tokensUsed).toBe(10)
  })

  it('generates batch embeddings', async () => {
    const { generateEmbeddings } = await import('@/infra/llm/embeddings')

    // Mock OpenAI response
    createMock.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }, { embedding: new Array(1536).fill(0.2) }],
      usage: { total_tokens: 20 },
      model: 'text-embedding-3-small',
    })

    const mockPayload = {} as any
    const result = await generateEmbeddings(mockPayload, ['text1', 'text2'])

    expect(result).toHaveLength(2)
    expect(result[0].embedding).toHaveLength(1536)
    expect(result[1].embedding).toHaveLength(1536)
  })

  it('calculates cosine similarity correctly', async () => {
    const { cosineSimilarity } = await import('@/infra/llm/embeddings')

    const a = [1, 0, 0]
    const b = [1, 0, 0]
    const similarity = cosineSimilarity(a, b)

    expect(similarity).toBeCloseTo(1, 5)
  })
})
