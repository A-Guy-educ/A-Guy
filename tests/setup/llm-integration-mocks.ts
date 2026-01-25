/**
 * Integration Test Setup for LLM Services
 *
 * This file sets up proper mocking for integration tests that use LLM services
 * (embeddings, memory-extraction, summary, etc.)
 *
 * The key issue being fixed:
 * - Tests were calling getOpenAIClient() which requires runtime config loading
 * - The openai-client.ts imports loadRuntimeConfig and getSecret from config/runtime
 * - We need to mock the openai-client module directly, not just 'openai'
 */

import { vi } from 'vitest'

/**
 * Create a properly mocked OpenAI client for integration tests
 * This mock intercepts calls at the openai-client level
 */
export function createMockedOpenAIClient() {
  const mockClient = {
    embeddings: {
      create: vi.fn().mockImplementation(async ({ input, model }) => {
        // Generate deterministic embeddings
        const generateEmbedding = (text: string) => {
          let hash = 0
          for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i)
            hash = hash & hash
          }
          const seed = Math.abs(hash)
          const random = (index: number) => {
            const x = Math.sin(seed + index) * 10000
            return (x - Math.floor(x)) * 2 - 1
          }
          return Array.from({ length: 1536 }, (_, i) => random(i))
        }

        const isArray = Array.isArray(input)
        const texts = isArray ? input : [input]

        const data = texts.map((text, idx) => ({
          embedding: generateEmbedding(text),
          index: idx,
          object: 'embedding' as const,
        }))

        return {
          data,
          model: model || 'text-embedding-3-small',
          usage: {
            prompt_tokens: texts.reduce((sum, t) => sum + t.split(' ').length, 0),
            total_tokens: texts.reduce((sum, t) => sum + t.split(' ').length, 0),
          },
          object: 'list' as const,
        }
      }),
    },
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async ({ messages }) => {
          const systemMessage =
            messages.find((m: { role: string }) => m.role === 'system')?.content || ''
          const userMessage =
            messages.find((m: { role: string }) => m.role === 'user')?.content || ''

          // For memory extraction (JSON response)
          if (
            systemMessage.includes('Extract important information') ||
            systemMessage.includes('memory') ||
            systemMessage.includes('JSON')
          ) {
            const memories: Array<{
              type: string
              text: string
              importance: number
              scope: string
              reason: string
            }> = []

            if (userMessage.includes('TypeScript') || userMessage.includes('language')) {
              memories.push({
                type: 'preference',
                text: 'User prefers TypeScript as programming language',
                importance: 4,
                scope: 'user',
                reason: 'User preference stated',
              })
            }

            if (userMessage.includes('learning') || userMessage.includes('Payload')) {
              memories.push({
                type: 'fact',
                text: 'User is learning Payload CMS',
                importance: 3,
                scope: 'user',
                reason: 'Educational context mentioned',
              })
            }

            return {
              id: 'chatcmpl-mock',
              object: 'chat.completion',
              created: Date.now(),
              model: 'gpt-4o-mini',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({ memories }),
                  },
                  finish_reason: 'stop' as const,
                },
              ],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
              },
            }
          }

          // For summary generation
          const topics: string[] = []
          if (userMessage.includes('Payload')) topics.push('Payload CMS')
          if (userMessage.includes('collections')) topics.push('collections')
          if (userMessage.includes('hooks')) topics.push('hooks')

          const summary =
            topics.length > 0
              ? `User discussed ${topics.join(', ')}. Key topics covered in recent conversation.`
              : 'User engaged in general discussion about web development topics.'

          return {
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: summary,
                },
                finish_reason: 'stop' as const,
              },
            ],
            usage: {
              prompt_tokens: 150,
              completion_tokens: 50,
              total_tokens: 200,
            },
          }
        }),
      },
    },
  }

  return mockClient
}

/**
 * Set up integration test mocks for LLM services
 * Call this in your test file's beforeAll or at the top level
 */
export function setupLLMIntegrationMocks() {
  // Mock the openai-client module
  vi.mock('@/infra/llm/openai-client', () => ({
    getOpenAIClient: vi.fn().mockResolvedValue(createMockedOpenAIClient()),
    getOpenAIApiKey: vi.fn().mockResolvedValue('test-api-key'),
    resetOpenAIClient: vi.fn(),
  }))

  // Mock the config/runtime module to prevent "server-side only" errors
  vi.mock('@/lib/config/runtime', () => ({
    loadRuntimeConfig: vi.fn().mockResolvedValue({
      success: true,
      variablesLoaded: 0,
      secretsLoaded: 1,
      errors: [],
      loadedAt: new Date(),
    }),
    reloadRuntimeConfig: vi.fn().mockResolvedValue({
      success: true,
      variablesLoaded: 0,
      secretsLoaded: 1,
      errors: [],
      loadedAt: new Date(),
    }),
    isConfigLoaded: vi.fn().mockReturnValue(true),
    clearConfigCache: vi.fn(),
    getVariable: vi.fn().mockReturnValue('test-value'),
    getSecret: vi.fn().mockImplementation((tenantId, key, options) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key'
      if (options?.defaultValue !== undefined) return options.defaultValue
      throw new Error(`Secret ${key} not found`)
    }),
    getVariableKeys: vi.fn().mockReturnValue([]),
    getSecretKeys: vi.fn().mockReturnValue(['OPENAI_API_KEY']),
    getLoadedTenantIds: vi.fn().mockReturnValue(['default-tenant']),
    getCacheMetadata: vi.fn().mockReturnValue({
      loadedAt: new Date(),
      entryCount: 0,
      variableCount: 0,
      secretCount: 1,
      tenantsLoaded: 1,
    }),
  }))

  // Mock the tenant module
  vi.mock('@/lib/tenant/get-default-tenant', () => ({
    getDefaultTenantId: vi.fn().mockResolvedValue('default-tenant'),
  }))
}

/**
 * Reset all LLM mocks
 */
export function resetLLMMocks() {
  vi.resetModules()
  vi.restoreAllMocks()
}
