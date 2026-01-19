/**
 * Fetches all published system prompts in deterministic order
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern server-only
 */
import type { Prompt } from '@/payload-types'
import { logger } from '@/utilities/logger'
import type { Payload, Where } from 'payload'
import type { Logger } from 'pino'
import {
  getFilterShapeKeys,
  type RequestTiming,
  timeDbOperation,
} from '@/utilities/perf/request-timing'

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
  options?: {
    timing?: RequestTiming
    logger?: Logger
    requestId?: string
    endpoint?: string
  },
): Promise<SystemPromptResult> {
  const requestLogger = options?.logger ?? logger
  const timing = options?.timing
  const requestId = options?.requestId ?? 'unknown'
  const endpoint = options?.endpoint ?? 'system-prompts'

  try {
    const where: Where = {
      and: [{ type: { equals: 'system' } }, { status: { equals: 'published' } }],
    }
    const findOp = () =>
      payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'prompts' as any,
        where,
        sort: '-createdAt,-id', // DESC order (newest first), we reverse to get ASC
        limit: 100, // Safety limit
        overrideAccess: true, // Prompts are admin-only
      })

    const result = timing
      ? await timeDbOperation(
          timing,
          {
            stage: 'db_query:system_prompts',
            collection: 'prompts',
            filterKeys: getFilterShapeKeys(where),
            limit: 100,
            sort: '-createdAt,-id',
            logger: requestLogger,
            requestId,
            endpoint,
          },
          findOp,
        )
      : await findOp()

    const prompts = (result.docs as unknown as Prompt[]).slice().reverse()

    if (prompts.length === 0) {
      requestLogger.debug('No published system prompts found, proceeding without them')
      return { templates: [], count: 0, promptIds: [], promptTitles: [] }
    }

    return {
      templates: prompts.map((p) => p.template).filter((t) => t?.trim()),
      count: prompts.length,
      promptIds: prompts.map((p) => p.id),
      promptTitles: prompts.map((p) => p.title ?? 'Untitled'),
    }
  } catch (error) {
    requestLogger.error({ err: error }, 'Failed to fetch system prompts')
    // Graceful degradation - continue without system prompts
    return { templates: [], count: 0, promptIds: [], promptTitles: [] }
  }
}
