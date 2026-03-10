/**
 * LLM Model Configuration Integration Tests
 *
 * Validates that model configurations are correctly set up for each provider.
 * These tests verify the configuration structure without making actual API calls.
 *
 * Run with:
 *   pnpm test:int -- tests/int/llm-model-reply-validation.int.spec.ts
 *
 * Prerequisites:
 *   - MongoDB container running (testcontainers) or USE_MONGO_SERVICE=true
 *
 * Note: Actual API calls are tested separately in manual tests or e2e tests
 * because they require proper server-side runtime configuration.
 */
import type { AIModelKey } from '@/infra/llm/models'
import {
  LLMProviderType,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('LLM Model Configuration Validation', () => {
  let mongoUri: string
  let payload: Payload

  beforeAll(async () => {
    // Start MongoDB container for integration tests
    mongoUri = await startMongoContainer()
    process.env.DATABASE_URL = mongoUri
    process.env.PAYLOAD_SECRET = 'test-secret-key-for-integration-tests-only-minimum-32-chars'
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
    process.env.DEFAULT_TENANT_SLUG = 'default'

    // Initialize Payload
    payload = await getPayload({ config })
  }, 180000)

  afterAll(async () => {
    // Close DB connection before stopping container
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }

    await stopMongoContainer()
  })

  describe('Model Configuration Structure', () => {
    it('should have valid AIModel structure for all models and providers', () => {
      const modelKeys: AIModelKey[] = ['EXERCISE_CHAT', 'IMAGE_TO_EXERCISE', 'PDF_TO_EXERCISE']
      const providers = [LLMProviderType.GEMINI, LLMProviderType.OPENAI_COMPATIBLE]

      for (const provider of providers) {
        for (const modelKey of modelKeys) {
          const modelConfig = getProviderModelConfig(provider, modelKey)

          // Validate required AIModel fields
          expect(modelConfig).toHaveProperty('name')
          expect(modelConfig).toHaveProperty('temperature')
          expect(modelConfig).toHaveProperty('maxOutputTokens')

          // Validate field types
          expect(typeof modelConfig.name).toBe('string')
          expect(modelConfig.name.length).toBeGreaterThan(0)
          expect(typeof modelConfig.temperature).toBe('number')
          expect(typeof modelConfig.maxOutputTokens).toBe('number')
        }
      }
    })

    it('should have correct model names for Gemini provider', () => {
      // Gemini uses different models per task (EXERCISE_CHAT uses flash-lite)
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT').name).toBe(
        'gemini-3.1-flash-lite-preview',
      )
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE').name).toBe(
        'gemini-3.1-pro',
      )
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE').name).toBe(
        'gemini-3.1-pro',
      )
    })

    it('should have correct model names for OpenAI-compatible provider', () => {
      // OpenAI-compatible uses MiniMax-M2.1 for all models
      expect(getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'EXERCISE_CHAT').name).toBe(
        'MiniMax-M2.1',
      )
      expect(
        getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'IMAGE_TO_EXERCISE').name,
      ).toBe('MiniMax-M2.1')
      expect(
        getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'PDF_TO_EXERCISE').name,
      ).toBe('MiniMax-M2.1')
    })

    it('should have appropriate temperature settings per model use case', () => {
      // EXERCISE_CHAT: Higher temperature (0.7) for creative/chat responses
      const chatConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
      expect(chatConfig.temperature).toBe(0.7)
      expect(chatConfig.temperature).toBeGreaterThan(0.5) // Should be relatively high for creativity

      // IMAGE_TO_EXERCISE: Lower temperature (0.2) for consistent extraction
      const imageConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE')
      expect(imageConfig.temperature).toBe(0.2)
      expect(imageConfig.temperature).toBeLessThan(0.5) // Should be lower for consistency

      // PDF_TO_EXERCISE: Lowest temperature (0.1) for accurate extraction
      const pdfConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE')
      expect(pdfConfig.temperature).toBe(0.1)
      expect(pdfConfig.temperature).toBeLessThan(0.3) // Should be lowest for accuracy
    })

    it('should have appropriate maxOutputTokens per model use case', () => {
      // EXERCISE_CHAT: Moderate tokens for chat responses (2048)
      const chatConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
      expect(chatConfig.maxOutputTokens).toBe(2048)
      expect(chatConfig.maxOutputTokens).toBeLessThan(8192)

      // IMAGE_TO_EXERCISE: High tokens for detailed extraction (8192)
      const imageConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE')
      expect(imageConfig.maxOutputTokens).toBe(8192)

      // PDF_TO_EXERCISE: High tokens for document extraction (8192)
      const pdfConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE')
      expect(pdfConfig.maxOutputTokens).toBe(8192)
    })

    it('should have temperature within valid range (0.0 - 2.0)', () => {
      const modelKeys: AIModelKey[] = ['EXERCISE_CHAT', 'IMAGE_TO_EXERCISE', 'PDF_TO_EXERCISE']
      const providers = [LLMProviderType.GEMINI, LLMProviderType.OPENAI_COMPATIBLE]

      for (const provider of providers) {
        for (const modelKey of modelKeys) {
          const modelConfig = getProviderModelConfig(provider, modelKey)
          expect(modelConfig.temperature).toBeGreaterThanOrEqual(0.0)
          expect(modelConfig.temperature).toBeLessThanOrEqual(2.0)
        }
      }
    })

    it('should have positive maxOutputTokens', () => {
      const modelKeys: AIModelKey[] = ['EXERCISE_CHAT', 'IMAGE_TO_EXERCISE', 'PDF_TO_EXERCISE']
      const providers = [LLMProviderType.GEMINI, LLMProviderType.OPENAI_COMPATIBLE]

      for (const provider of providers) {
        for (const modelKey of modelKeys) {
          const modelConfig = getProviderModelConfig(provider, modelKey)
          expect(modelConfig.maxOutputTokens).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Provider Model Name Getters', () => {
    it('should return correct model names via getProviderModelConfig', () => {
      // Gemini provider
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT').name).toBe(
        'gemini-3.1-flash-lite-preview',
      )
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE').name).toBe(
        'gemini-3.1-pro',
      )
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE').name).toBe(
        'gemini-3.1-pro',
      )

      // OpenAI-compatible provider
      expect(getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'EXERCISE_CHAT').name).toBe(
        'MiniMax-M2.1',
      )
      expect(
        getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'IMAGE_TO_EXERCISE').name,
      ).toBe('MiniMax-M2.1')
      expect(
        getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'PDF_TO_EXERCISE').name,
      ).toBe('MiniMax-M2.1')
    })
  })

  describe('Provider Switching via Environment', () => {
    beforeEach(() => {
      // Clean up env vars before each test
      delete process.env.LLM_PROVIDER
      delete process.env.LLM_MODEL_OVERRIDE_DEFAULT
      delete process.env.LLM_MODEL_OVERRIDE_EXERCISE_CHAT
      delete process.env.LLM_MODEL_OVERRIDE_IMAGE_TO_EXERCISE
      delete process.env.LLM_MODEL_OVERRIDE_PDF_TO_EXERCISE
    })

    it('should switch to Gemini when LLM_PROVIDER=gemini', async () => {
      process.env.LLM_PROVIDER = 'gemini'
      const providerType = await getProviderTypeFromEnv()
      expect(providerType).toBe(LLMProviderType.GEMINI)

      const modelConfig = getProviderModelConfig(providerType, 'EXERCISE_CHAT')
      expect(modelConfig.name).toBe('gemini-3.1-flash-lite-preview')
    })

    it('should switch to OpenAI-compatible when LLM_PROVIDER=openai-compatible', async () => {
      process.env.LLM_PROVIDER = 'openai-compatible'
      const providerType = await getProviderTypeFromEnv()
      expect(providerType).toBe(LLMProviderType.OPENAI_COMPATIBLE)

      const modelConfig = getProviderModelConfig(providerType, 'EXERCISE_CHAT')
      expect(modelConfig.name).toBe('MiniMax-M2.1')
    })

    it('should default to Gemini for unknown LLM_PROVIDER values', async () => {
      process.env.LLM_PROVIDER = 'unknown-provider'
      const providerType = await getProviderTypeFromEnv()
      expect(providerType).toBe(LLMProviderType.GEMINI)
    })

    it('should default to Gemini when LLM_PROVIDER is not set', async () => {
      delete process.env.LLM_PROVIDER
      const providerType = await getProviderTypeFromEnv()
      expect(providerType).toBe(LLMProviderType.GEMINI)
    })

    it('should be case-insensitive for LLM_PROVIDER', async () => {
      process.env.LLM_PROVIDER = 'OPENAI-COMPATIBLE'
      expect(await getProviderTypeFromEnv()).toBe(LLMProviderType.OPENAI_COMPATIBLE)

      process.env.LLM_PROVIDER = 'Gemini'
      expect(await getProviderTypeFromEnv()).toBe(LLMProviderType.GEMINI)
    })
  })

  describe('Model Configuration Consistency', () => {
    it('should have consistent temperature settings across providers for same model key', () => {
      // Temperature should be the same regardless of provider (it's a model use case setting)
      const modelKeys: AIModelKey[] = ['EXERCISE_CHAT', 'IMAGE_TO_EXERCISE', 'PDF_TO_EXERCISE']

      for (const modelKey of modelKeys) {
        const geminiConfig = getProviderModelConfig(LLMProviderType.GEMINI, modelKey)
        const openaiConfig = getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, modelKey)

        // Temperature should match (it's defined by model use case, not provider)
        expect(geminiConfig.temperature).toBe(openaiConfig.temperature)
        expect(geminiConfig.maxOutputTokens).toBe(openaiConfig.maxOutputTokens)
      }
    })

    it('should have different temperature settings for different model use cases', () => {
      // All three models should have different temperatures
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT').temperature).not.toBe(
        getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE').temperature,
      )
      expect(getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT').temperature).not.toBe(
        getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE').temperature,
      )
      expect(
        getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE').temperature,
      ).not.toBe(getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE').temperature)
    })
  })

  describe('Provider Availability Check', () => {
    it('should check Gemini provider availability via factory', async () => {
      const { checkProviderAvailability } = await import('@/infra/llm/providers/factory')
      const availability = await checkProviderAvailability(payload)

      expect(availability).toHaveProperty('gemini')
      expect(availability).toHaveProperty('openai-compatible')
      expect(typeof availability.gemini).toBe('boolean')
      expect(typeof availability['openai-compatible']).toBe('boolean')
    })

    it('should detect best available provider', async () => {
      const { detectBestProvider } = await import('@/infra/llm/providers/factory')
      const bestProvider = await detectBestProvider(payload)

      // Best provider should be one of the valid types
      const isValidProvider =
        bestProvider === LLMProviderType.GEMINI ||
        bestProvider === LLMProviderType.OPENAI_COMPATIBLE
      expect(isValidProvider).toBe(true)
    })
  })
})

