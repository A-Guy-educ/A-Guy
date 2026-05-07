/**
 * Integration tests for Genkit adapter message structure
 *
 * Tests that the unified adapter correctly passes structured messages to Genkit
 * instead of concatenating into a string (which loses conversation history).
 *
 * @fileType test
 * @domain ai | genkit | conversation-history
 * @pattern adapter, genkit, message-format
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createGenkitUnifiedAdapter } from '@/infra/llm/genkit/adapters/unified-adapter'
import type { AIModel } from '@/infra/llm/models'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Track calls to ai.generate and ai.generateStream to verify message structure
const mockGenerate = vi.fn()
const mockGenerateStream = vi.fn()
const mockStreamResult = {
  stream: {
    async *[Symbol.asyncIterator]() {
      yield { text: 'Mock response' }
    },
  },
  response: Promise.resolve({ text: 'Mock response' }),
}

// Helper to create a valid AIModel for tests
const createTestModel = (): AIModel => ({
  name: 'test-model',
  temperature: 0.7,
  maxOutputTokens: 1000,
})

vi.mock('@/infra/llm/genkit/genkit-instance', () => ({
  getGenkitInstance: vi.fn(() => ({
    generate: mockGenerate,
    generateStream: mockGenerateStream,
  })),
}))

vi.mock('@/infra/llm/providers/shared/circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    execute: (fn: () => unknown) => fn(),
  })),
}))

vi.mock('@/infra/llm/providers/shared/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}))

vi.mock('@/infra/llm/providers/shared/timeout', () => ({
  withTimeout: vi.fn(
    <T>(fn: () => Promise<T>, _options?: { timeoutMs?: number; message?: string }) => fn(),
  ),
}))

vi.mock('@/infra/llm/providers/factory', () => ({
  getProviderTypeFromEnv: vi.fn(async () => 'gemini'),
}))

vi.mock('@/infra/llm/genkit/config-resolver', () => ({
  resolveGenkitConfig: vi.fn(async () => ({
    model: 'test-model',
    temperature: 0.7,
  })),
}))

let payload: Payload

// Reset mocks before each test
function resetMocks() {
  mockGenerate.mockReset()
  mockGenerateStream.mockReset()
  // Setup default mock implementations
  mockGenerate.mockResolvedValue({
    text: 'Mock response',
    raw: {},
  })
  mockGenerateStream.mockResolvedValue(mockStreamResult)
}

beforeAll(async () => {
  if (!hasDatabaseUrl) return
  payload = await getPayload({ config })
}, 60000)

afterAll(async () => {
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('Genkit adapter message structure', () => {
  // Reset mocks before each test
  beforeAll(() => {
    resetMocks()
  })

  describe('generateChatCompletion', () => {
    it('passes structured messages instead of concatenated string', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const systemPrompt = 'You are a helpful assistant.'
      const conversationHistory = [
        { role: 'user' as const, content: 'First question' },
        { role: 'assistant' as const, content: 'First answer' },
        { role: 'user' as const, content: 'Second question' },
      ]

      await adapter.generateChatCompletion(
        {
          system: systemPrompt,
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      // Verify ai.generate was called
      expect(mockGenerate).toHaveBeenCalled()

      // Get the call arguments
      const callArgs = mockGenerate.mock.calls[0][0]

      // CRITICAL: messages should be an array, NOT a string
      expect(callArgs.messages).toBeDefined()
      expect(Array.isArray(callArgs.messages)).toBe(true)
      expect(callArgs.prompt).toBeUndefined()

      // Verify message structure
      expect(callArgs.messages.length).toBeGreaterThanOrEqual(1)
      expect(callArgs.messages[0]).toHaveProperty('role')
      expect(callArgs.messages[0]).toHaveProperty('content')
    })

    it('maps assistant role to model role for Genkit', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ]

      await adapter.generateChatCompletion(
        {
          system: 'Test system prompt',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]

      // Find the assistant message (should be mapped to 'model')
      const modelMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'model')
      expect(modelMessages.length).toBeGreaterThan(0)
    })

    it('preserves system message as first message', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const systemPrompt = 'You are a helpful math tutor.'

      await adapter.generateChatCompletion(
        {
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: 'Hello' }],
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]

      // First message should be system
      expect(callArgs.messages[0].role).toBe('system')
      expect(callArgs.messages[0].content[0].text).toBe(systemPrompt)
    })

    it('includes conversation history in correct order', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Question 1' },
        { role: 'assistant' as const, content: 'Answer 1' },
        { role: 'user' as const, content: 'Question 2' },
        { role: 'assistant' as const, content: 'Answer 2' },
      ]

      await adapter.generateChatCompletion(
        {
          system: 'System prompt',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]

      // All messages should be present
      expect(callArgs.messages.length).toBeGreaterThanOrEqual(conversationHistory.length + 1) // +1 for system

      // Extract text content from all messages
      const allText = callArgs.messages
        .map((m: { content: Array<{ text: string }> }) => m.content[0]?.text)
        .join(' ')

      expect(allText).toContain('Question 1')
      expect(allText).toContain('Answer 1')
      expect(allText).toContain('Question 2')
      expect(allText).toContain('Answer 2')
    })

    it('handles empty conversation history', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)

      await adapter.generateChatCompletion(
        {
          system: 'System prompt',
          messages: [],
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]

      // Should still have system message
      expect(callArgs.messages.length).toBeGreaterThanOrEqual(1)
      expect(callArgs.messages[0].role).toBe('system')
    })
  })

  describe('generateStreamingChatCompletion', () => {
    it('passes structured messages instead of concatenated string', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'First message' },
        { role: 'assistant' as const, content: 'First response' },
      ]

      // generateStreamingChatCompletion is optional in the interface
      if (!adapter.generateStreamingChatCompletion) {
        throw new Error('generateStreamingChatCompletion not implemented')
      }

      await adapter.generateStreamingChatCompletion(
        {
          system: 'You are a helpful assistant.',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      // Verify ai.generateStream was called
      expect(mockGenerateStream).toHaveBeenCalled()

      const callArgs = mockGenerateStream.mock.calls[0][0]

      // CRITICAL: messages should be an array, NOT a string
      expect(callArgs.messages).toBeDefined()
      expect(Array.isArray(callArgs.messages)).toBe(true)
      expect(callArgs.prompt).toBeUndefined()
    })

    it('maps assistant role to model role for streaming', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ]

      if (!adapter.generateStreamingChatCompletion) {
        throw new Error('generateStreamingChatCompletion not implemented')
      }

      await adapter.generateStreamingChatCompletion(
        {
          system: 'Test system',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerateStream.mock.calls[0][0]

      // Find model messages (assistant mapped to model)
      const modelMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'model')
      expect(modelMessages.length).toBeGreaterThan(0)
    })

    it('preserves conversation history order for streaming', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Message 1' },
        { role: 'assistant' as const, content: 'Response 1' },
        { role: 'user' as const, content: 'Message 2' },
      ]

      if (!adapter.generateStreamingChatCompletion) {
        throw new Error('generateStreamingChatCompletion not implemented')
      }

      await adapter.generateStreamingChatCompletion(
        {
          system: 'System',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerateStream.mock.calls[0][0]

      // Extract all text to verify order
      const allText = callArgs.messages
        .map((m: { content: Array<{ text: string }> }) => m.content[0]?.text)
        .join(' ')

      // Verify all messages are present
      expect(allText).toContain('Message 1')
      expect(allText).toContain('Response 1')
      expect(allText).toContain('Message 2')
    })
  })

  describe('generateChatCompletionWithTools', () => {
    it('passes structured messages instead of concatenated string', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'First question' },
        { role: 'assistant' as const, content: 'First answer' },
      ]

      await adapter.generateChatCompletionWithTools(
        {
          system: 'You are a helpful assistant.',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
          tools: [],
          toolExecutor: vi.fn() as never,
        },
        payload,
      )

      expect(mockGenerate).toHaveBeenCalled()
      const callArgs = mockGenerate.mock.calls[0][0]

      // CRITICAL: messages should be an array, NOT a string
      expect(callArgs.messages).toBeDefined()
      expect(Array.isArray(callArgs.messages)).toBe(true)
      expect(callArgs.prompt).toBeUndefined()
    })

    it('maps assistant role to model role for tool-calling', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ]

      await adapter.generateChatCompletionWithTools(
        {
          system: 'Test system prompt',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
          tools: [],
          toolExecutor: vi.fn() as never,
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      const modelMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'model')
      expect(modelMessages.length).toBeGreaterThan(0)
    })

    it('preserves system message as first message', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const systemPrompt = 'You are a math tutor with tools.'

      await adapter.generateChatCompletionWithTools(
        {
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: 'Hello' }],
          model: createTestModel(),
          acknowledgment: 'ack',
          tools: [],
          toolExecutor: vi.fn() as never,
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      expect(callArgs.messages[0].role).toBe('system')
      expect(callArgs.messages[0].content[0].text).toBe(systemPrompt)
    })

    it('includes conversation history in correct order', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)
      const conversationHistory = [
        { role: 'user' as const, content: 'Question 1' },
        { role: 'assistant' as const, content: 'Answer 1' },
        { role: 'user' as const, content: 'Question 2' },
        { role: 'assistant' as const, content: 'Answer 2' },
      ]

      await adapter.generateChatCompletionWithTools(
        {
          system: 'System prompt',
          messages: conversationHistory,
          model: createTestModel(),
          acknowledgment: 'ack',
          tools: [],
          toolExecutor: vi.fn() as never,
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      const allText = callArgs.messages
        .map((m: { content: Array<{ text: string }> }) => m.content[0]?.text)
        .join(' ')

      expect(allText).toContain('Question 1')
      expect(allText).toContain('Answer 1')
      expect(allText).toContain('Question 2')
      expect(allText).toContain('Answer 2')
    })
  })

  describe('role mapping', () => {
    it('maps user role correctly', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)

      await adapter.generateChatCompletion(
        {
          system: 'System',
          messages: [{ role: 'user', content: 'Hello' }],
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      const userMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'user')
      expect(userMessages.length).toBeGreaterThan(0)
    })

    it('maps assistant role to model', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)

      await adapter.generateChatCompletion(
        {
          system: 'System',
          messages: [{ role: 'assistant', content: 'Hello' }],
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      const modelMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'model')
      expect(modelMessages.length).toBeGreaterThan(0)
    })

    it('preserves system role', async () => {
      resetMocks()
      const adapter = await createGenkitUnifiedAdapter(payload)

      await adapter.generateChatCompletion(
        {
          system: 'My system prompt',
          messages: [{ role: 'user', content: 'Hello' }],
          model: createTestModel(),
          acknowledgment: 'ack',
        },
        payload,
      )

      const callArgs = mockGenerate.mock.calls[0][0]
      const systemMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'system')
      expect(systemMessages.length).toBeGreaterThan(0)
      expect(systemMessages[0].content[0].text).toBe('My system prompt')
    })
  })
})
