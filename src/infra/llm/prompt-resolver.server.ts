/**
 * Resolves system prompt for AI tutor
 *
 * Priority:
 * 1. Lesson.prompt (if provided and published)
 * 2. Default prompt (first published with isDefaultForAgentChat=true)
 * 3. Built-in fallback (logs warning)
 */
import type { Prompt } from '@/payload-types'
import { logger } from '@/infra/utils/logger'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import type { Payload, Where } from 'payload'

// Local constant - no cross-module imports to avoid circular deps
export const BUILTIN_FALLBACK_PROMPT = `You are a helpful math and science tutor for students working on exercises.

Guide students through problem-solving without giving direct answers.
Ask clarifying questions to help them think critically.
Be supportive and patient.

## Math Formatting

Always use LaTeX delimiters for mathematical expressions:
- Inline math (within sentences): \\(...\\)
- Block/display math (standalone equations): \\[...\\]

Never write math as plain text. Use proper LaTeX notation for fractions (\\frac{}{}), multiplication (\\cdot), square roots (\\sqrt{}), trigonometric functions (\\sin, \\cos, \\tan), Greek letters (\\alpha, \\pi), etc.`

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
  locale?: ContentLocale,
): Promise<PromptResolutionResult> {
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
    logger.debug(
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
    const baseConditions: Where[] = [
      { isDefaultForAgentChat: { equals: true } },
      { status: { equals: 'published' } },
    ]
    if (locale) {
      baseConditions.push({ locale: { equals: locale } })
    }

    const defaultPrompts = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'prompts' as any,
      where: { and: baseConditions },
      limit: 1,
      overrideAccess: true,
    })

    // If locale was specified but no match, fall back to locale-unaware query
    if (defaultPrompts.docs.length === 0 && locale) {
      logger.warn(
        { locale },
        'No prompt found for requested locale, falling back to locale-unaware query',
      )
      const fallbackPrompts = await payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'prompts' as any,
        where: {
          and: [{ isDefaultForAgentChat: { equals: true } }, { status: { equals: 'published' } }],
        },
        limit: 1,
        overrideAccess: true,
      })

      if (fallbackPrompts.docs.length > 0) {
        const fallbackPrompt = fallbackPrompts.docs[0] as unknown as Prompt
        if (fallbackPrompt.template?.trim()) {
          return {
            template: fallbackPrompt.template,
            resolvedFrom: 'default-prompt',
            promptId: fallbackPrompt.id,
            promptTitle: fallbackPrompt.title ?? undefined,
            fallbackReason: `No prompt for locale '${locale}', used locale-unaware fallback`,
          }
        }
      }
    }

    // Warn if multiple defaults exist (query totalDocs)
    if (defaultPrompts.totalDocs > 1) {
      logger.warn(
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
      logger.debug(
        { promptId: defaultPrompt.id },
        'Default prompt has no template, using built-in fallback',
      )
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to query default prompt')
  }

  // 3) Built-in fallback
  logger.warn('No published prompts with templates available, using built-in fallback')
  return {
    template: BUILTIN_FALLBACK_PROMPT,
    resolvedFrom: 'fallback',
    fallbackReason: lessonPrompt
      ? 'Lesson prompt not published or has no template'
      : 'Lesson has no prompt and no default available',
  }
}
