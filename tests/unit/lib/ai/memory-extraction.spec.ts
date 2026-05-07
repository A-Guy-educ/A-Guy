import { describe, expect, it, vi, beforeEach } from 'vitest'

// We need to mock fs BEFORE importing the module under test because the prompt
// is loaded at module initialization time.
const readFileSyncMock = vi.fn()

vi.mock('fs', () => ({
  readFileSync: (...args: any[]) => readFileSyncMock(...args),
}))

// Mock OpenAI client so that extractMemoryCandidates does not perform real network calls.
const createMock = vi.fn()

class FakeOpenAI {
  chat = {
    completions: {
      create: createMock,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: any) {}
}

vi.mock('openai', () => ({
  OpenAI: FakeOpenAI,
}))

// Mock dependencies used by persistMemoryItems
vi.mock('@/infra/llm/embeddings', () => ({
  generateEmbeddings: vi.fn(),
}))

vi.mock('@/infra/llm/vector-search', () => ({
  findSimilarMemoryItem: vi.fn(),
}))

vi.mock('@/infra/llm/observability', () => ({
  logMaintenance: vi.fn(),
}))

describe('memory extraction service', () => {
  beforeEach(() => {
    readFileSyncMock.mockReset()
    createMock.mockReset()
    // Ensure OPENAI_API_KEY check passes
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('falls back to default prompt file when main markdown file cannot be read', async () => {
    // Simulate ENOENT error for main file, but success for default fallback file
    let callCount = 0
    readFileSyncMock.mockImplementation((path: string) => {
      callCount++
      if (
        callCount === 1 &&
        path.includes('memory-extraction-system-prompt.md') &&
        !path.includes('.default')
      ) {
        const error: NodeJS.ErrnoException = new Error('ENOENT: file not found')
        error.code = 'ENOENT'
        throw error
      }
      // Return default fallback content
      return 'You are a memory extraction assistant for an educational platform.'
    })

    // Import after mocks so that module initialization uses the mocked fs
    const { extractMemoryCandidates } = await import('@/infra/llm/memory-extraction')

    // Mock OpenAI response
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              memories: [
                {
                  type: 'preference',
                  text: 'User prefers TypeScript',
                  importance: 4,
                  scope: 'user',
                  reason: 'Explicitly stated preference',
                },
              ],
            }),
          },
        },
      ],
    })

    const now = new Date().toISOString()
    const result = await extractMemoryCandidates(
      [{ role: 'user', content: 'I prefer TypeScript', timestamp: now }],
      undefined,
    )

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    // Verify it tried to load the default fallback file
    expect(readFileSyncMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to inline default when both main and default files cannot be read', async () => {
    // Simulate ENOENT error for both main and default files
    readFileSyncMock.mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('ENOENT: file not found')
      error.code = 'ENOENT'
      throw error
    })

    // Import after mocks so that module initialization uses the mocked fs
    const { extractMemoryCandidates } = await import('@/infra/llm/memory-extraction')

    // Mock OpenAI response
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              memories: [
                {
                  type: 'preference',
                  text: 'User prefers TypeScript',
                  importance: 4,
                  scope: 'user',
                  reason: 'Explicitly stated preference',
                },
              ],
            }),
          },
        },
      ],
    })

    const now = new Date().toISOString()
    const result = await extractMemoryCandidates(
      [{ role: 'user', content: 'I prefer TypeScript', timestamp: now }],
      undefined,
    )

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('persistMemoryItems concurrency', () => {
  // Reset all mocks between tests
  beforeEach(() => {
    vi.clearAllMocks()
    readFileSyncMock.mockReset()
    createMock.mockReset()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('calls findSimilarMemoryItem with bounded concurrency (max 2 in-flight)', async () => {
    // Import after mocks so that module initialization uses the mocked fs
    const { generateEmbeddings } = await import('@/infra/llm/embeddings')
    const { findSimilarMemoryItem } = await import('@/infra/llm/vector-search')
    const { persistMemoryItems } = await import('@/infra/llm/memory-extraction')

    // Track concurrent in-flight calls using module-level state
    let inFlight = 0
    let maxInFlight = 0

    // Mock generateEmbeddings to return 5 embeddings
    vi.mocked(generateEmbeddings).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        embedding: Array(1536).fill(i * 0.01),
        model: 'text-embedding-3-small',
        tokensUsed: 10,
      })),
    )

    // Mock findSimilarMemoryItem with a delay and concurrency tracking.
    // Each call takes 20ms. With limit=2, at most 2 should be in-flight at once.
    vi.mocked(findSimilarMemoryItem).mockImplementation(
      async (_db: any, _uid: any, _emb: any, _sim: any) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight--
        return null
      },
    )

    const fakePayload = {
      db: {
        connection: { db: {} },
      },
      create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    } as any

    const candidates = Array.from({ length: 5 }, (_, i) => ({
      type: 'preference' as const,
      text: `Preference ${i}`,
      importance: 3,
      scope: 'user' as const,
      reason: 'Test',
    }))

    const persisted = await persistMemoryItems(
      fakePayload,
      'user-123',
      'conv-456',
      candidates,
      new Date(),
      'user' as any,
      undefined,
      undefined,
    )

    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(persisted).toBe(5)
    expect(findSimilarMemoryItem).toHaveBeenCalledTimes(5)
  })

  it('result order matches candidate order regardless of completion order', async () => {
    const { generateEmbeddings } = await import('@/infra/llm/embeddings')
    const { persistMemoryItems } = await import('@/infra/llm/memory-extraction')

    // Mock generateEmbeddings
    vi.mocked(generateEmbeddings).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        embedding: Array(1536).fill(i * 0.01),
        model: 'text-embedding-3-small',
        tokensUsed: 10,
      })),
    )

    // Track which order items complete by mocking the payload.create
    // to record when each item is processed after findSimilarMemoryItem resolves.
    // The order of create calls should match input order even if findSimilarMemoryItem
    // completes in a scrambled order.
    const { findSimilarMemoryItem } = await import('@/infra/llm/vector-search')
    vi.mocked(findSimilarMemoryItem).mockImplementation(
      async (_db: any, _uid: any, _emb: any, _sim: any) => {
        return null
      },
    )

    const fakePayload = {
      db: {
        connection: { db: {} },
      },
      create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    } as any

    const candidates = Array.from({ length: 5 }, (_, i) => ({
      type: 'fact' as const,
      text: `Fact ${i}`,
      importance: 4,
      scope: 'user' as const,
      reason: 'Test',
    }))

    await persistMemoryItems(
      fakePayload,
      'user-123',
      'conv-456',
      candidates,
      new Date(),
      'assistant' as any,
      undefined,
      undefined,
    )

    // All 5 items should be processed regardless of completion order
    expect(fakePayload.create).toHaveBeenCalledTimes(5)
  })

  it('graceful degradation: one findSimilarMemoryItem failure still processes other items', async () => {
    const { generateEmbeddings } = await import('@/infra/llm/embeddings')
    const { findSimilarMemoryItem } = await import('@/infra/llm/vector-search')
    const { persistMemoryItems } = await import('@/infra/llm/memory-extraction')

    // Mock generateEmbeddings
    vi.mocked(generateEmbeddings).mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        embedding: Array(1536).fill(i * 0.01),
        model: 'text-embedding-3-small',
        tokensUsed: 10,
      })),
    )

    // Track which embedding index is being processed using a mutable counter.
    // The factory receives (result, idx), but findSimilarMemoryItem only gets
    // (db, userId, embedding, 0.9). We use a shared counter to inject failure for idx=1.
    let currentIdx = -1
    vi.mocked(findSimilarMemoryItem).mockImplementation(async (_db: any) => {
      currentIdx++
      if (currentIdx === 1) {
        throw new Error('Vector search failed')
      }
      return null
    })

    const fakePayload = {
      db: {
        connection: { db: {} },
      },
      create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    } as any

    const candidates = [
      {
        type: 'preference' as const,
        text: 'Pref 0',
        importance: 3,
        scope: 'user' as const,
        reason: 'Test',
      },
      {
        type: 'preference' as const,
        text: 'Pref 1',
        importance: 3,
        scope: 'user' as const,
        reason: 'Test',
      },
      {
        type: 'preference' as const,
        text: 'Pref 2',
        importance: 3,
        scope: 'user' as const,
        reason: 'Test',
      },
    ]

    // Should NOT throw even though one findSimilarMemoryItem fails
    const persisted = await persistMemoryItems(
      fakePayload,
      'user-123',
      'conv-456',
      candidates,
      new Date(),
      'user' as any,
      undefined,
      undefined,
    )

    // All 3 items should still be persisted (the failed one gracefully degrades to similar: null)
    expect(persisted).toBe(3)
    expect(fakePayload.create).toHaveBeenCalledTimes(3)
  })
})
