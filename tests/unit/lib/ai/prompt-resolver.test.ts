/**
 * Unit tests for the prompt resolver
 */
import { BUILTIN_FALLBACK_PROMPT, resolveAgentSystemPrompt } from '@/infra/llm/prompt-resolver.server'
import { logger } from '@/utilities/logger'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock logger
vi.mock('@/utilities/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockPayload = {
  find: vi.fn(),
}

describe('resolveAgentSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when lessonPrompt is a published prompt object', () => {
    it('returns lesson prompt without querying database', async () => {
      const lessonPrompt = {
        id: 'prompt-1',
        title: 'Math Tutor',
        template: 'You are a math tutor.',
        status: 'published' as const,
        type: 'context' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }

      const result = await resolveAgentSystemPrompt(mockPayload as any, lessonPrompt)

      expect(result.template).toBe('You are a math tutor.')
      expect(result.resolvedFrom).toBe('lesson-prompt')
      expect(result.promptId).toBe('prompt-1')
      expect(mockPayload.find).not.toHaveBeenCalled()
    })
  })

  describe('when lessonPrompt is draft', () => {
    it('falls back to default prompt', async () => {
      const draftPrompt = {
        id: 'p-2',
        title: 'Draft',
        template: 'Draft.',
        status: 'draft' as const,
        type: 'context' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 'default-1',
            title: 'Default',
            template: 'Default template.',
            status: 'published',
            type: 'context',
          },
        ],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, draftPrompt)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.fallbackReason).toBe('Lesson prompt not published or has no template')
      expect(logger.debug).toHaveBeenCalled()
    })
  })

  describe('when lessonPrompt is archived', () => {
    it('falls back to default prompt', async () => {
      const archivedPrompt = {
        id: 'p-3',
        title: 'Archived',
        template: 'Archived.',
        status: 'archived' as const,
        type: 'context' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', template: 'Default.', status: 'published', type: 'context' }],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, archivedPrompt)

      expect(result.resolvedFrom).toBe('default-prompt')
    })
  })

  describe('when lessonPrompt is null', () => {
    it('uses default prompt', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 'default-1',
            title: 'Default',
            template: 'Default.',
            status: 'published',
            type: 'context',
          },
        ],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.fallbackReason).toBe('Lesson has no prompt')
    })
  })

  describe('when lessonPrompt is undefined', () => {
    it('uses default prompt', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', template: 'Default.', status: 'published', type: 'context' }],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, undefined)

      expect(result.resolvedFrom).toBe('default-prompt')
    })
  })

  describe('multiple defaults warning', () => {
    it('logs warning when multiple defaults exist and uses first', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 'default-1',
            title: 'First',
            template: 'First.',
            status: 'published',
            type: 'context',
          },
        ],
        totalDocs: 3,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.promptId).toBe('default-1')
      expect(logger.warn).toHaveBeenCalledWith(
        { count: 3 },
        'Multiple published default prompts found, using first one',
      )
    })
  })

  describe('fallback behavior', () => {
    it('returns built-in fallback when no prompts exist', async () => {
      mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.template).toBe(BUILTIN_FALLBACK_PROMPT)
      expect(result.resolvedFrom).toBe('fallback')
      expect(result.fallbackReason).toBe('Lesson has no prompt and no default available')
      expect(logger.warn).toHaveBeenCalledWith(
        'No published prompts with templates available, using built-in fallback',
      )
    })

    it('returns built-in fallback on database error', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB connection failed'))

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('fallback')
      expect(logger.error).toHaveBeenCalled()
    })
  })
})
