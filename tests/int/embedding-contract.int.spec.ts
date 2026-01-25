/**
 * Embedding Contract Integration Tests
 *
 * Purpose: Verify the embedding service correctly generates 1536-dimensional
 * embeddings with proper error handling and validation.
 *
 * Network: Fully offline using mocked OpenAI client
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Create deterministic mock embeddings
function generateMockEmbedding(text: string): number[] {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash = hash & hash
  }
  const seed = Math.abs(hash)
  const random = (index: number) => {
    const x = Math.sin(seed + index) * 10000
    return (x - Math.floor(x)) * 2 - 1
  }
  return Array.from({ length: 1536 }, (_, i) => random(i))
}

// Mock OpenAI client directly (bypassing openai-client.ts)
const mockEmbeddingsCreate = vi
  .fn()
  .mockImplementation(async ({ input }: { input: string | string[] }) => {
    const inputs = Array.isArray(input) ? input : [input]
    const data = inputs.map((text, idx) => ({
      embedding: generateMockEmbedding(text),
      index: idx,
      object: 'embedding' as const,
    }))
    return {
      data,
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
      object: 'list' as const,
    }
  })

const mockClient = {
  embeddings: { create: mockEmbeddingsCreate },
  chat: { completions: { create: vi.fn() } },
}

vi.mock('@/infra/llm/openai-client', () => ({
  getOpenAIClient: vi.fn().mockResolvedValue(mockClient),
  getOpenAIApiKey: vi.fn().mockResolvedValue('test-key'),
  resetOpenAIClient: vi.fn(),
}))

vi.mock('@/lib/config/runtime', () => ({
  loadRuntimeConfig: vi.fn().mockResolvedValue({
    success: true,
    variablesLoaded: 0,
    secretsLoaded: 1,
    errors: [],
    loadedAt: new Date(),
  }),
  isConfigLoaded: vi.fn().mockReturnValue(true),
  clearConfigCache: vi.fn(),
  getVariable: vi.fn().mockReturnValue('test-value'),
  getSecret: vi.fn().mockImplementation((_tenantId, key) => {
    if (key === 'OPENAI_API_KEY') return 'test-api-key'
    return ''
  }),
  getVariableKeys: vi.fn().mockReturnValue([]),
  getSecretKeys: vi.fn().mockReturnValue(['OPENAI_API_KEY']),
  getLoadedTenantIds: vi.fn().mockReturnValue(['default-tenant']),
  getCacheMetadata: vi.fn().mockReturnValue({
    loadedAt: new Date(),
    entryCount: 0,
    variableCount: 0,
    secretCount: 1,
    tenantsLoaded: 1,
  }),
}))

vi.mock('@/lib/tenant/get-default-tenant', () => ({
  getDefaultTenantId: vi.fn().mockResolvedValue('default-tenant'),
}))

describe('embedding contract', () => {
  beforeEach(() => {
    vi.resetModules()
    mockEmbeddingsCreate.mockClear()
  })

  it('returns embeddings with 1536 dimensions', async () => {
    const { generateEmbedding } = await import('@/infra/llm/embeddings')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload
    const result = await generateEmbedding(mockPayload, 'Test input')

    expect(result.embedding).toHaveLength(1536)
    expect(result.tokensUsed).toBeGreaterThan(0)
  })

  it('generates different embeddings for different texts', async () => {
    const { generateEmbedding } = await import('@/infra/llm/embeddings')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload

    const result1 = await generateEmbedding(mockPayload, 'Hello world')
    const result2 = await generateEmbedding(mockPayload, 'Goodbye world')

    // Different texts should produce different embeddings
    expect(result1.embedding).not.toEqual(result2.embedding)
  })

  it('handles batch embeddings and empty input', async () => {
    const { generateEmbeddings } = await import('@/infra/llm/embeddings')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload

    const results = await generateEmbeddings(mockPayload, ['One', 'Two'])
    expect(results).toHaveLength(2)
    expect(results[0].embedding).toHaveLength(1536)
    expect(results[1].embedding).toHaveLength(1536)

    // Empty array should return empty array
    expect(await generateEmbeddings(mockPayload, [])).toEqual([])

    // Array with only empty strings should return empty array
    expect(await generateEmbeddings(mockPayload, ['', '   '])).toEqual([])
  })
})
