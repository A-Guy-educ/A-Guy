/**
 * Unit tests for Gemini Provider multimodal functionality
 */
import type { AIModel, GenerateMultimodalInput } from '@/infra/llm/providers/gemini/gemini.provider'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the dependencies
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/infra/llm/providers/gemini/gemini.client', () => ({
  getGeminiClient: vi.fn(),
}))

describe('generateMultimodalCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call Gemini with prompt and PDF attachment', async () => {
    const { generateMultimodalCompletion } =
      await import('@/infra/llm/providers/gemini/gemini.provider')
    const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

    const mockPayload = {} as any
    const mockModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => '{"result": "test"}',
        },
      }),
    }
    const mockClient = {
      getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    }
    ;(getGeminiClient as any).mockResolvedValue(mockClient)

    const result = await generateMultimodalCompletion(
      {
        prompt: 'Extract exercises from this PDF',
        model: { name: 'gemini-1.5-pro', temperature: 0.1, maxOutputTokens: 8192 },
        attachments: [{ data: 'base64data', mimeType: 'application/pdf' }],
      },
      mockPayload,
    )

    expect(getGeminiClient).toHaveBeenCalledWith(mockPayload)
    expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-1.5-pro',
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    })
    expect(mockModel.generateContent).toHaveBeenCalled()
    expect(result.text).toBe('{"result": "test"}')
  })

  it('should handle timeout', async () => {
    const { generateMultimodalCompletion } =
      await import('@/infra/llm/providers/gemini/gemini.provider')
    const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

    const mockPayload = {} as any
    const mockModel = {
      generateContent: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({
                response: {
                  text: () => 'late response',
                },
              })
            }, 100),
          ),
      ),
    }
    const mockClient = {
      getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    }
    ;(getGeminiClient as any).mockResolvedValue(mockClient)

    await expect(
      generateMultimodalCompletion(
        {
          prompt: 'Test',
          model: { name: 'gemini-1.5-pro', temperature: 0.1, maxOutputTokens: 8192 },
          attachments: [{ data: 'base64', mimeType: 'application/pdf' }],
          timeoutMs: 10,
        },
        mockPayload,
      ),
    ).rejects.toThrow('timed out')
  })

  it('should include attachments in the request', async () => {
    const { generateMultimodalCompletion } =
      await import('@/infra/llm/providers/gemini/gemini.provider')
    const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

    const mockPayload = {} as any
    const mockModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'ok',
        },
      }),
    }
    const mockClient = {
      getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    }
    ;(getGeminiClient as any).mockResolvedValue(mockClient)

    await generateMultimodalCompletion(
      {
        prompt: 'Test prompt',
        model: { name: 'gemini-1.5-pro', temperature: 0.1, maxOutputTokens: 8192 },
        attachments: [
          { data: 'pdf-base64', mimeType: 'application/pdf' },
          { data: 'image-base64', mimeType: 'image/png' },
        ],
      },
      mockPayload,
    )

    expect(mockModel.generateContent).toHaveBeenCalledWith({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Test prompt' },
            { inlineData: { data: 'pdf-base64', mimeType: 'application/pdf' } },
            { inlineData: { data: 'image-base64', mimeType: 'image/png' } },
          ],
        },
      ],
    })
  })
})

describe('GenerateMultimodalInput type', () => {
  it('should accept valid input structure', () => {
    // Type assertion test - validates the type structure at compile time
    const validInput = {
      prompt: 'Test prompt',
      model: { name: 'gemini-1.5-pro', temperature: 0.1, maxOutputTokens: 8192 } as AIModel,
      attachments: [{ data: 'base64', mimeType: 'application/pdf' as const }],
      timeoutMs: 30000,
    }

    // Validate structure
    expect(validInput.prompt).toBe('Test prompt')
    expect(validInput.model.name).toBe('gemini-1.5-pro')
    expect(validInput.attachments).toHaveLength(1)
    expect(validInput.timeoutMs).toBe(30000)

    // Verify it's assignable to GenerateMultimodalInput
    const _typeCheck: GenerateMultimodalInput = validInput
  })
})
