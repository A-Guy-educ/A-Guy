/**
 * Unit tests for src/infra/llm/models.ts
 * Tests the centralized model registry and helper functions
 */
import {
  AI_MODELS,
  getModelRegistryEntry,
  getModelsWithCapability,
  getProviderModelName,
  MODEL_REGISTRY,
  modelSupportsCapability,
  PROVIDER_MODEL_NAMES,
  type AIModelKey,
} from '@/infra/llm/models'
import { LLMProviderType } from '@/infra/llm/providers/factory'
import { describe, expect, it } from 'vitest'

describe('models.ts', () => {
  describe('MODEL_REGISTRY', () => {
    it('should have consistent structure for all models', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]

      for (const key of keys) {
        const model = MODEL_REGISTRY[key]
        expect(model.temperature).toBeDefined()
        expect(model.maxOutputTokens).toBeDefined()
        expect(typeof model.temperature).toBe('number')
        expect(typeof model.maxOutputTokens).toBe('number')
      }
    })

    it('should have temperature within valid range (0.0 - 2.0)', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]

      for (const key of keys) {
        const model = MODEL_REGISTRY[key]
        expect(model.temperature).toBeGreaterThanOrEqual(0)
        expect(model.temperature).toBeLessThanOrEqual(2)
      }
    })

    it('should have positive maxOutputTokens', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]

      for (const key of keys) {
        const model = MODEL_REGISTRY[key]
        expect(model.maxOutputTokens).toBeGreaterThan(0)
      }
    })

    it('should define expected model keys', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]
      expect(keys).toContain('IMAGE_TO_EXERCISE')
      expect(keys).toContain('EXERCISE_CHAT')
      expect(keys).toContain('PDF_TO_EXERCISE')
    })
  })

  describe('PROVIDER_MODEL_NAMES', () => {
    it('should have provider mapping for all providers', () => {
      const providers = Object.values(LLMProviderType)
      const modelKeys = Object.keys(PROVIDER_MODEL_NAMES[providers[0]]) as AIModelKey[]

      for (const provider of providers) {
        for (const modelKey of modelKeys) {
          expect(PROVIDER_MODEL_NAMES[provider][modelKey]).toBeDefined()
          expect(typeof PROVIDER_MODEL_NAMES[provider][modelKey]).toBe('string')
        }
      }
    })

    it('should have non-empty model names for all providers', () => {
      const providers = Object.values(LLMProviderType)

      for (const provider of providers) {
        const modelNames = Object.values(PROVIDER_MODEL_NAMES[provider])
        for (const name of modelNames) {
          expect(name.trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('should have different model names for different providers', () => {
      // At least one model should differ between providers
      const geminiModels = PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI]
      const openaiModels = PROVIDER_MODEL_NAMES[LLMProviderType.OPENAI_COMPATIBLE]

      const allDiffer = Object.keys(geminiModels).every(
        (key) => geminiModels[key as AIModelKey] !== openaiModels[key as AIModelKey],
      )
      expect(allDiffer).toBe(true)
    })
  })

  describe('AI_MODELS (backward compatibility)', () => {
    it('should match MODEL_REGISTRY for gemini provider', () => {
      const keys = Object.keys(AI_MODELS) as AIModelKey[]

      for (const key of keys) {
        expect(AI_MODELS[key].temperature).toBe(MODEL_REGISTRY[key].temperature)
        expect(AI_MODELS[key].maxOutputTokens).toBe(MODEL_REGISTRY[key].maxOutputTokens)
      }
    })

    it('should use Gemini provider model names by default', () => {
      const keys = Object.keys(AI_MODELS) as AIModelKey[]

      for (const key of keys) {
        expect(AI_MODELS[key].name).toBe(PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI][key])
      }
    })

    it('should have all required fields', () => {
      const keys = Object.keys(AI_MODELS) as AIModelKey[]

      for (const key of keys) {
        const model = AI_MODELS[key]
        expect(model).toHaveProperty('name')
        expect(model).toHaveProperty('temperature')
        expect(model).toHaveProperty('maxOutputTokens')
      }
    })
  })

  describe('getModelRegistryEntry', () => {
    it('should return correct registry entry for valid key', () => {
      const entry = getModelRegistryEntry('EXERCISE_CHAT')
      expect(entry).toBeDefined()
      expect(entry.temperature).toBeDefined()
      expect(entry.maxOutputTokens).toBeDefined()
    })

    it('should return all properties except name', () => {
      const entry = getModelRegistryEntry('IMAGE_TO_EXERCISE')
      expect(entry).not.toHaveProperty('name')
      expect(entry).toHaveProperty('temperature')
      expect(entry).toHaveProperty('maxOutputTokens')
      expect(entry).toHaveProperty('capabilities')
    })
  })

  describe('getProviderModelName', () => {
    it('should return correct model name for Gemini provider', () => {
      const name = getProviderModelName(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
      expect(name).toBe(PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].EXERCISE_CHAT)
    })

    it('should return correct model name for OpenAI-compatible provider', () => {
      const name = getProviderModelName(LLMProviderType.OPENAI_COMPATIBLE, 'EXERCISE_CHAT')
      expect(name).toBe(PROVIDER_MODEL_NAMES[LLMProviderType.OPENAI_COMPATIBLE].EXERCISE_CHAT)
    })

    it('should return correct model name for PDF_TO_EXERCISE', () => {
      const geminiName = getProviderModelName(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE')
      expect(geminiName).toBe('gemini-2.0-flash-001')

      const openaiName = getProviderModelName(LLMProviderType.OPENAI_COMPATIBLE, 'PDF_TO_EXERCISE')
      expect(openaiName).toBe('MiniMax-M2.1')
    })
  })

  describe('modelSupportsCapability', () => {
    it('should return true when model has capability', () => {
      expect(modelSupportsCapability('IMAGE_TO_EXERCISE', 'multimodal')).toBe(true)
      expect(modelSupportsCapability('IMAGE_TO_EXERCISE', 'vision')).toBe(true)
      expect(modelSupportsCapability('EXERCISE_CHAT', 'multimodal')).toBe(true)
      expect(modelSupportsCapability('EXERCISE_CHAT', 'chat')).toBe(true)
      expect(modelSupportsCapability('PDF_TO_EXERCISE', 'document')).toBe(true)
      expect(modelSupportsCapability('PDF_TO_EXERCISE', 'extraction')).toBe(true)
    })

    it('should return false when model does not have capability', () => {
      expect(modelSupportsCapability('EXERCISE_CHAT', 'vision')).toBe(false)
      expect(modelSupportsCapability('PDF_TO_EXERCISE', 'chat')).toBe(false)
      expect(modelSupportsCapability('IMAGE_TO_EXERCISE', 'chat')).toBe(false)
    })

    it('should return false for unknown capability', () => {
      expect(modelSupportsCapability('IMAGE_TO_EXERCISE', 'unknown')).toBe(false)
    })
  })

  describe('getModelsWithCapability', () => {
    it('should return models that have the multimodal capability', () => {
      const multimodalModels = getModelsWithCapability('multimodal')
      expect(multimodalModels).toContain('IMAGE_TO_EXERCISE')
      expect(multimodalModels).toContain('EXERCISE_CHAT')
      expect(multimodalModels).not.toContain('PDF_TO_EXERCISE')
    })

    it('should return models that have the document capability', () => {
      const documentModels = getModelsWithCapability('document')
      expect(documentModels).toContain('PDF_TO_EXERCISE')
      expect(documentModels).not.toContain('IMAGE_TO_EXERCISE')
      expect(documentModels).not.toContain('EXERCISE_CHAT')
    })

    it('should return empty array for non-existent capability', () => {
      const models = getModelsWithCapability('nonExistent')
      expect(models).toEqual([])
    })
  })

  describe('model configurations', () => {
    it('should have appropriate temperature settings for different use cases', () => {
      // IMAGE_TO_EXERCISE: Low temperature for deterministic JSON output
      expect(MODEL_REGISTRY.IMAGE_TO_EXERCISE.temperature).toBeLessThanOrEqual(0.3)

      // EXERCISE_CHAT: Higher temperature for natural conversation
      expect(MODEL_REGISTRY.EXERCISE_CHAT.temperature).toBeGreaterThanOrEqual(0.5)

      // PDF_TO_EXERCISE: Low temperature for structured extraction
      expect(MODEL_REGISTRY.PDF_TO_EXERCISE.temperature).toBeLessThanOrEqual(0.2)
    })

    it('should have appropriate maxOutputTokens for different use cases', () => {
      // Chat should have smaller output
      expect(MODEL_REGISTRY.EXERCISE_CHAT.maxOutputTokens).toBeLessThan(
        MODEL_REGISTRY.IMAGE_TO_EXERCISE.maxOutputTokens,
      )

      // Extraction models should have high token limits
      expect(MODEL_REGISTRY.IMAGE_TO_EXERCISE.maxOutputTokens).toBeGreaterThanOrEqual(8192)
      expect(MODEL_REGISTRY.PDF_TO_EXERCISE.maxOutputTokens).toBeGreaterThanOrEqual(8192)
    })
  })
})
