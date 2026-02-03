/**
 * Unit Tests for LLM Provider Factory
 *
 * Tests the provider factory that handles runtime LLM provider switching
 * between Gemini and OpenAI-compatible providers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Save original env
const originalEnv = { ...process.env }

// Helper to set/unset env vars
const setEnv = (env: Record<string, string | undefined | null>) => {
  // Reset to clean state first
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  })
  // Apply new values
  Object.entries(env).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  })
}

describe('LLM Provider Factory', () => {
  beforeEach(() => {
    // Reset to original env before each test
    Object.keys(process.env).forEach((key) => {
      delete process.env[key]
    })
    Object.assign(process.env, originalEnv)
  })

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      delete process.env[key]
    })
    Object.assign(process.env, originalEnv)
  })

  describe('LLMProviderType', () => {
    it('should have correct provider types', async () => {
      const { LLMProviderType } = await import('@/infra/llm/providers/factory')
      expect(LLMProviderType.GEMINI).toBe('gemini')
      expect(LLMProviderType.OPENAI_COMPATIBLE).toBe('openai-compatible')
    })
  })

  describe('getProviderTypeFromEnv', () => {
    it('should return gemini when LLM_PROVIDER is gemini', async () => {
      setEnv({ LLM_PROVIDER: 'gemini' })
      const { getProviderTypeFromEnv } = await import('@/infra/llm/providers/factory')
      expect(getProviderTypeFromEnv()).toBe('gemini')
    })

    it('should return openai-compatible when LLM_PROVIDER is openai-compatible', async () => {
      setEnv({ LLM_PROVIDER: 'openai-compatible' })
      const { getProviderTypeFromEnv } = await import('@/infra/llm/providers/factory')
      expect(getProviderTypeFromEnv()).toBe('openai-compatible')
    })

    it('should return gemini for unknown values', async () => {
      setEnv({ LLM_PROVIDER: 'unknown' })
      const { getProviderTypeFromEnv } = await import('@/infra/llm/providers/factory')
      expect(getProviderTypeFromEnv()).toBe('gemini')
    })

    it('should return gemini when LLM_PROVIDER is not set', async () => {
      setEnv({ LLM_PROVIDER: null })
      const { getProviderTypeFromEnv } = await import('@/infra/llm/providers/factory')
      expect(getProviderTypeFromEnv()).toBe('gemini')
    })
  })

  describe('getOpenAICompatibleBaseUrl', () => {
    it('should return OPENAI_COMPATIBLE_BASE_URL when set', async () => {
      setEnv({ OPENAI_COMPATIBLE_BASE_URL: 'https://custom.openai.com' })
      const { getOpenAICompatibleBaseUrl } = await import('@/infra/llm/providers/factory')
      expect(getOpenAICompatibleBaseUrl()).toBe('https://custom.openai.com')
    })

    it('should fallback to OPENAI_BASE_URL when OPENAI_COMPATIBLE_BASE_URL is not set', async () => {
      setEnv({ OPENAI_COMPATIBLE_BASE_URL: null, OPENAI_BASE_URL: 'https://api.openai.com' })
      const { getOpenAICompatibleBaseUrl } = await import('@/infra/llm/providers/factory')
      expect(getOpenAICompatibleBaseUrl()).toBe('https://api.openai.com')
    })

    it('should return undefined when neither is set', async () => {
      setEnv({ OPENAI_COMPATIBLE_BASE_URL: null, OPENAI_BASE_URL: null })
      const { getOpenAICompatibleBaseUrl } = await import('@/infra/llm/providers/factory')
      expect(getOpenAICompatibleBaseUrl()).toBeUndefined()
    })
  })

  describe('getOpenAICompatibleApiKey', () => {
    it('should return OPENAI_COMPATIBLE_API_KEY when set', async () => {
      setEnv({ OPENAI_COMPATIBLE_API_KEY: 'custom-key' })
      const { getOpenAICompatibleApiKey } = await import('@/infra/llm/providers/factory')
      expect(getOpenAICompatibleApiKey()).toBe('custom-key')
    })

    it('should fallback to OPENAI_API_KEY when OPENAI_COMPATIBLE_API_KEY is not set', async () => {
      setEnv({ OPENAI_COMPATIBLE_API_KEY: null, OPENAI_API_KEY: 'openai-key' })
      const { getOpenAICompatibleApiKey } = await import('@/infra/llm/providers/factory')
      expect(getOpenAICompatibleApiKey()).toBe('openai-key')
    })
  })

  describe('getProviderModelConfig', () => {
    it('should return correct config for GEMINI provider', async () => {
      const { getProviderModelConfig, LLMProviderType } =
        await import('@/infra/llm/providers/factory')
      const config = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
      expect(config.name).toBe('gemini-2.0-flash-001')
      expect(config.temperature).toBe(0.7)
      expect(config.maxOutputTokens).toBe(2048) // EXERCISE_CHAT uses 2048
    })

    it('should return correct config for OPENAI_COMPATIBLE provider', async () => {
      const { getProviderModelConfig, LLMProviderType } =
        await import('@/infra/llm/providers/factory')
      const config = getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'EXERCISE_CHAT')
      expect(config.name).toBe('MiniMax-M2.1')
      expect(config.temperature).toBe(0.7)
      expect(config.maxOutputTokens).toBe(2048)
    })

    it('should use default model key when not specified', async () => {
      const { getProviderModelConfig, LLMProviderType } =
        await import('@/infra/llm/providers/factory')
      const config = getProviderModelConfig(LLMProviderType.GEMINI)
      expect(config.name).toBe('gemini-2.0-flash-001')
    })

    it('should return correct config for IMAGE_TO_EXERCISE', async () => {
      const { getProviderModelConfig, LLMProviderType } =
        await import('@/infra/llm/providers/factory')
      const config = getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE')
      expect(config.name).toBe('gemini-2.0-flash-001')
      expect(config.maxOutputTokens).toBe(8192) // IMAGE_TO_EXERCISE uses 8192
    })

    it('should return correct config for PDF_TO_EXERCISE', async () => {
      const { getProviderModelConfig, LLMProviderType } =
        await import('@/infra/llm/providers/factory')
      const config = getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'PDF_TO_EXERCISE')
      expect(config.name).toBe('MiniMax-M2.1')
      expect(config.maxOutputTokens).toBe(8192) // PDF_TO_EXERCISE uses 8192
    })
  })
})
