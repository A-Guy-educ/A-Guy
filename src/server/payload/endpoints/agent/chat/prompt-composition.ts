/**
 * Chat Prompt Composition
 * Handles fetching lesson context, prompts, and composing system instructions
 */
import type { Payload } from 'payload'
import type { Logger } from 'pino'

import { composeSystemInstructions } from '@/infra/llm/prompt-composer.server'
import { resolveAgentSystemPrompt } from '@/infra/llm/prompt-resolver.server'
import { fetchPublishedSystemPrompts } from '@/infra/llm/system-prompts.server'
import { resolveTeacherPersona, getPersonaXmlBlock } from '@/infra/utils/teacher-persona'
import type { Prompt } from '@/payload-types'

import type { ResolvedContext } from './context-resolution'

interface LessonContext {
  lessonContextText?: string
  lessonPrompt: Prompt | null
  courseContextText?: string
  coursePrompt: Prompt | null
}

/**
 * Fetch lesson context and prompt for direct lesson context
 */
async function fetchLessonContext(
  payload: Payload,
  lessonId: string,
  user: { id: string },
  reqLogger: Logger,
): Promise<LessonContext> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    user,
    overrideAccess: false,
  })

  const lessonContextText =
    (lesson as { lessonContextText?: string }).lessonContextText ?? undefined
  let lessonPrompt: Prompt | null = null

  // Fetch prompt separately if lesson has one (admin-only, requires override)
  if ((lesson as { prompt?: unknown }).prompt) {
    const promptId =
      typeof (lesson as { prompt: unknown }).prompt === 'string'
        ? (lesson as { prompt: string }).prompt
        : (lesson as { prompt: { id: string } }).prompt.id

    try {
      lessonPrompt = (await payload.findByID({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'prompts' as any,
        id: promptId,
        overrideAccess: true, // Prompts are admin-only
      })) as Prompt | null
    } catch (error) {
      reqLogger.warn({ err: error, promptId, lessonId }, 'Failed to fetch lesson prompt')
    }
  }

  return { lessonContextText, lessonPrompt, courseContextText: undefined, coursePrompt: null }
}

/**
 * Fetch lesson context for exercise (inherits from parent lesson)
 */
async function fetchExerciseLessonContext(
  payload: Payload,
  exerciseId: string,
  user: { id: string },
  reqLogger: Logger,
): Promise<LessonContext> {
  const exercise = await payload.findByID({
    collection: 'exercises',
    id: exerciseId,
    depth: 0,
    user,
    overrideAccess: false,
  })

  if (!(exercise as { lesson?: unknown }).lesson) {
    return {
      lessonContextText: undefined,
      lessonPrompt: null,
      courseContextText: undefined,
      coursePrompt: null,
    }
  }

  const lessonId =
    typeof (exercise as { lesson: unknown }).lesson === 'string'
      ? (exercise as { lesson: string }).lesson
      : (exercise as { lesson: { id: string } }).lesson.id

  try {
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      user,
      overrideAccess: true, // Use overrideAccess since student role may not have lesson read access
    })

    const lessonContextText =
      (lesson as { lessonContextText?: string }).lessonContextText ?? undefined
    let lessonPrompt: Prompt | null = null

    // Fetch prompt separately if lesson has one
    if ((lesson as { prompt?: unknown }).prompt) {
      const promptId =
        typeof (lesson as { prompt: unknown }).prompt === 'string'
          ? (lesson as { prompt: string }).prompt
          : (lesson as { prompt: { id: string } }).prompt.id

      try {
        lessonPrompt = (await payload.findByID({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'prompts' as any,
          id: promptId,
          overrideAccess: true,
        })) as Prompt | null
      } catch (error) {
        reqLogger.warn({ err: error, promptId, lessonId }, 'Failed to fetch lesson prompt')
      }
    }

    return { lessonContextText, lessonPrompt, courseContextText: undefined, coursePrompt: null }
  } catch (error) {
    reqLogger.warn(
      { err: error, lessonId, exerciseId },
      'Failed to fetch lesson for exercise context, continuing without lesson context',
    )
    return {
      lessonContextText: undefined,
      lessonPrompt: null,
      courseContextText: undefined,
      coursePrompt: null,
    }
  }
}

/**
 * Fetch course context and prompt (for course-level context, e.g., Ask tab)
 */
