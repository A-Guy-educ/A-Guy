/**
 * Unit Tests for Context Policy Module
 *
 * Tests the deterministic prompt composition for AI chat, including:
 * - Recent message windowing
 * - Message summarization logic
 * - Retrieval query building
 * - Prompt composition with memory items
 */
import { describe, expect, it } from 'vitest'
import type { ContextComponents, Message } from '@/lib/ai/context-policy'
import {
  CONTEXT_POLICY_V1,
  CONTEXT_POLICY_VERSION,
  buildRetrievalQuery,
  composePrompt,
  getMessagesToSummarize,
  getRecentWindow,
  needsSummaryMaintenance,
} from '@/lib/ai/context-policy'
import type { MemoryItem } from '@/lib/ai/vector-search'
import { ChatRole } from '@/lib/ai/chat-message-role'

describe('Context Policy V1', () => {
  describe('constants', () => {
    it('should have correct policy version', () => {
      expect(CONTEXT_POLICY_VERSION).toBe('v1')
    })

    it('should have correct policy parameters', () => {
      expect(CONTEXT_POLICY_V1.recentWindowSize).toBe(20)
      expect(CONTEXT_POLICY_V1.memoryTopK).toBe(8)
      expect(CONTEXT_POLICY_V1.vectorCandidates).toBe(200)
      expect(CONTEXT_POLICY_V1.summaryThreshold).toBe(40)
      expect(CONTEXT_POLICY_V1.safetyThreshold).toBe(80)
    })
  })

  describe('getRecentWindow', () => {
    it('should return last N messages with default window size', () => {
      const messages: Message[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(2024, 0, i + 1).toISOString(),
      }))

      const result = getRecentWindow(messages)

      expect(result).toHaveLength(20)
      expect(result[0].content).toBe('Message 10') // Last 20 messages start from index 10
      expect(result[19].content).toBe('Message 29')
    })

    it('should return all messages if fewer than window size', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi', timestamp: new Date().toISOString() },
      ]

      const result = getRecentWindow(messages)

      expect(result).toHaveLength(2)
      expect(result).toEqual(messages)
    })

    it('should respect custom window size', () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getRecentWindow(messages, 5)

      expect(result).toHaveLength(5)
      expect(result[0].content).toBe('Message 15')
      expect(result[4].content).toBe('Message 19')
    })

    it('should handle empty array', () => {
      const result = getRecentWindow([])
      expect(result).toHaveLength(0)
    })

    it('should handle exactly window size messages', () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getRecentWindow(messages, 20)

      expect(result).toHaveLength(20)
      expect(result).toEqual(messages)
    })
  })

  describe('getMessagesToSummarize', () => {
    it('should return messages before recent window', () => {
      const messages: Message[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getMessagesToSummarize(messages)

      expect(result).toHaveLength(10) // 30 - 20 = 10
      expect(result[0].content).toBe('Message 0')
      expect(result[9].content).toBe('Message 9')
    })

    it('should return empty array if total <= window size', () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getMessagesToSummarize(messages)

      expect(result).toHaveLength(0)
    })

    it('should return empty array if total < window size', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getMessagesToSummarize(messages)

      expect(result).toHaveLength(0)
    })

    it('should respect custom window size', () => {
      const messages: Message[] = Array.from({ length: 15 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getMessagesToSummarize(messages, 5)

      expect(result).toHaveLength(10) // 15 - 5 = 10
      expect(result[0].content).toBe('Message 0')
      expect(result[9].content).toBe('Message 9')
    })

    it('should handle edge case: exactly window size + 1', () => {
      const messages: Message[] = Array.from({ length: 21 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }))

      const result = getMessagesToSummarize(messages, 20)

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Message 0')
    })
  })

  describe('buildRetrievalQuery', () => {
    it('should combine last 3 user messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'First answer', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Second question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Second answer', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Third question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Third answer', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Fourth question', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('Second question Third question Fourth question')
    })

    it('should filter out assistant messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'User message 1', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Assistant message', timestamp: new Date().toISOString() },
        { role: 'user', content: 'User message 2', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('User message 1 User message 2')
      expect(result).not.toContain('Assistant message')
    })

    it('should return empty string if no user messages', () => {
      const messages: Message[] = [
        { role: 'assistant', content: 'Only assistant', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'messages here', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('')
    })

    it('should handle fewer than 3 user messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Response', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Second', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('First Second')
    })

    it('should handle single user message', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Only one message', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('Only one message')
    })

    it('should handle empty messages array', () => {
      const result = buildRetrievalQuery([])
      expect(result).toBe('')
    })

    it('should preserve message order', () => {
      const messages: Message[] = [
        { role: 'user', content: 'A', timestamp: new Date().toISOString() },
        { role: 'user', content: 'B', timestamp: new Date().toISOString() },
        { role: 'user', content: 'C', timestamp: new Date().toISOString() },
      ]

      const result = buildRetrievalQuery(messages)

      expect(result).toBe('A B C')
    })
  })

  describe('needsSummaryMaintenance', () => {
    it('should return true when count > summaryThreshold', () => {
      expect(needsSummaryMaintenance(41)).toBe(true)
      expect(needsSummaryMaintenance(50)).toBe(true)
    })

    it('should return true when count > safetyThreshold', () => {
      expect(needsSummaryMaintenance(81)).toBe(true)
      expect(needsSummaryMaintenance(100)).toBe(true)
    })

    it('should return false when below both thresholds', () => {
      expect(needsSummaryMaintenance(39)).toBe(false)
      expect(needsSummaryMaintenance(20)).toBe(false)
      expect(needsSummaryMaintenance(1)).toBe(false)
    })

    it('should test boundary values', () => {
      expect(needsSummaryMaintenance(40)).toBe(false) // Equal to summary threshold (not >)
      expect(needsSummaryMaintenance(41)).toBe(true) // Just above summary threshold
      expect(needsSummaryMaintenance(79)).toBe(true) // Above summary threshold (40)
      expect(needsSummaryMaintenance(80)).toBe(true) // Equal to safety threshold but above summary threshold
      expect(needsSummaryMaintenance(81)).toBe(true) // Above both thresholds
    })

    it('should handle zero', () => {
      expect(needsSummaryMaintenance(0)).toBe(false)
    })
  })

  describe('composePrompt', () => {
    const mockMemoryItem = (
      text: string,
      importance: number,
      type: string = 'fact',
    ): MemoryItem => ({
      _id: `mem-${Math.random()}`,
      userId: 'user-123',
      type,
      text,
      importance,
      status: 'active',
      source: {
        sourceConversationId: 'conv-123',
        sourceMessageTimestamp: new Date(),
        sourceMessageRole: ChatRole.User,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    it('should create system message with base instructions', () => {
      const systemInstructions = 'You are a helpful AI assistant.'
      const components: ContextComponents = {
        systemMessage: systemInstructions,
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt(systemInstructions, components)

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].role).toBe('system')
      expect(result.messages[0].content).toContain(systemInstructions)
    })

    it('should append summary to system message', () => {
      const systemInstructions = 'Base instructions'
      const summary = 'Previous conversation summary'
      const components: ContextComponents = {
        systemMessage: systemInstructions,
        summary,
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt(systemInstructions, components)

      expect(result.messages[0].content).toContain('Base instructions')
      expect(result.messages[0].content).toContain('## Conversation Summary')
      expect(result.messages[0].content).toContain(summary)
    })

    it('should append memory items grouped by importance', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [
          mockMemoryItem('High importance fact', 5, 'fact'),
          mockMemoryItem('Medium importance', 3, 'preference'),
          mockMemoryItem('Low importance', 1, 'context'),
        ],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[0].content).toContain('## Relevant Context from Past Conversations')
      expect(result.messages[0].content).toContain('### High Importance (Remember These)')
      expect(result.messages[0].content).toContain('[fact] High importance fact')
      expect(result.messages[0].content).toContain('### Medium Importance')
      expect(result.messages[0].content).toContain('[preference] Medium importance')
      expect(result.messages[0].content).toContain('### Additional Context')
      expect(result.messages[0].content).toContain('[context] Low importance')
    })

    it('should truncate long memory texts to 400 characters', () => {
      const longText = 'A'.repeat(500)
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [mockMemoryItem(longText, 4)],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      const systemContent = result.messages[0].content
      expect(systemContent).toContain('A'.repeat(400) + '...')
      expect(systemContent).not.toContain('A'.repeat(401))
    })

    it('should not truncate short memory texts', () => {
      const shortText = 'Short memory text'
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [mockMemoryItem(shortText, 4)],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[0].content).toContain(shortText)
      expect(result.messages[0].content).not.toContain('...')
    })

    it('should sort memories by importance descending', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [
          mockMemoryItem('Low', 2),
          mockMemoryItem('High', 5),
          mockMemoryItem('Medium', 3),
        ],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)
      const content = result.messages[0].content

      const highIndex = content.indexOf('High')
      const mediumIndex = content.indexOf('Medium')
      const lowIndex = content.indexOf('Low')

      expect(highIndex).toBeLessThan(mediumIndex)
      expect(mediumIndex).toBeLessThan(lowIndex)
    })

    it('should limit low importance memories when high/medium exist', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [
          mockMemoryItem('High 1', 5),
          mockMemoryItem('Medium 1', 3),
          mockMemoryItem('Low 1', 1),
          mockMemoryItem('Low 2', 1),
          mockMemoryItem('Low 3', 1),
          mockMemoryItem('Low 4', 1),
        ],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)
      const content = result.messages[0].content

      // Should have high and medium sections
      expect(content).toContain('### High Importance')
      expect(content).toContain('### Medium Importance')

      // Low importance should be limited (max 3)
      const lowMatches = content.match(/Low \d/g)
      expect(lowMatches).toBeTruthy()
      expect(lowMatches!.length).toBeLessThanOrEqual(3)
    })

    it('should append recent messages in correct order', () => {
      const recentMessages: Message[] = [
        { role: 'user', content: 'First user message', timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: 'First assistant message',
          timestamp: new Date().toISOString(),
        },
        { role: 'user', content: 'Second user message', timestamp: new Date().toISOString() },
      ]

      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [],
        recentMessages,
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages).toHaveLength(4) // system + 3 messages
      expect(result.messages[1].role).toBe('user')
      expect(result.messages[1].content).toBe('First user message')
      expect(result.messages[2].role).toBe('assistant')
      expect(result.messages[2].content).toBe('First assistant message')
      expect(result.messages[3].role).toBe('user')
      expect(result.messages[3].content).toBe('Second user message')
    })

    it('should preserve message roles correctly', () => {
      const recentMessages: Message[] = [
        { role: 'user', content: 'User', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Assistant', timestamp: new Date().toISOString() },
      ]

      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [],
        recentMessages,
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[1].role).toBe('user')
      expect(result.messages[2].role).toBe('assistant')
    })

    it('should return correct metadata', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        summary: 'Summary text',
        memoryItems: [mockMemoryItem('Memory', 4), mockMemoryItem('Another', 3)],
        recentMessages: [
          { role: 'user', content: 'Message 1', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Message 2', timestamp: new Date().toISOString() },
        ],
      }

      const result = composePrompt('Instructions', components)

      expect(result.metadata.policyVersion).toBe('v1')
      expect(result.metadata.summaryLength).toBe('Summary text'.length)
      expect(result.metadata.memoryCount).toBe(2)
      expect(result.metadata.messageCount).toBe(2)
    })

    it('should handle empty memory items', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[0].content).not.toContain('## Relevant Context')
      expect(result.metadata.memoryCount).toBe(0)
    })

    it('should handle empty summary', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        summary: '',
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[0].content).not.toContain('## Conversation Summary')
    })

    it('should handle missing summary', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages[0].content).not.toContain('## Conversation Summary')
      expect(result.metadata.summaryLength).toBe(0)
    })

    it('should handle empty recent messages', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      expect(result.messages).toHaveLength(1) // Only system message
      expect(result.metadata.messageCount).toBe(0)
    })

    it('should handle whitespace-only summary', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        summary: '   ',
        memoryItems: [],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)

      // Whitespace-only summary should be treated as empty
      expect(result.messages[0].content).not.toContain('## Conversation Summary')
    })

    it('should include all importance tiers when present', () => {
      const components: ContextComponents = {
        systemMessage: 'Instructions',
        memoryItems: [
          mockMemoryItem('High 1', 5),
          mockMemoryItem('High 2', 4),
          mockMemoryItem('Medium 1', 3),
          mockMemoryItem('Low 1', 2),
          mockMemoryItem('Low 2', 1),
        ],
        recentMessages: [],
      }

      const result = composePrompt('Instructions', components)
      const content = result.messages[0].content

      expect(content).toContain('### High Importance (Remember These)')
      expect(content).toContain('### Medium Importance')
      expect(content).toContain('### Additional Context')
    })
  })
})
