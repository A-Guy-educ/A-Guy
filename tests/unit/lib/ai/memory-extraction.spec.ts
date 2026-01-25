import { beforeEach, describe, expect, it, vi } from 'vitest'

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

// Mock the openai-client module to return our fake OpenAI
vi.mock('@/infra/llm/openai-client', () => ({
  getOpenAIClient: vi.fn(async () => {
    const { OpenAI } = await import('openai')
    return new OpenAI({ apiKey: 'test-key' })
  }),
}))

// Mock the embeddings module
vi.mock('@/infra/llm/embeddings', () => ({
  generateEmbeddings: vi.fn(),
}))

describe('memory extraction service', () => {
  beforeEach(() => {
    readFileSyncMock.mockReset()
    createMock.mockReset()
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
    const mockPayload = {} as any
    const result = await extractMemoryCandidates(mockPayload, [
      { role: 'user', content: 'I prefer TypeScript', timestamp: now },
    ])

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
    const mockPayload = {} as any
    const result = await extractMemoryCandidates(mockPayload, [
      { role: 'user', content: 'I prefer TypeScript', timestamp: now },
    ])

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
  })
})