describe('LLM Model API Validation (Manual Test)', () => {
  /**
   * These tests require actual API keys and server-side runtime configuration.
   * Run manually with:
   *
   * For Gemini:
   *   GEMINI_API_KEY=your-key pnpm exec vitest run tests/int/llm-model-reply-validation.int.spec.ts -t "Gemini Provider API"
   *
   * For OpenAI-compatible (MiniMax):
   *   OPENAI_COMPATIBLE_API_KEY=your-key pnpm exec vitest run tests/int/llm-model-reply-validation.int.spec.ts -t "OpenAI-Compatible Provider API"
   */

  describe('Gemini Provider API', () => {
    const originalEnv = process.env.LLM_PROVIDER

    beforeAll(() => {
      process.env.LLM_PROVIDER = 'gemini'
    })

    afterAll(() => {
      if (originalEnv !== undefined) {
        process.env.LLM_PROVIDER = originalEnv
      } else {
        delete process.env.LLM_PROVIDER
      }
    })

    it.skipIf(!process.env.GEMINI_API_KEY)(
      'should validate EXERCISE_CHAT model configuration for Gemini API',
      async () => {
        const modelConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
        expect(modelConfig.name).toBe('gemini-3.1-flash-lite-preview')
        expect(modelConfig.temperature).toBe(0.7)
        expect(modelConfig.maxOutputTokens).toBe(2048)
        // Actual API call would go here in a full integration test
      },
      30000,
    )

    it.skipIf(!process.env.GEMINI_API_KEY)(
      'should validate IMAGE_TO_EXERCISE model configuration for Gemini API',
      async () => {
        const modelConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'IMAGE_TO_EXERCISE')
        expect(modelConfig.name).toBe('gemini-3.1-pro')
        expect(modelConfig.temperature).toBe(0.2)
        expect(modelConfig.maxOutputTokens).toBe(8192)
        // Actual API call would go here in a full integration test
      },
      30000,
    )

    it.skipIf(!process.env.GEMINI_API_KEY)(
      'should validate PDF_TO_EXERCISE model configuration for Gemini API',
      async () => {
        const modelConfig = getProviderModelConfig(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE')
        expect(modelConfig.name).toBe('gemini-3.1-pro')
        expect(modelConfig.temperature).toBe(0.1)
        expect(modelConfig.maxOutputTokens).toBe(8192)
        // Actual API call would go here in a full integration test
      },
      30000,
    )
  })

  describe('OpenAI-Compatible Provider API', () => {
    beforeAll(() => {
      process.env.LLM_PROVIDER = 'openai-compatible'
    })

    afterAll(() => {
      delete process.env.LLM_PROVIDER
    })

    it.skipIf(!process.env.OPENAI_COMPATIBLE_API_KEY)(
      'should validate EXERCISE_CHAT model configuration for OpenAI API',
      async () => {
        const modelConfig = getProviderModelConfig(
          LLMProviderType.OPENAI_COMPATIBLE,
          'EXERCISE_CHAT',
        )
        expect(modelConfig.name).toBe('MiniMax-M2.1')
        expect(modelConfig.temperature).toBe(0.7)
        expect(modelConfig.maxOutputTokens).toBe(2048)
        // Actual API call would go here in a full integration test
      },
      30000,
    )

    it.skipIf(!process.env.OPENAI_COMPATIBLE_API_KEY)(
      'should validate IMAGE_TO_EXERCISE model configuration for OpenAI API',
      async () => {
        const modelConfig = getProviderModelConfig(
          LLMProviderType.OPENAI_COMPATIBLE,
          'IMAGE_TO_EXERCISE',
        )
        expect(modelConfig.name).toBe('MiniMax-M2.1')
        expect(modelConfig.temperature).toBe(0.2)
        expect(modelConfig.maxOutputTokens).toBe(8192)
        // Actual API call would go here in a full integration test
      },
      30000,
    )

    it.skipIf(!process.env.OPENAI_COMPATIBLE_API_KEY)(
      'should validate PDF_TO_EXERCISE model configuration for OpenAI API',
      async () => {
        const modelConfig = getProviderModelConfig(
          LLMProviderType.OPENAI_COMPATIBLE,
          'PDF_TO_EXERCISE',
        )
        expect(modelConfig.name).toBe('MiniMax-M2.1')
        expect(modelConfig.temperature).toBe(0.1)
        expect(modelConfig.maxOutputTokens).toBe(8192)
        // Actual API call would go here in a full integration test
      },
      30000,
    )
  })
})
