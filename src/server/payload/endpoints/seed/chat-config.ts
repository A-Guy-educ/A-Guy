/**
 * Seed Chat Config Values
 *
 * Adds chat config seeding to the main seed function.
 * Import and call seedChatConfig() in seed/index.ts
 */
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import type { Payload } from 'payload'

const chatConfigData = {
  timeouts: {
    defaultMs: 30000,
    toolCallMs: 60000,
    streamingMs: 60000,
  },
  retry: {
    maxRetries: 2,
    delayMs: 1000,
    exponentialBase: 2,
    jitterFactor: 0.1,
  },
  tokens: {
    defaultMax: 4096,
    maxMax: 128000,
  },
  temperature: {
    min: 0,
    max: 2,
    default: 0.7,
  },
  multipart: {
    maxImages: 10,
    maxSizeMb: 20,
    supportedImages: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supportedPdfs: ['application/pdf'],
  },
  providerUrls: {
    geminiApiBase: 'https://generativelanguage.googleapis.com/v1beta',
    openaiCompatibleApiBase: 'https://api.openai.com/v1',
  },
  defaultModels: {
    gemini: 'gemini-2.0-flash-001',
    openaiCompatible: 'gpt-4o',
  },
  chatSettings: {
    maxToolIterations: 5,
    defaultMaxRetries: 2,
    defaultRetryDelayMs: 1000,
    defaultChatTimeoutMs: 30000,
    defaultToolTimeoutMs: 60000,
  },
  // Model settings - replaces hardcoded MODEL_REGISTRY
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

export async function seedChatConfig(payload: Payload, tenantId: string): Promise<void> {
  // Check if chat config already exists
  const existing = await payload.find({
    collection: 'config_values',
    where: {
      and: [{ tenant: { equals: tenantId } }, { domain: { equals: 'chat' } }],
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    // Update existing
    await payload.update({
      collection: 'config_values',
      id: existing.docs[0].id,
      data: {
        domain: 'chat',
        config: chatConfigData,
      },
    })
    payload.logger.info('— Updated chat config')
    return
  }

  // Create new
  await payload.create({
    collection: 'config_values',
    data: {
      tenant: tenantId,
      domain: 'chat',
      config: chatConfigData,
    },
  })
  payload.logger.info('— Created chat config')
}

// Legacy endpoint support - kept for backwards compatibility
export const seedChatConfigEndpoint: (payload: Payload) => Promise<void> = async (payload) => {
  const tenantId = await getDefaultTenantId(payload)
  if (tenantId) {
    await seedChatConfig(payload, tenantId)
  }
}
