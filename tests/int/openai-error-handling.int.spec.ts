/**
 * OpenAI Error Handling Integration Tests
 *
 * Purpose: Verify the embedding service correctly handles OpenAI API errors
 * including rate limits and missing API keys.
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

// Create mock client factory
function createMockClient(options?: { embeddingError?: Error; chatError?: Error }) {
  return {
    embeddings: {
      create: vi.fn().mockImplementation(async ({ input }: { input: string | string[] }) => {
        if (options?.embeddingError) {
          throw options.embeddingError
        }
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
      }),
    },
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          if (options?.chatError) {
            throw options.chatError
          }
          return {
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Mock response' },
                finish_reason: 'stop' as const,
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
          }
        }),
      },
    },
  }
}

// Base mocks for config/runtime
const configRuntimeMocks = {
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
}

vi.mock('@/lib/config/runtime', () => configRuntimeMocks)

vi.mock('@/lib/tenant/get-default-tenant', () => ({
  getDefaultTenantId: vi.fn().mockResolvedValue('default-tenant'),
}))

describe('OpenAI error handling', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('throws on embedding rate limit errors', async () => {
    const rateLimitError = Object.assign(new Error('Rate limit exceeded'), { status: 429 })
    const mockClient = createMockClient({ embeddingError: rateLimitError })

    vi.mock('@/infra/llm/openai-client', () => ({
      getOpenAIClient: vi.fn().mockResolvedValue(mockClient),
      getOpenAIApiKey: vi.fn().mockResolvedValue('test-key'),
      resetOpenAIClient: vi.fn(),
    }))

    const { generateEmbedding } = await import('@/infra/llm/embeddings')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload

    await expect(generateEmbedding(mockPayload, 'hello world')).rejects.toThrow(
      'Rate limit exceeded',
    )
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    // Update the mock to return empty for API key
    vi.mock('@/lib/config/runtime', () => ({
      ...configRuntimeMocks,
      getSecret: vi.fn().mockImplementation((_tenantId, key, options) => {
        if (key === 'OPENAI_API_KEY') {
          if (options?.throwIfNotFound === false) return ''
          throw new Error('OPENAI_API_KEY is not configured in tenant config.')
        }
        return ''
      }),
    }))

    const mockClient = createMockClient()
    vi.mock('@/infra/llm/openai-client', () => ({
      getOpenAIClient: vi.fn().mockResolvedValue(mockClient),
      getOpenAIApiKey: vi.fn().mockResolvedValue(''),
      resetOpenAIClient: vi.fn(),
    }))

    const { generateEmbedding } = await import('@/infra/llm/embeddings')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload

    await expect(generateEmbedding(mockPayload, 'hello world')).rejects.toThrow('OPENAI_API_KEY')
  })

  it('returns empty candidates when extraction fails', async () => {
    const chatError = new Error('Timeout while calling OpenAI')
    const mockClient = createMockClient({ chatError })

    vi.mock('@/infra/llm/openai-client', () => ({
      getOpenAIClient: vi.fn().mockResolvedValue(mockClient),
      getOpenAIApiKey: vi.fn().mockResolvedValue('test-key'),
      resetOpenAIClient: vi.fn(),
    }))

    const { extractMemoryCandidates } = await import('@/infra/llm/memory-extraction')
    const mockPayload = { id: 'test-user' } as unknown as import('payload').Payload

    const candidates = await extractMemoryCandidates(mockPayload, [
      {
        role: 'user',
        content: 'Remember that I like TypeScript.',
        timestamp: new Date().toISOString(),
      },
    ])

    expect(candidates).toEqual([])
  })
})
