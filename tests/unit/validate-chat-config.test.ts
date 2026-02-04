/**
 * Unit Tests for Chat Config Validation
 *
 * @fileType unit-test
 * @domain config.validation
 */

import { validateChatConfigSync } from '@/infra/config/runtime/validate-chat-config'
import { describe, expect, test } from 'vitest'

describe('validateChatConfigSync', () => {
  describe('valid config', () => {
    test('should pass validation with valid complete config', () => {
      const validConfig = {
        chatSettings: {
          maxToolIterations: 5,
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(validConfig)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('missing required paths', () => {
    test('should fail when chatSettings is missing', () => {
      const invalidConfig = {
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('chatSettings.defaultChatTimeoutMs must be a number')
    })

    test('should fail when retry.exponentialBase is missing', () => {
      const invalidConfig = {
        chatSettings: {
          maxToolIterations: 5,
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('retry.exponentialBase must be a number')
    })
  })

  describe('type validation', () => {
    test('should fail when values are wrong type', () => {
      const invalidConfig = {
        chatSettings: {
          maxToolIterations: '5' as unknown as number, // Wrong type
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('chatSettings.maxToolIterations must be a number')
    })
  })

  describe('value range validation', () => {
    test('should fail when temperature default is out of range', () => {
      const invalidConfig = {
        chatSettings: {
          maxToolIterations: 5,
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 3, // Out of range
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('temperature.default must be between min and max')
    })

    test('should fail when jitterFactor is out of range', () => {
      const invalidConfig = {
        chatSettings: {
          maxToolIterations: 5,
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 1.5, // Out of range
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 4096,
          maxMax: 128000,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('retry.jitterFactor must be between 0 and 1')
    })
  })

  describe('warnings', () => {
    test('should warn when defaultMax is greater than maxMax', () => {
      const configWithWarning = {
        chatSettings: {
          maxToolIterations: 5,
          defaultMaxRetries: 2,
          defaultRetryDelayMs: 1000,
          defaultChatTimeoutMs: 30000,
          defaultToolTimeoutMs: 60000,
        },
        retry: {
          maxRetries: 2,
          delayMs: 1000,
          exponentialBase: 2,
          jitterFactor: 0.1,
        },
        temperature: {
          min: 0,
          max: 2,
          default: 0.7,
        },
        tokens: {
          defaultMax: 128000, // Greater than maxMax
          maxMax: 4096,
        },
        multipart: {
          maxImages: 10,
          maxSizeMb: 20,
          supportedImages: ['image/jpeg'],
          supportedPdfs: ['application/pdf'],
        },
        models: {
          exerciseChat: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 2048,
            capabilities: ['multimodal', 'chat'],
          },
          imageToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['multimodal', 'vision'],
          },
          pdfToExercise: {
            gemini: 'gemini-2.0-flash-001',
            openaiCompatible: 'MiniMax-M2.1',
            maxOutputTokens: 8192,
            capabilities: ['document', 'extraction'],
          },
        },
      }

      const result = validateChatConfigSync(configWithWarning)
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('tokens.defaultMax is greater than tokens.maxMax')
    })
  })
})
