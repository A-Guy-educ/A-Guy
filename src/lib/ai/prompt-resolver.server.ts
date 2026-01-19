/**
 * Resolves system prompt for AI tutor
 *
 * Priority:
 * 1. Lesson.prompt (if provided and published)
 * 2. Default prompt (first published with isDefaultForAgentChat=true)
 * 3. Built-in fallback (logs warning)
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

// Local constant - no cross-module imports to avoid circular deps
export const BUILTIN_FALLBACK_PROMPT = `You are a helpful math and science tutor for students working on exercises.

Guide students through problem-solving without giving direct answers.
Ask clarifying questions to help them think critically.
Be supportive and patient.`

export type PromptResolutionResult = {
  template: string
  resolvedFrom: 'lesson-prompt' | 'default-prompt' | 'fallback'
  promptId?: string
  promptTitle?: string
  fallbackReason?: string
}

/**
 * Resolve system prompt from pre-loaded lesson prompt or fallback to default
 *
 * Deterministic behavior for input types:
 * - Prompt object with status='published' and non-empty template → use it
 * - Prompt object with status!='published' or empty template → fall back to default
 * - null/undefined → fall back to default
 */
export async function resolveAgentSystemPrompt(
  payload: Payload,
  lessonPrompt?: Prompt | null,
  options?: {
    timing?: RequestTiming
    logger?: Logger
    requestId?: string
    endpoint?: string
  },
): Promise<PromptResolutionResult> {
  const requestLogger = options?.logger ?? logger
  const timing = options?.timing
  const requestId = options?.requestId ?? 'unknown'
  const endpoint = options?.endpoint ?? 'prompt-resolver'

  // 1) Check if lesson has a populated prompt object
  if (lessonPrompt && typeof lessonPrompt === 'object') {
    if (lessonPrompt.status === 'published' && lessonPrompt.template?.trim()) {
      return {
        template: lessonPrompt.template,
        resolvedFrom: 'lesson-prompt',
        promptId: lessonPrompt.id,
        promptTitle: lessonPrompt.title ?? undefined,
      }
    }
    // Prompt exists but not published or has no template
    requestLogger.debug(
      {
        promptId: lessonPrompt.id,
        status: lessonPrompt.status,
        hasTemplate: !!lessonPrompt.template?.trim(),
      },
      'Lesson prompt not usable, falling back',
    )
  }

  // 2) Query for default prompt (with overrideAccess since prompts are admin-only)
  try {
    const where: Where = {
      and: [{ isDefaultForAgentChat: { equals: true } }, { status: { equals: 'published' } }],
    }
    const findOp = () =>
      payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'prompts' as any,
        where,
        limit: 1,
        overrideAccess: true,
      })

    const defaultPrompts = timing
      ? await timeDbOperation(
          timing,
          {
            stage: 'db_query:default_prompt',
            collection: 'prompts',
            filterKeys: getFilterShapeKeys(where),
            limit: 1,
            sort: undefined,
            logger: requestLogger,
            requestId,
            endpoint,
          },
          findOp,
        )
      : await findOp()

    // Warn if multiple defaults exist (query totalDocs)
    if (defaultPrompts.totalDocs > 1) {
      requestLogger.warn(
        { count: defaultPrompts.totalDocs },
        'Multiple published default prompts found, using first one',
      )
    }

    if (defaultPrompts.docs.length > 0) {
      const defaultPrompt = defaultPrompts.docs[0] as unknown as Prompt

      // Check if default prompt has a valid template
      if (defaultPrompt.template?.trim()) {
        return {
          template: defaultPrompt.template,
          resolvedFrom: 'default-prompt',
          promptId: defaultPrompt.id,
          promptTitle: defaultPrompt.title ?? undefined,
          fallbackReason: lessonPrompt
            ? 'Lesson prompt not published or has no template'
            : 'Lesson has no prompt',
        }
      }

      // Default prompt exists but has no template - fall through to built-in fallback
      requestLogger.debug(
        { promptId: defaultPrompt.id },
        'Default prompt has no template, using built-in fallback',
      )
    }
  } catch (error) {
    requestLogger.error({ err: error }, 'Failed to query default prompt')
  }

  // 3) Built-in fallback
  requestLogger.warn('No published prompts with templates available, using built-in fallback')
  return {
    template: BUILTIN_FALLBACK_PROMPT,
    resolvedFrom: 'fallback',
    fallbackReason: lessonPrompt
      ? 'Lesson prompt not published or has no template'
      : 'Lesson has no prompt and no default available',
  }
}
