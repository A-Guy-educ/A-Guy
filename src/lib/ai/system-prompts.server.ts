/**
 * Fetches all published system prompts in deterministic order
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern server-only
 */
import type { Prompt } from '@/payload-types'
import { logger } from '@/utilities/logger'
import type { Payload } from 'payload'

export type SystemPromptResult = {
  templates: string[]
  count: number
  promptIds: string[]
  promptTitles: string[]
}

/**
 * Fetches all published system prompts in deterministic order.
 *
 * Order: createdAt ASC, id ASC (oldest first with id as tiebreaker)
 *
 * The tiebreaker ensures fully deterministic ordering even when
 * multiple prompts share the same createdAt timestamp.
 *
 * If none exist, returns empty array (graceful degradation).
 */
export async function fetchPublishedSystemPrompts(
  payload: Payload,
): Promise<SystemPromptResult> {
  try {
    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'prompts' as any,
      where: {
        and: [
          { type: { equals: 'system' } },
          { status: { equals: 'published' } },
        ],
      },
      sort: 'createdAt,id', // ASC for both - oldest first, id as tiebreaker
      limit: 100, // Safety limit
      overrideAccess: true, // Prompts are admin-only
    })

    const prompts = result.docs as unknown as Prompt[]

    if (prompts.length === 0) {
      logger.debug('No published system prompts found, proceeding without them')
      return { templates: [], count: 0, promptIds: [], promptTitles: [] }
    }

    return {
      templates: prompts.map((p) => p.template).filter((t) => t?.trim()),
      count: prompts.length,
      promptIds: prompts.map((p) => p.id),
      promptTitles: prompts.map((p) => p.title ?? 'Untitled'),
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch system prompts')
    // Graceful degradation - continue without system prompts
    return { templates: [], count: 0, promptIds: [], promptTitles: [] }
  }
}
