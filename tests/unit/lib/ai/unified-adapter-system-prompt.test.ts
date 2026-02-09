/**
 * Unit test for Genkit adapter system prompt wiring
 *
 * Verifies that system prompts are passed as first-class parameters
 * to Genkit's generate/generateStream functions, rather than being
 * flattened into the user prompt string.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Create mock implementations
const mockErrorAdapter = {
  wrapError: (error: Error) => error,
  isRetryable: () => false,
}

// Mock modules before import - use doMock to avoid hoisting issues
vi.doMock('@/infra/llm/genkit/genkit-instance', () => ({
  getGenkitInstance: vi.fn().mockResolvedValue({
    generate: vi.fn(),
    generateStream: vi.fn(),
  }),
}))

vi.doMock('@/infra/llm/genkit/config-resolver', () => ({
  resolveGenkitConfig: vi.fn().mockResolvedValue({ model: 'test-model' }),
}))

vi.doMock('@/infra/llm/genkit/adapters/error-adapter', () => ({
  getErrorAdapter: vi.fn().mockReturnValue(mockErrorAdapter),
}))

vi.doMock('@/infra/llm/providers/shared/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
}))

// Import after mocking
const { createGenkitUnifiedAdapter } = await import('@/infra/llm/genkit/adapters/unified-adapter')

describe('Genkit Adapter - System Prompt Wiring', () => {
  let mockGenerateStream: ReturnType<typeof vi.fn>
  let mockGenerate: ReturnType<typeof vi.fn>
  let mockGetGenkitInstance: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Re-import to get fresh mocks
    const { getGenkitInstance } = await import('@/infra/llm/genkit/genkit-instance')
    mockGetGenkitInstance = getGenkitInstance as any

    mockGenerateStream = vi.fn()
    mockGenerate = vi.fn()

    mockGetGenkitInstance.mockResolvedValue({
      generate: mockGenerate,
      generateStream: mockGenerateStream,
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('generateStreamingChatCompletion', () => {
    it('should pass system as separate parameter, not in prompt', async () => {
      const mockPayload = {} as any
      const adapter = await createGenkitUnifiedAdapter(mockPayload)

      // Setup mock to return a valid stream
      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: undefined }),
        }),
      }
      mockGenerateStream.mockResolvedValue({
        stream: mockStream,
        response: Promise.resolve({ text: 'test response' }),
      })

      // Call the streaming method
      const streamingMethod = adapter.generateStreamingChatCompletion
      expect(streamingMethod).toBeDefined()
      await streamingMethod!(
        {
          system: 'Always use \\frac{a}{b} for fractions',
          messages: [{ role: 'user', content: 'what is 1/2?' }],
          model: { name: 'test-chat', temperature: 0.7, maxOutputTokens: 1000 },
          acknowledgment: '',
        },
        mockPayload,
      )

      // Verify system was passed as separate parameter
      expect(mockGenerateStream).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerateStream.mock.calls[0][0]

      // System should be a separate parameter
      expect(callArgs.system).toBe('Always use \\frac{a}{b} for fractions')
      expect(callArgs.system).not.toContain('user:')
      expect(callArgs.system).not.toContain('what is 1/2?')

      // Prompt should only contain user/assistant messages, not system
      expect(callArgs.prompt).not.toContain('Always use')
      expect(callArgs.prompt).toContain('user: what is 1/2?')
    })
  })

  describe('generateChatCompletion', () => {
    it('should pass system as separate parameter, not in prompt', async () => {
      const mockPayload = {} as any
      const adapter = await createGenkitUnifiedAdapter(mockPayload)

      // Setup mock
      mockGenerate.mockResolvedValue({
        text: 'test response',
        raw: {},
      })

      // Call the non-streaming method
      const completionMethod = adapter.generateChatCompletion
      expect(completionMethod).toBeDefined()
      await completionMethod!(
        {
          system: 'Always use \\frac{a}{b} for fractions',
          messages: [{ role: 'user', content: 'what is 1/2?' }],
          model: { name: 'test-chat', temperature: 0.7, maxOutputTokens: 1000 },
          acknowledgment: '',
        },
        mockPayload,
      )

      // Verify system was passed as separate parameter
      expect(mockGenerate).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerate.mock.calls[0][0]

      // System should be a separate parameter
      expect(callArgs.system).toBe('Always use \\frac{a}{b} for fractions')
      expect(callArgs.system).not.toContain('user:')
      expect(callArgs.system).not.toContain('what is 1/2?')

      // Prompt should only contain user/assistant messages, not system
      expect(callArgs.prompt).not.toContain('Always use')
      expect(callArgs.prompt).toContain('user: what is 1/2?')
    })
  })

  describe('generateChatCompletionWithTools', () => {
    it('should pass system as separate parameter, not in prompt', async () => {
      const mockPayload = {} as any
      const adapter = await createGenkitUnifiedAdapter(mockPayload)

      // Setup mock
      mockGenerate.mockResolvedValue({
        text: 'test response',
        raw: {},
        toolCalls: [],
      })

      // Call the tools method
      const toolsMethod = adapter.generateChatCompletionWithTools
      expect(toolsMethod).toBeDefined()
      await toolsMethod!(
        {
          system: 'Always use \\frac{a}{b} for fractions',
          messages: [{ role: 'user', content: 'what is 1/2 + 1/3?' }],
          model: { name: 'test-chat', temperature: 0.7, maxOutputTokens: 1000 },
          acknowledgment: '',
          tools: [
            {
              name: 'testTool',
              description: 'A test tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
          toolExecutor: vi.fn(),
        },
        mockPayload,
      )

      // Verify system was passed as separate parameter
      expect(mockGenerate).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerate.mock.calls[0][0]

      // System should be a separate parameter
      expect(callArgs.system).toBe('Always use \\frac{a}{b} for fractions')
      expect(callArgs.system).not.toContain('user:')
      expect(callArgs.system).not.toContain('what is 1/2')

      // Prompt should only contain user/assistant messages, not system
      expect(callArgs.prompt).not.toContain('Always use')
      expect(callArgs.prompt).toContain('user: what is 1/2 + 1/3?')
    })
  })
})
