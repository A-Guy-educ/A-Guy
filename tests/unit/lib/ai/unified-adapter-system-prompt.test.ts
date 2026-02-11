/**
 * Unit test for Genkit adapter system prompt wiring
 *
 * Verifies that system prompts are:
 * 1. Passed as first-class parameters to Genkit's generate/generateStream functions
 * 2. ALSO prepended to the prompt string as fallback for providers/models that ignore `system` param
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
    it('should pass system as separate parameter AND prepend to prompt as fallback', async () => {
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

      // Prompt should ALSO contain system text at the top (fallback behavior)
      expect(callArgs.prompt).toContain('system: Always use \\frac{a}{b} for fractions')
      expect(callArgs.prompt).toContain('user: what is 1/2?')

      // Verify order: system should be at the top of prompt
      expect(callArgs.prompt).toMatch(/^system: /)
    })

    it('should not duplicate system when system is empty', async () => {
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

      // Call with empty system
      await adapter.generateStreamingChatCompletion!(
        {
          system: '',
          messages: [{ role: 'user', content: 'hello' }],
          model: { name: 'test-chat', temperature: 0.7, maxOutputTokens: 1000 },
          acknowledgment: '',
        },
        mockPayload,
      )

      const callArgs = mockGenerateStream.mock.calls[0][0]

      // System should still be passed as separate param (empty)
      expect(callArgs.system).toBe('')

      // Prompt should NOT have empty "system:" prefix - should just be user message
      expect(callArgs.prompt).toBe('user: hello')
    })
  })

  describe('generateChatCompletion', () => {
    it('should pass system as separate parameter AND prepend to prompt as fallback', async () => {
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

      // Prompt should ALSO contain system text at the top (fallback behavior)
      expect(callArgs.prompt).toContain('system: Always use \\frac{a}{b} for fractions')
      expect(callArgs.prompt).toContain('user: what is 1/2?')

      // Verify order: system should be at the top of prompt
      expect(callArgs.prompt).toMatch(/^system: /)
    })

    it('should handle multiple messages with system fallback', async () => {
      const mockPayload = {} as any
      const adapter = await createGenkitUnifiedAdapter(mockPayload)

      mockGenerate.mockResolvedValue({
        text: 'test response',
        raw: {},
      })

      await adapter.generateChatCompletion!(
        {
          system: 'Be concise and helpful',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' },
          ],
          model: { name: 'test-chat', temperature: 0.7, maxOutputTokens: 1000 },
          acknowledgment: '',
        },
        mockPayload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]

      // Verify system is at the top
      expect(callArgs.prompt).toMatch(/^system: Be concise and helpful\n/)

      // Verify all messages are present in order
      expect(callArgs.prompt).toContain('user: Hello')
      expect(callArgs.prompt).toContain('assistant: Hi there!')
      expect(callArgs.prompt).toContain('user: How are you?')
    })
  })

  describe('generateChatCompletionWithTools', () => {
    it('should pass system as separate parameter AND prepend to prompt as fallback', async () => {
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

      // Prompt should ALSO contain system text at the top (fallback behavior)
      expect(callArgs.prompt).toContain('system: Always use \\frac{a}{b} for fractions')
      expect(callArgs.prompt).toContain('user: what is 1/2 + 1/3?')

      // Verify order: system should be at the top of prompt
      expect(callArgs.prompt).toMatch(/^system: /)
    })
  })
})
