/**
 * Unit Tests for LLM Observability Module
 *
 * Tests the logging and observability functions for the chat context system.
 */
import { describe, expect, it, vi } from 'vitest'

// Mock the logger
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))

describe('Observability', () => {
  describe('ContextLog interface', () => {
    it('should have correct structure', async () => {
      const { createContextLog } = await import('@/infra/llm/observability')

      const log = createContextLog({
        conversationId: 'conv-123',
        userId: 'user-456',
        policyVersion: 'v1',
        summaryPresent: true,
        summaryLength: 100,
        memoryLocalCount: 2,
        memoryContextCount: 5,
        memoryGlobalCount: 3,
        memoryRetrievalLatencyMs: 50,
        messageWindowSize: 10,
        messageTotalCount: 25,
        modelLatencyMs: 1000,
        hierarchyKeys: ['course:1', 'chapter:2'],
      })

      expect(log.timestamp).toBeDefined()
      expect(log.conversationId).toBe('conv-123')
      expect(log.userId).toBe('user-456')
      expect(log.policyVersion).toBe('v1')
      expect(log.summary.present).toBe(true)
      expect(log.summary.length).toBe(100)
      expect(log.memory.localCount).toBe(2)
      expect(log.memory.contextCount).toBe(5)
      expect(log.memory.parentCount).toBe(3) // contextCount - localCount
      expect(log.memory.globalCount).toBe(3)
      expect(log.memory.totalCount).toBe(10) // local + context + global
      expect(log.memory.retrievalLatencyMs).toBe(50)
      expect(log.memory.hierarchyKeys).toEqual(['course:1', 'chapter:2'])
      expect(log.messages.windowSize).toBe(10)
      expect(log.messages.totalCount).toBe(25)
      expect(log.modelLatencyMs).toBe(1000)
    })

    it('should handle optional hierarchyKeys', async () => {
      const { createContextLog } = await import('@/infra/llm/observability')

      const log = createContextLog({
        conversationId: 'conv-123',
        userId: 'user-456',
        policyVersion: 'v1',
        summaryPresent: false,
        summaryLength: 0,
        memoryLocalCount: 0,
        memoryContextCount: 0,
        memoryGlobalCount: 0,
        memoryRetrievalLatencyMs: 0,
        messageWindowSize: 5,
        messageTotalCount: 5,
      })

      expect(log.memory.hierarchyKeys).toEqual([])
    })
  })

  describe('logContextUsage', () => {
    it('should log context usage data', async () => {
      const { logContextUsage, createContextLog } = await import('@/infra/llm/observability')
      const { logger } = await import('@/infra/utils/logger')

      const log = createContextLog({
        conversationId: 'conv-123',
        userId: 'user-456',
        policyVersion: 'v1',
        summaryPresent: true,
        summaryLength: 100,
        memoryLocalCount: 2,
        memoryContextCount: 5,
        memoryGlobalCount: 3,
        memoryRetrievalLatencyMs: 50,
        messageWindowSize: 10,
        messageTotalCount: 25,
        modelLatencyMs: 1000,
      })

      logContextUsage(log)

      expect(logger.debug).toHaveBeenCalledWith(log, '[Context Usage]')
    })
  })

  describe('logPromptSnapshot', () => {
    it('should handle logPromptSnapshot without error', async () => {
      const { logPromptSnapshot } = await import('@/infra/llm/observability')
      const { logger } = await import('@/infra/utils/logger')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prompt: any = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant'.repeat(50) },
          { role: 'user', content: 'Hello' },
        ],
        metadata: { policyVersion: 'v1' },
      }

      // Call the function - it may or may not log depending on NODE_ENV
      logPromptSnapshot('conv-123', prompt)

      // In non-production environments, it should log
      if (process.env.NODE_ENV === 'development') {
        expect(logger.debug).toHaveBeenCalled()
      }
    })
  })

  describe('logMaintenance', () => {
    it('should log successful maintenance', async () => {
      const { logMaintenance } = await import('@/infra/llm/observability')
      const { logger } = await import('@/infra/utils/logger')

      logMaintenance({
        conversationId: 'conv-123',
        operation: 'summary',
        success: true,
        messageCount: 100,
        messagesTrimmed: 50,
        memoryItemsCreated: 10,
        tokensUsed: 5000,
      })

      expect(logger.info).toHaveBeenCalled()
      const infoCall = logger.info.mock.calls[0][0] as {
        conversationId: string
        operation: string
        success: boolean
      }
      expect(infoCall.conversationId).toBe('conv-123')
      expect(infoCall.operation).toBe('summary')
      expect(infoCall.success).toBe(true)
    })

    it('should log failed maintenance', async () => {
      const { logMaintenance } = await import('@/infra/llm/observability')
      const { logger } = await import('@/infra/utils/logger')

      logMaintenance({
        conversationId: 'conv-123',
        operation: 'extraction',
        success: false,
        error: 'Rate limit exceeded',
      })

      expect(logger.error).toHaveBeenCalled()
      const errorCall = logger.error.mock.calls[0][0] as {
        conversationId: string
        success: boolean
        error: string
      }
      expect(errorCall.conversationId).toBe('conv-123')
      expect(errorCall.success).toBe(false)
      expect(errorCall.error).toBe('Rate limit exceeded')
    })
  })
})
