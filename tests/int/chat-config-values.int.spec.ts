// @vitest-environment node
/**
 * Chat Config Values Integration Tests
 *
 * @fileType integration-test
 * @domain llm.chat-config
 * @pattern domain-config, json-storage, tenant-scoped
 * @ai-summary Integration tests for ChatConfig collection and runtime loader
 */

import { ConfigDomain } from '@/infra/config/config-constants'
import type { Tenant, User } from '@/payload-types'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Test data
const TEST_ADMIN_EMAIL = 'chat-config-test-admin@example.com'
const TEST_ADMIN_PASSWORD = 'test-password-min-32-chars!!'
const TEST_TENANT_SLUG = 'chat-config-test-tenant'

describe('ChatConfig Values', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let _adminUser: User
  let tenant: Tenant

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Create or find admin user for tests
    try {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      if (users.docs.length > 0) {
        _adminUser = users.docs[0]
      } else {
        _adminUser = await payload.create({
          collection: 'users',
          data: {
            email: TEST_ADMIN_EMAIL,
            password: TEST_ADMIN_PASSWORD,
            role: 'admin',
            tier: 'free',
          },
        })
      }
    } catch {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      _adminUser = users.docs[0]
    }

    // Create or find test tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_SLUG } },
    })
    if (tenants.docs.length > 0) {
      tenant = tenants.docs[0]
    } else {
      tenant = await payload.create({
        collection: 'tenants',
        data: { name: 'Chat Config Test Tenant', slug: TEST_TENANT_SLUG },
        overrideAccess: true,
      })
    }

    // Import and seed the default tenant with chat config
    const { seedChatConfig } = await import('@/server/payload/endpoints/seed/chat-config')
    const { getDefaultTenantId } = await import('@/server/repos/tenant/get-default-tenant')

    // Get default tenant ID
    const defaultTenantId = await getDefaultTenantId(payload)

    // Seed chat config for both test tenant AND default tenant
    // This ensures getChatConfig() works (it uses default tenant)
    await seedChatConfig(payload, tenant.id)
    if (defaultTenantId) {
      await seedChatConfig(payload, defaultTenantId)
    }
  })

  afterAll(async () => {
    // Cleanup test data
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [{ domain: { equals: ConfigDomain.Chat } }, { tenant: { equals: tenant.id } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('ChatConfig Loading', () => {
    test('all expected paths are accessible via getChatConfig', async () => {
      // Import the runtime loader functions
      const { loadConfigValues, clearConfigValuesCache } =
        await import('@/infra/config/runtime/config-values')

      // Clear cache and reload WITHOUT tenant filter to populate default tenant cache
      // This is critical because getChatConfig() uses the cached default tenant
      clearConfigValuesCache()
      await loadConfigValues(payload)

      // Get chat config using the dedicated getter
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      // Verify chatSettings
      expect(config.chatSettings.defaultChatTimeoutMs).toBeTypeOf('number')
      expect(config.chatSettings.defaultMaxRetries).toBeTypeOf('number')
      expect(config.chatSettings.defaultRetryDelayMs).toBeTypeOf('number')
      expect(config.chatSettings.defaultToolTimeoutMs).toBeTypeOf('number')
      expect(config.chatSettings.maxToolIterations).toBeTypeOf('number')

      // Verify retry (now complete with exponentialBase and jitterFactor)
      expect(config.retry.maxRetries).toBeTypeOf('number')
      expect(config.retry.delayMs).toBeTypeOf('number')
      expect(config.retry.exponentialBase).toBeTypeOf('number')
      expect(config.retry.jitterFactor).toBeTypeOf('number')

      // Verify temperature
      expect(config.temperature.default).toBeTypeOf('number')
      expect(config.temperature.min).toBeTypeOf('number')
      expect(config.temperature.max).toBeTypeOf('number')

      // Verify tokens (now complete)
      expect(config.tokens.defaultMax).toBeTypeOf('number')
      expect(config.tokens.maxMax).toBeTypeOf('number')

      // Verify multipart
      expect(config.multipart.maxImages).toBeTypeOf('number')
      expect(config.multipart.maxSizeMb).toBeTypeOf('number')
      expect(config.multipart.supportedImages).toBeInstanceOf(Array)
      expect(config.multipart.supportedPdfs).toBeInstanceOf(Array)

      // Verify models
      expect(config.models.exerciseChat.gemini).toBeTypeOf('string')
      expect(config.models.exerciseChat.openaiCompatible).toBeTypeOf('string')
      expect(config.models.exerciseChat.maxOutputTokens).toBeTypeOf('number')
      expect(config.models.exerciseChat.capabilities).toBeInstanceOf(Array)
    })

    test('values match expected ranges', async () => {
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      // Timeouts should be positive
      expect(config.chatSettings.defaultChatTimeoutMs).toBeGreaterThan(0)
      expect(config.chatSettings.defaultToolTimeoutMs).toBeGreaterThan(0)

      // Temperature bounds should be valid
      expect(config.temperature.min).toBeLessThan(config.temperature.max)
      expect(config.temperature.default).toBeGreaterThanOrEqual(config.temperature.min)
      expect(config.temperature.default).toBeLessThanOrEqual(config.temperature.max)

      // Retry config should be sensible
      expect(config.retry.exponentialBase).toBeGreaterThanOrEqual(1)
      expect(config.retry.jitterFactor).toBeGreaterThanOrEqual(0)
      expect(config.retry.jitterFactor).toBeLessThanOrEqual(1)

      // Token limits
      expect(config.tokens.maxMax).toBeGreaterThan(config.tokens.defaultMax)

      // Multipart limits
      expect(config.multipart.maxImages).toBeGreaterThan(0)
      expect(config.multipart.maxSizeMb).toBeGreaterThan(0)
      expect(config.multipart.supportedImages.length).toBeGreaterThan(0)
      expect(config.multipart.supportedPdfs.length).toBeGreaterThan(0)
    })
  })

  describe('ChatConfig Contract', () => {
    test('getModelConfig returns correct structure', async () => {
      const { getModelConfig, getChatConfig } =
        await import('@/infra/llm/providers/shared/chat-config')
      const chatConfig = await getChatConfig()

      // Test gemini exerciseChat model
      const modelConfig = await getModelConfig('gemini', 'exerciseChat')

      expect(modelConfig).toHaveProperty('name')
      expect(modelConfig).toHaveProperty('temperature')
      expect(modelConfig).toHaveProperty('maxOutputTokens')
      expect(modelConfig).toHaveProperty('capabilities')

      expect(modelConfig.name).toBe(chatConfig.models.exerciseChat.gemini)
      expect(modelConfig.maxOutputTokens).toBe(chatConfig.models.exerciseChat.maxOutputTokens)
    })

    test('all model tasks return valid configs', async () => {
      const { getModelConfig } = await import('@/infra/llm/providers/shared/chat-config')

      const tasks = ['exerciseChat', 'imageToExercise', 'pdfToExercise'] as const
      const providers = ['gemini', 'openaiCompatible'] as const

      for (const task of tasks) {
        for (const provider of providers) {
          const config = await getModelConfig(provider, task)
          expect(config.name).toBeTruthy()
          expect(config.maxOutputTokens).toBeGreaterThan(0)
          expect(config.capabilities).toBeInstanceOf(Array)
          expect(config.capabilities.length).toBeGreaterThan(0)
        }
      }
    })

    test('model capabilities are valid strings', async () => {
      const { getModelConfig } = await import('@/infra/llm/providers/shared/chat-config')

      const exerciseChatConfig = await getModelConfig('gemini', 'exerciseChat')
      expect(exerciseChatConfig.capabilities).toContain('multimodal')
      expect(exerciseChatConfig.capabilities).toContain('chat')

      const imageToExerciseConfig = await getModelConfig('gemini', 'imageToExercise')
      expect(imageToExerciseConfig.capabilities).toContain('multimodal')
      expect(imageToExerciseConfig.capabilities).toContain('vision')

      const pdfToExerciseConfig = await getModelConfig('gemini', 'pdfToExercise')
      expect(pdfToExerciseConfig.capabilities).toContain('document')
      expect(pdfToExerciseConfig.capabilities).toContain('extraction')
    })
  })

  describe('ChatConfig via Direct Domain Access', () => {
    test('can access chat config via getConfigDomain', async () => {
      const { loadConfigValues, clearConfigValuesCache, getConfigDomain } =
        await import('@/infra/config/runtime/config-values')

      // Load all config (includes default tenant which has chat config seeded)
      clearConfigValuesCache()
      await loadConfigValues(payload)

      // Get chat config using the test tenant (which has chat config seeded in beforeAll)
      const chatConfig = await getConfigDomain(ConfigDomain.Chat, {
        tenantId: tenant.id,
      })

      // Verify all top-level sections exist
      expect(chatConfig).toHaveProperty('chatSettings')
      expect(chatConfig).toHaveProperty('retry')
      expect(chatConfig).toHaveProperty('temperature')
      expect(chatConfig).toHaveProperty('tokens')
      expect(chatConfig).toHaveProperty('multipart')
      expect(chatConfig).toHaveProperty('models')

      // Verify nested properties
      expect(chatConfig.chatSettings).toHaveProperty('defaultChatTimeoutMs')
      expect(chatConfig.retry).toHaveProperty('maxRetries')
      expect(chatConfig.temperature).toHaveProperty('default')
      expect(chatConfig.models).toHaveProperty('exerciseChat')
    })
  })

  describe('ChatConfig Validation', () => {
    test('retry configuration is consistent with chatSettings defaults', async () => {
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      // Both retry configs should have the same values
      expect(config.retry.maxRetries).toBe(config.chatSettings.defaultMaxRetries)
      expect(config.retry.delayMs).toBe(config.chatSettings.defaultRetryDelayMs)
    })

    test('timeout configurations are consistent', async () => {
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      // Tool timeout should be >= chat timeout
      expect(config.chatSettings.defaultToolTimeoutMs).toBeGreaterThanOrEqual(
        config.chatSettings.defaultChatTimeoutMs,
      )
    })

    test('temperature default is within bounds', async () => {
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      expect(config.temperature.default).toBeGreaterThanOrEqual(config.temperature.min)
      expect(config.temperature.default).toBeLessThanOrEqual(config.temperature.max)
    })

    test('supported MIME types include expected formats', async () => {
      const { getChatConfig } = await import('@/infra/llm/providers/shared/chat-config')
      const config = await getChatConfig()

      // Check expected image formats
      expect(config.multipart.supportedImages).toContain('image/jpeg')
      expect(config.multipart.supportedImages).toContain('image/png')
      expect(config.multipart.supportedImages).toContain('image/gif')
      expect(config.multipart.supportedImages).toContain('image/webp')

      // Check expected PDF format
      expect(config.multipart.supportedPdfs).toContain('application/pdf')
    })
  })
})
