/**
 * Unit tests for src/server/services/lesson-duplication/validators/semantic.ts
 *
 * Pattern: mocked LLM provider, pure function tests for the non-LLM path.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateExerciseSemantic } from '@/server/services/lesson-duplication/validators/semantic'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'

const mockPayload = {} as import('payload').Payload

function makeRichText(id: string, value: string): ContentBlock {
  return {
    id,
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  } as ContentBlock
}

// Mock the LLM provider factory
vi.mock('@/infra/llm/providers/factory', () => ({
  getLLMProvider: vi.fn(),
  getProviderModelConfig: vi.fn(() => ({
    name: 'test-model',
    temperature: 0.7,
    maxOutputTokens: 2048,
  })),
  getProviderTypeFromEnv: vi.fn(() => 'gemini' as const),
}))

describe('validateExerciseSemantic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('skip conditions', () => {
    it('skips for level=none (deep clone)', async () => {
      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'none', 'ai', mockPayload)
      expect(result).toEqual({ ok: true })
    })

    it('skips for strategy=script', async () => {
      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'script', mockPayload)
      expect(result).toEqual({ ok: true })
    })

    it('skips for strategy=script even with level=deep', async () => {
      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'deep', 'script', mockPayload)
      expect(result).toEqual({ ok: true })
    })
  })

  describe('LLM call', () => {
    it('returns { ok: true } when LLM says valid', async () => {
      const { getLLMProvider } = await import('@/infra/llm/providers/factory')
      const mockProvider = {
        generateChatCompletion: vi.fn().mockResolvedValue({
          text: JSON.stringify({ ok: true, reasons: [] }),
        }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(getLLMProvider as any).mockResolvedValue(mockProvider)

      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'ai', mockPayload)
      expect(result).toEqual({ ok: true })
      expect(mockProvider.generateChatCompletion).toHaveBeenCalledTimes(1)
    })

    it('returns { ok: false, reasons } when LLM says invalid', async () => {
      const { getLLMProvider } = await import('@/infra/llm/providers/factory')
      const mockProvider = {
        generateChatCompletion: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            ok: false,
            reasons: ['Question is ambiguous', 'Options are implausible'],
          }),
        }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(getLLMProvider as any).mockResolvedValue(mockProvider)

      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'ai', mockPayload)
      expect(result).toEqual({
        ok: false,
        reasons: ['Question is ambiguous', 'Options are implausible'],
      })
    })

    it('extracts JSON from markdown code fences', async () => {
      const { getLLMProvider } = await import('@/infra/llm/providers/factory')
      const mockProvider = {
        generateChatCompletion: vi.fn().mockResolvedValue({
          text: '```json\n{ "ok": true, "reasons": [] }\n```',
        }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(getLLMProvider as any).mockResolvedValue(mockProvider)

      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'ai', mockPayload)
      expect(result).toEqual({ ok: true })
    })

    it('returns failure on non-JSON LLM response', async () => {
      const { getLLMProvider } = await import('@/infra/llm/providers/factory')
      const mockProvider = {
        generateChatCompletion: vi.fn().mockResolvedValue({
          text: 'The exercise looks fine but I cannot parse it.',
        }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(getLLMProvider as any).mockResolvedValue(mockProvider)

      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'ai', mockPayload)
      expect(result.ok).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).reasons[0]).toContain('non-JSON response')
    })

    it('returns failure on JSON parse error', async () => {
      const { getLLMProvider } = await import('@/infra/llm/providers/factory')
      const mockProvider = {
        generateChatCompletion: vi.fn().mockResolvedValue({
          text: '{ not valid json }',
        }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(getLLMProvider as any).mockResolvedValue(mockProvider)

      const blocks: ContentBlock[] = [makeRichText('block-1', 'content')]
      const result = await validateExerciseSemantic(blocks, 'medium', 'ai', mockPayload)
      expect(result.ok).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).reasons[0]).toContain('non-JSON response')
    })
  })
})