async function fetchCourseContext(
  payload: Payload,
  courseId: string,
  user: { id: string },
  reqLogger: Logger,
): Promise<{ courseContextText?: string; coursePrompt: Prompt | null }> {
  try {
    const course = await payload.findByID({
      collection: 'courses',
      id: courseId,
      depth: 0,
      user,
      overrideAccess: false,
    })

    const courseContextText =
      (course as { courseContextText?: string }).courseContextText ?? undefined
    let coursePrompt: Prompt | null = null

    // Fetch course prompt separately if course has one (admin-only, requires override)
    if ((course as { prompt?: unknown }).prompt) {
      const promptId =
        typeof (course as { prompt: unknown }).prompt === 'string'
          ? (course as { prompt: string }).prompt
          : (course as { prompt: { id: string } }).prompt.id

      try {
        coursePrompt = (await payload.findByID({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'prompts' as any,
          id: promptId,
          overrideAccess: true, // Prompts are admin-only
        })) as Prompt | null

        reqLogger.info({ promptId, courseId }, 'Loaded course-specific prompt')
      } catch (error) {
        reqLogger.warn({ err: error, promptId, courseId }, 'Failed to fetch course prompt')
      }
    }

    return { courseContextText, coursePrompt }
  } catch (error) {
    reqLogger.warn(
      { err: error, courseId },
      'Failed to fetch course for prompt resolution, continuing with defaults',
    )
    return { courseContextText: undefined, coursePrompt: null }
  }
}

/**
 * Fetch lesson context based on resolved context type
 * Also fetches course context if courseId is provided
 */
export async function fetchLessonContextForContext(
  payload: Payload,
  context: ResolvedContext,
  user: { id: string },
  reqLogger: Logger,
  courseId?: string,
): Promise<LessonContext> {
  let lessonContext: LessonContext

  if (context.relationTo === 'lessons') {
    lessonContext = await fetchLessonContext(payload, context.value, user, reqLogger)
  } else if (context.relationTo === 'exercises') {
    lessonContext = await fetchExerciseLessonContext(payload, context.value, user, reqLogger)
  } else {
    lessonContext = {
      lessonContextText: undefined,
      lessonPrompt: null,
      courseContextText: undefined,
      coursePrompt: null,
    }
  }

  // Fetch course prompt if no lesson prompt and courseId is provided
  if (!lessonContext.lessonPrompt && courseId) {
    const courseContext = await fetchCourseContext(payload, courseId, user, reqLogger)
    return {
      ...lessonContext,
      courseContextText: courseContext.courseContextText,
      coursePrompt: courseContext.coursePrompt,
    }
  }

  return {
    ...lessonContext,
    courseContextText: undefined,
    coursePrompt: null,
  }
}

export interface ComposedSystemInstructions {
  instructions: string
  promptResolution: {
    promptId?: string
    promptTitle?: string
    resolvedFrom: string
    fallbackReason?: string
  }
  systemPromptCount: number
}

/**
 * Compose full system instructions from all sources
 * Priority: lesson prompt > course prompt > default prompt
 * Includes teacher persona injection
 */
export async function composeFullSystemInstructions(
  payload: Payload,
  lessonPrompt: Prompt | null,
  lessonContextText: string | undefined,
  reqLogger: Logger,
  coursePrompt?: Prompt | null,
  courseContextText?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any,
): Promise<ComposedSystemInstructions> {
  // Fetch published system prompts (always included)
  const systemPromptsResult = await fetchPublishedSystemPrompts(payload)

  if (systemPromptsResult.count > 0) {
    reqLogger.info(
      {
        systemPromptCount: systemPromptsResult.count,
        systemPromptIds: systemPromptsResult.promptIds,
        systemPromptTitles: systemPromptsResult.promptTitles,
      },
      'Including system prompts',
    )
  }

  // Resolve system prompt using pre-loaded prompt object
  // Priority: lesson prompt > course prompt > default prompt
  const promptResolution = await resolveAgentSystemPrompt(
    payload,
    lessonPrompt || coursePrompt || null,
  )

  reqLogger.info(
    {
      promptId: promptResolution.promptId,
      promptTitle: promptResolution.promptTitle,
      resolvedFrom: promptResolution.resolvedFrom,
      ...(promptResolution.fallbackReason && { fallbackReason: promptResolution.fallbackReason }),
      usedCoursePrompt: !lessonPrompt && !!coursePrompt,
    },
    'Resolved system prompt',
  )

  // Compose final system instructions: system prompts + lesson/course prompt + lesson/course context
  // Priority: lesson context > course context
  let instructions = composeSystemInstructions(
    systemPromptsResult.templates,
    promptResolution.template,
    lessonContextText || courseContextText,
  )

  // Inject teacher persona (if user provided)
  // This is added to the system prompt but NOT to memory/vector context
  if (user) {
    try {
      const personaResult = await resolveTeacherPersona(payload, user)
      const personaXml = getPersonaXmlBlock(personaResult.persona)

      if (personaXml) {
        reqLogger.info(
          {
            personaSlug: personaResult.personaSlug,
            resolvedFrom: personaResult.resolvedFrom,
          },
          'Injecting teacher persona',
        )

        // Append persona to the end of system instructions
        instructions = instructions + '\n\n' + personaXml
      }
    } catch (error) {
      reqLogger.warn({ err: error }, 'Failed to inject teacher persona, continuing without it')
    }
  }

  return {
    instructions,
    promptResolution,
    systemPromptCount: systemPromptsResult.count,
  }
}
