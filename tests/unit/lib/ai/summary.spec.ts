import { describe, expect, it, vi, beforeEach } from 'vitest'

// We need to mock fs BEFORE importing the module under test because the prompt
// is loaded at module initialization time.
const readFileSyncMock = vi.fn()

vi.mock('fs', () => ({
  readFileSync: (...args: any[]) => readFileSyncMock(...args),
}))

// Mock OpenAI client so that generateSummary does not perform real network calls.
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

describe('summary service', () => {
  beforeEach(() => {
    readFileSyncMock.mockReset()
    createMock.mockReset()
    // Ensure OPENAI_API_KEY check passes
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('falls back to default prompt when markdown file cannot be read', async () => {
    // Simulate ENOENT error when trying to read the markdown file
    readFileSyncMock.mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('ENOENT: file not found')
      error.code = 'ENOENT'
      throw error
    })

    // Import after mocks so that module initialization uses the mocked fs
    const { generateSummary } = await import('@/lib/ai/summary')

    // Mock OpenAI response
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'mock summary' } }],
      usage: { total_tokens: 42 },
    })

    const now = new Date().toISOString()
    const result = await generateSummary('', [
      { role: 'user', content: 'Hello', timestamp: now },
    ])

    expect(result.summary).toBe('mock summary')
    expect(result.tokensUsed).toBe(42)
  })
})

