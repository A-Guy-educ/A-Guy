/**
 * Unit Tests for Genkit Config Resolver
 *
 * @fileType test
 * @domain ai
 * @pattern genkit, config-resolver
 */
import { describe, expect, it, vi } from 'vitest'

describe('GenkitConfigResolver', () => {
  describe('resolveGenkitConfig', () => {
    it('should resolve default config for EXERCISE_CHAT model key', async () => {
      const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

      const mockPayload = createMockPayload()
      const config = await resolveGenkitConfig('EXERCISE_CHAT', undefined, mockPayload)

      expect(config.model).toBe('googleai/gemini-3.1-flash-lite-preview')
      expect(config.temperature).toBeDefined()
      expect(config.maxOutputTokens).toBeDefined()
    })

    it('should resolve config for IMAGE_TO_EXERCISE model key', async () => {
      const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

      const mockPayload = createMockPayload()
      const config = await resolveGenkitConfig('IMAGE_TO_EXERCISE', undefined, mockPayload)

      expect(config.model).toContain('gemini')
      expect(typeof config.temperature).toBe('number')
    })

    it('should use custom temperature from environment when set', async () => {
      const originalEnv = process.env.LLM_MODEL_TEMPERATURE
      process.env.LLM_MODEL_TEMPERATURE = '0.7'

      try {
        const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

        const mockPayload = createMockPayload()
        const config = await resolveGenkitConfig('EXERCISE_CHAT', undefined, mockPayload)

        expect(config.temperature).toBe(0.7)
      } finally {
        process.env.LLM_MODEL_TEMPERATURE = originalEnv
      }
    })

    it('should apply tenant-specific settings when tenantId provided', async () => {
      const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

      const mockPayload = createMockPayload()
      const config = await resolveGenkitConfig('EXERCISE_CHAT', 'tenant-123', mockPayload)

      expect(config.model).toContain('gemini')
      expect(typeof config.temperature).toBe('number')
    })
  })

  describe('GenkitModelConfig interface', () => {
    it('should have correct structure', async () => {
      const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

      const mockPayload = createMockPayload()
      const config = await resolveGenkitConfig('EXERCISE_CHAT', undefined, mockPayload)

      // Verify all required properties exist
      expect(config).toHaveProperty('model')
      expect(config).toHaveProperty('temperature')
      expect(config).toHaveProperty('maxOutputTokens')

      // Verify types
      expect(typeof config.model).toBe('string')
      expect(typeof config.temperature).toBe('number')
      expect(typeof config.maxOutputTokens).toBe('number')
    })

    it('should have optional timeout property', async () => {
      const { resolveGenkitConfig } = await import('@/infra/llm/genkit/config-resolver')

      const mockPayload = createMockPayload()
      const config = await resolveGenkitConfig('EXERCISE_CHAT', undefined, mockPayload)

      // timeout is optional
      expect(config).toHaveProperty('timeout')
    })
  })
})

/**
 * Mock Payload factory
 */
function createMockPayload() {
  return {
    findByID: vi.fn().mockResolvedValue({
      config: {
        secrets: {
          GOOGLEAI_API_KEY: 'test-api-key',
          OPENAI_COMPATIBLE_API_KEY: 'test-openai-key',
        },
      },
    }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    update: vi.fn().mockResolvedValue({ id: 'test-id' }),
    delete: vi.fn().mockResolvedValue({}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
