import type { FunctionCall } from '@google/generative-ai'
import { vi } from 'vitest'

export interface GeminiMockOptions {
  responseText?: string
  functionCalls?: FunctionCall[]
  throwError?: Error
}

export function createGeminiMock(options: GeminiMockOptions = {}) {
  const { responseText = 'Mock Gemini response', functionCalls = [], throwError } = options

  const mockResponse = {
    text: vi.fn(() => {
      if (throwError) throw throwError
      return responseText
    }),
    functionCalls: vi.fn(() => {
      if (throwError) throw throwError
      return functionCalls
    }),
  }

  const sendMessage = vi.fn(async () => {
    if (throwError) throw throwError
    return { response: mockResponse }
  })

  const startChat = vi.fn(() => ({ sendMessage }))
  const getGenerativeModel = vi.fn(() => ({ startChat }))

  const client = {
    getGenerativeModel,
  }

  return {
    client,
    getGenerativeModel,
    startChat,
    sendMessage,
    mockResponse,
  }
}

export function createGeminiMockWithTools(options: {
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>
  responseText?: string
}) {
  const { functionCalls = [], responseText = 'Mock response after tool calls' } = options

  const convertedFunctionCalls: FunctionCall[] = functionCalls.map((fc) => ({
    name: fc.name,
    args: fc.args as Record<string, unknown>,
  }))

  const mockResponse = {
    text: vi.fn(() => responseText),
    functionCalls: vi.fn(() => convertedFunctionCalls),
  }

  const sendMessage = vi.fn(async () => {
    return { response: mockResponse }
  })

  const startChat = vi.fn(() => ({ sendMessage }))
  const getGenerativeModel = vi.fn(() => ({ startChat }))

  return {
    client: { getGenerativeModel },
    getGenerativeModel,
    startChat,
    sendMessage,
    mockResponse,
  }
}

// Helper to spy on the Gemini client module
export function spyOnGeminiClient() {
  const mock = createGeminiMock()
  return {
    getGenerativeModel: mock.getGenerativeModel,
    startChat: mock.startChat,
    sendMessage: mock.sendMessage,
    mockResponse: mock.mockResponse,
  }
}
