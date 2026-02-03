/**
 * Unit Tests for LLM Shared Utilities - Validation
 *
 * @fileType test
 * @domain ai
 */
import { validateChatInput, validateMultimodalInput } from '@/infra/llm/providers/shared/validation'
import { describe, expect, it } from 'vitest'

describe('validateChatInput', () => {
  const validInput = {
    messages: [{ role: 'user' as const, content: 'Hello' }],
    model: { temperature: 0.7, maxOutputTokens: 100 },
  }

  it('passes for valid input', () => {
    expect(() => validateChatInput(validInput, 'gemini')).not.toThrow()
  })

  it('throws when messages is missing', () => {
    expect(() =>
      validateChatInput({} as Parameters<typeof validateChatInput>[0], 'gemini'),
    ).toThrow('Messages array is required')
  })

  it('throws when messages is not an array', () => {
    expect(() =>
      validateChatInput(
        { messages: 'not an array' } as unknown as Parameters<typeof validateChatInput>[0],
        'gemini',
      ),
    ).toThrow('Messages must be an array')
  })

  it('throws when messages is empty', () => {
    expect(() =>
      validateChatInput(
        { messages: [], model: {} } as unknown as Parameters<typeof validateChatInput>[0],
        'gemini',
      ),
    ).toThrow('Messages array cannot be empty')
  })

  it('throws for invalid role', () => {
    // Use type assertion to test invalid role
    expect(() =>
      validateChatInput(
        {
          messages: [
            { role: 'invalid' as unknown as 'user' | 'assistant' | 'system', content: 'Hello' },
          ],
          model: {},
        },
        'gemini',
      ),
    ).toThrow('Invalid role "invalid" at message index 0')
  })

  it('throws for temperature below minimum', () => {
    expect(() =>
      validateChatInput({ ...validInput, model: { temperature: -0.1 } }, 'gemini'),
    ).toThrow('Temperature must be between 0 and 2')
  })

  it('throws for temperature above maximum', () => {
    expect(() =>
      validateChatInput({ ...validInput, model: { temperature: 2.1 } }, 'gemini'),
    ).toThrow('Temperature must be between 0 and 2')
  })

  it('throws for negative maxOutputTokens', () => {
    expect(() =>
      validateChatInput({ ...validInput, model: { maxOutputTokens: -1 } }, 'gemini'),
    ).toThrow('maxOutputTokens must be positive')
  })

  it('throws for maxOutputTokens exceeding limit', () => {
    expect(() =>
      validateChatInput({ ...validInput, model: { maxOutputTokens: 200000 } }, 'gemini'),
    ).toThrow('maxOutputTokens cannot exceed 128000')
  })

  it('accepts valid system messages', () => {
    expect(() =>
      validateChatInput(
        {
          messages: [
            { role: 'system' as const, content: 'You are helpful' },
            { role: 'user' as const, content: 'Hello' },
          ],
          model: {},
        },
        'openai',
      ),
    ).not.toThrow()
  })
})

describe('validateMultimodalInput', () => {
  const validMultimodalInput = {
    messages: [{ role: 'user' as const, content: 'What is this?' }],
    mediaParts: [
      {
        mediaId: 'test-id',
        absoluteFilePath: '/test/file.png',
        publicUrl: 'https://example.com/file.png',
        mimeType: 'image/png',
      },
    ],
    model: { temperature: 0.7 },
  }

  it('passes for valid multimodal input', () => {
    expect(() => validateMultimodalInput(validMultimodalInput, 'gemini')).not.toThrow()
  })

  it('throws when mediaParts is missing', () => {
    expect(() =>
      validateMultimodalInput(
        {
          messages: validMultimodalInput.messages,
          mediaParts: undefined as unknown as [],
          model: {},
        },
        'gemini',
      ),
    ).toThrow('Media parts array is required for multimodal input')
  })

  it('throws when too many media parts', () => {
    const tooManyParts = {
      ...validMultimodalInput,
      mediaParts: Array(11).fill(validMultimodalInput.mediaParts[0]),
    }
    expect(() => validateMultimodalInput(tooManyParts, 'gemini')).toThrow(
      'Cannot process more than 10 media parts',
    )
  })

  it('throws for unsupported mime type', () => {
    expect(() =>
      validateMultimodalInput(
        {
          ...validMultimodalInput,
          mediaParts: [{ ...validMultimodalInput.mediaParts[0], mimeType: 'image/tiff' }],
        },
        'gemini',
      ),
    ).toThrow('Unsupported mime type "image/tiff" at media part index 0')
  })

  it('accepts valid image types', () => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    for (const mimeType of imageTypes) {
      expect(() =>
        validateMultimodalInput(
          {
            ...validMultimodalInput,
            mediaParts: [{ ...validMultimodalInput.mediaParts[0], mimeType }],
          },
          'gemini',
        ),
      ).not.toThrow()
    }
  })

  it('accepts PDF mime type', () => {
    expect(() =>
      validateMultimodalInput(
        {
          ...validMultimodalInput,
          mediaParts: [{ ...validMultimodalInput.mediaParts[0], mimeType: 'application/pdf' }],
        },
        'gemini',
      ),
    ).not.toThrow()
  })
})
