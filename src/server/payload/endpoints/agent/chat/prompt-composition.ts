/**
 * Chat Prompt Composition
 * Handles fetching lesson context, prompts, and composing system instructions
 */
import type { Payload } from 'payload'
import type { Logger } from 'pino'

import { composeSystemInstructions } from '@/infra/llm/prompt-composer.server'
import { resolveAgentSystemPrompt } from '@/infra/llm/prompt-resolver.server'
import { fetchPublishedSystemPrompts } from '@/infra/llm/system-prompts.server'
import { buildTeacherProfileBlock } from '@/infra/llm/teacher-profile-block'
import type { Prompt } from '@/payload-types'
import { resolveTeacherProfile } from '@/server/services/teacher-profile-resolver'

import type { ResolvedContext } from './context-resolution'

interface LessonContext {
  lessonPrompt: Prompt | null
  lessonContextText?: string
  courseContextText?: string
  coursePrompt: Prompt | null
  /** Exercises for the lesson, fetched for context injection */
  exercises?: Array<{
    id: string
    title?: string
    content: unknown
  }>
  /** Fallback metadata block built from lesson/chapter/course hierarchy */
  lessonContextBlock?: string
}

/**
 * Coerce a field that the schema models as InlineRichTextSchema (an object
 * `{type:'rich_text', value: string, ...}`) but might also appear as a raw
 * string in older or inline data, into a plain string suitable for the
 * system prompt. Returns undefined when no usable text is found.
 */
function richTextToString(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === 'object') {
    const v = (value as { value?: unknown }).value
    if (typeof v === 'string') {
      const trimmed = v.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
  }
  return undefined
}

/**
 * Pull readable text out of an exercise's `content.blocks[]` shape.
 * Handles two block flavours seen in the schema:
 *  - `rich_text` blocks: text under `.value`
 *  - `question_*` blocks (e.g. `question_geometry`): `.prompt` / `.hint` on the
 *    block itself. In production these are InlineRichText objects (not plain
 *    strings) — the helper above unwraps them. Without this branch,
 *    multi-part exercises surface only their intro paragraph and the model
 *    has no specific sub-question to ground answers in.
 *
 * Truncated to 4 KB to keep the system prompt bounded.
 */
function extractExerciseBody(content: unknown): string | undefined {
  if (!content) return undefined
  // Some setups store content as a JSON-encoded string
  let normalized: unknown = content
  if (typeof normalized === 'string') {
    try {
      normalized = JSON.parse(normalized)
    } catch {
      return undefined
    }
  }
  if (typeof normalized !== 'object' || normalized === null) return undefined
  const blocks = (normalized as { blocks?: unknown[] }).blocks
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined

  const parts: string[] = []
  blocks.forEach((block, idx) => {
    if (!block || typeof block !== 'object') return
    const b = block as Record<string, unknown>
    const type = (b.type as string | undefined) ?? 'block'

    // 1) Rich-text intro / explanation block (standalone rich_text)
    if (type === 'rich_text') {
      const text = richTextToString(b)
      if (text) {
        parts.push(text)
        return
      }
    }

    // 2) Question-style blocks carry prompt/hint as InlineRichText fields
    const prompt = richTextToString(b.prompt)
    const hint = richTextToString(b.hint)
    if (prompt || hint) {
      const sub: string[] = [`### Sub-question ${idx + 1} (${type})`]
      if (prompt) sub.push(`Prompt: ${prompt}`)
      if (hint) sub.push(`Hint (do not reveal directly; use for guidance): ${hint}`)
      parts.push(sub.join('\n'))
      return
    }

    // 3) Unknown / opaque block — leave a marker so the model knows something is there
    parts.push(`[${type} block]`)
  })

  if (parts.length === 0) return undefined
  const joined = parts.join('\n\n').trim()
  if (!joined) return undefined
  const MAX = 4000
  return joined.length > MAX ? joined.slice(0, MAX) + '\n…(truncated)' : joined
}

/**
 * Build a markdown block describing the current lesson and (optionally) exercise
 * so the model always knows what the student is working on, even when no admin
 * Prompt is linked to the lesson.
 *
 * Fields are looked up tolerantly — missing values are simply skipped.
 */
function buildLessonContextBlock(
  lesson?: Record<string, unknown> | null,
  chapter?: Record<string, unknown> | null,
  course?: Record<string, unknown> | null,
  exercise?: Record<string, unknown> | null,
): string | undefined {
  const lines: string[] = []

  const lessonTitle = lesson?.title as string | undefined
  const lessonType = lesson?.type as string | undefined
  const chapterTitle = chapter?.title as string | undefined
  const courseTitle = course?.title as string | undefined

  if (lessonTitle || chapterTitle || courseTitle) {
    lines.push('## Current Lesson')
    if (courseTitle) lines.push(`Course: ${courseTitle}`)
    if (chapterTitle) lines.push(`Chapter: ${chapterTitle}`)
    if (lessonTitle) lines.push(`Lesson: ${lessonTitle}`)
    if (lessonType) lines.push(`Type: ${lessonType}`)
  }

  if (exercise) {
    const exTitle = exercise.title as string | undefined
    // V1 schema (legacy): top-level prompt/hint
    const exPromptLegacy = exercise.prompt as string | undefined
    const exHintLegacy = exercise.hint as string | undefined
    // Current schema: rich-text blocks under exercise.content.blocks[]
    const exBody = extractExerciseBody(exercise.content)

    if (exTitle || exPromptLegacy || exHintLegacy || exBody) {
      if (lines.length > 0) lines.push('')
      lines.push('## Current Exercise')
      if (exTitle) lines.push(`Title: ${exTitle}`)
      if (exPromptLegacy) lines.push(`Prompt: ${exPromptLegacy}`)
      if (exHintLegacy) {
        lines.push(`Hint (do not reveal directly; use for guidance): ${exHintLegacy}`)
      }
      if (exBody) {
        lines.push('Body:')
        lines.push(exBody)
      }
    }
  }

  if (lines.length === 0) return undefined
  return [
    'The following describes what the student is currently working on. Use it to ground your responses; do not refuse to discuss it.',
    '',
    ...lines,
  ].join('\n')
}

/**
 * Walk a lesson's `blocks[]` (textarea-stored JSON) and return the
 * exercises in author-curated order. Replaces the previous reverse
 * `Exercise.lesson` lookup which produced arbitrary order and pulled in
 * any orphan / draft exercise tagged with the lesson id (audit F2 / F3).
 *
 * Notes:
 *  - Only `exerciseRef` blocks are followed; `contentPage` blocks are
 *    out of scope for the chat prompt's exercises section.
 *  - The lesson page itself uses `blocks[]` as its source of truth, so
 *    matching that ordering keeps the model's view in sync with what
 *    the student sees.
 *  - Filters by `status: 'published'` to suppress drafts. Lessons that
 *    don't store status on exercises will simply not match the filter
 *    and we fall back to the full set.
 */
async function fetchExercisesFromLessonBlocks(
  payload: Payload,
  lessonId: string,
  reqLogger: Logger,
): Promise<Array<{ id: string; title?: string; content: unknown }> | undefined> {
  try {
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      select: { blocks: true },
      overrideAccess: true,
    })) as unknown as { blocks?: string | unknown[] }

    const rawBlocks = lesson.blocks
    let parsed: unknown[] = []
    if (Array.isArray(rawBlocks)) {
      parsed = rawBlocks
    } else if (typeof rawBlocks === 'string' && rawBlocks.trim().length > 0) {
      try {
        const j = JSON.parse(rawBlocks)
        if (Array.isArray(j)) parsed = j
      } catch (err) {
        reqLogger.warn({ err, lessonId }, 'Failed to parse lesson.blocks as JSON')
      }
    }
    if (parsed.length === 0) return []

    // Collect ordered exerciseRef IDs
    const orderedIds: string[] = []
    for (const block of parsed) {
      if (!block || typeof block !== 'object') continue
      const b = block as { blockType?: string; exercise?: string | { id?: string } }
      if (b.blockType !== 'exerciseRef') continue
      const id = typeof b.exercise === 'string' ? b.exercise : b.exercise?.id
      if (id) orderedIds.push(id)
    }
    if (orderedIds.length === 0) return []

    // Bulk fetch — Mongo $in does not preserve order so we reorder client-side
    const result = await payload.find({
      collection: 'exercises',
      where: { id: { in: orderedIds } },
      depth: 0,
      select: { id: true, title: true, content: true, _status: true },
      limit: 200,
      overrideAccess: true,
    })

    const byId = new Map<string, { id: string; title?: string; content: unknown }>()
    for (const doc of result.docs) {
      const e = doc as { id: string; title?: string; content?: unknown; _status?: string }
      // Drop drafts when status is set; documents without _status pass through.
      if (e._status && e._status !== 'published') continue
      byId.set(e.id, { id: e.id, title: e.title, content: e.content })
    }
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((v): v is { id: string; title?: string; content: unknown } => v !== undefined)

    reqLogger.info(
      {
        lessonId,
        blocksCount: parsed.length,
        exerciseRefCount: orderedIds.length,
        publishedCount: ordered.length,
      },
      'Fetched exercises from lesson blocks',
    )
    return ordered
  } catch (error) {
    reqLogger.warn(
      { err: error, lessonId },
      'Failed to fetch exercises from lesson blocks; falling back to none',
    )
    return undefined
  }
}

/**
 * Resolve a relationship field that may be a string id or a populated doc.
 */
async function resolveRel(
  payload: Payload,
  collection: 'lessons' | 'chapters' | 'courses' | 'exercises',
  rel: unknown,
): Promise<Record<string, unknown> | null> {
  if (!rel) return null
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return rel as unknown as Record<string, unknown>
  }
  if (typeof rel === 'string') {
    try {
      const doc = await payload.findByID({
        collection,
        id: rel,
        depth: 0,
        overrideAccess: true,
      })
      return doc as unknown as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
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
  // The select clause must include title, type, and chapter — without them
  // buildLessonContextBlock returns undefined and the chat loses any
  // grounding context (audit F1). Keep the lessonContextText/description/
  // prompt fields too since they're consumed below.
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    select: {
      title: true,
      type: true,
      chapter: true,
      lessonContextText: true,
      description: true,
      prompt: true,
    },
    user,
    overrideAccess: false,
  })) as unknown as Record<string, unknown>

  const lessonContextText = (lesson as { lessonContextText?: string }).lessonContextText
  const lessonDescription = (lesson as { description?: string }).description

  let lessonPrompt: Prompt | null = null

  // Fetch prompt separately if lesson has one (admin-only, requires override)
  if (lesson.prompt) {
    const promptId =
      typeof lesson.prompt === 'string' ? lesson.prompt : (lesson.prompt as { id: string }).id

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

  // Build a context block from the lesson hierarchy (lesson → chapter → course)
  const chapter = await resolveRel(payload, 'chapters', lesson.chapter)
  const course = chapter ? await resolveRel(payload, 'courses', chapter.course) : null

  const lessonContextBlock = buildLessonContextBlock(lesson, chapter, course)

  return {
    lessonPrompt,
    lessonContextText: lessonContextText || lessonDescription, // Fallback to description if no explicit context text
    courseContextText: undefined,
    coursePrompt: null,
    lessonContextBlock,
  }
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
  // overrideAccess: true — pipeline already verified access via validateContextExists,
  // and we need fields like `content` regardless of role-level access config drift.
  const exercise = (await payload.findByID({
    collection: 'exercises',
    id: exerciseId,
    depth: 0,
    user,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>

  if (!exercise.lesson) {
    // Even with no parent lesson, surface what we know about the exercise itself
    return {
      lessonPrompt: null,
      lessonContextText: undefined,
      courseContextText: undefined,
      coursePrompt: null,
      lessonContextBlock: buildLessonContextBlock(null, null, null, exercise),
    }
  }

  const lessonId =
    typeof exercise.lesson === 'string' ? exercise.lesson : (exercise.lesson as { id: string }).id

  try {
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      select: { lessonContextText: true, description: true, prompt: true },
      user,
      overrideAccess: true, // Use overrideAccess since student role may not have lesson read access
    })) as unknown as Record<string, unknown>

    const lessonContextText = (lesson as { lessonContextText?: string }).lessonContextText
    const lessonDescription = (lesson as { description?: string }).description

    let lessonPrompt: Prompt | null = null

    // Fetch prompt separately if lesson has one
    if (lesson.prompt) {
      const promptId =
        typeof lesson.prompt === 'string' ? lesson.prompt : (lesson.prompt as { id: string }).id

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

    const chapter = await resolveRel(payload, 'chapters', lesson.chapter)
    const course = chapter ? await resolveRel(payload, 'courses', chapter.course) : null

    const lessonContextBlock = buildLessonContextBlock(lesson, chapter, course, exercise)

    return {
      lessonPrompt,
      lessonContextText: lessonContextText || lessonDescription,
      courseContextText: undefined,
      coursePrompt: null,
      lessonContextBlock,
    }
  } catch (error) {
    reqLogger.warn(
      { err: error, lessonId, exerciseId },
      'Failed to fetch lesson for exercise context, continuing without lesson context',
    )
    return {
      lessonPrompt: null,
      lessonContextText: undefined,
      courseContextText: undefined,
      coursePrompt: null,
      lessonContextBlock: buildLessonContextBlock(null, null, null, exercise),
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
  let exercises: LessonContext['exercises'] = undefined

  if (context.relationTo === 'lessons') {
    lessonContext = await fetchLessonContext(payload, context.value, user, reqLogger)
    exercises = await fetchExercisesFromLessonBlocks(payload, context.value, reqLogger)
  } else if (context.relationTo === 'exercises') {
    lessonContext = await fetchExerciseLessonContext(payload, context.value, user, reqLogger)
    // Resolve the parent lesson and pull its curated blocks list
    try {
      const exercise = await payload.findByID({
        collection: 'exercises',
        id: context.value,
        depth: 0,
        select: { lesson: true },
      })
      const lessonId =
        typeof (exercise as { lesson?: unknown }).lesson === 'string'
          ? (exercise as { lesson: string }).lesson
          : (exercise as { lesson: { id: string } }).lesson?.id
      if (lessonId) {
        exercises = await fetchExercisesFromLessonBlocks(payload, lessonId, reqLogger)
      }
    } catch (error) {
      reqLogger.warn(
        { err: error, exerciseId: context.value },
        'Failed to fetch exercises for parent lesson',
      )
    }
  } else {
    lessonContext = {
      lessonPrompt: null,
      lessonContextText: undefined,
      courseContextText: undefined,
      coursePrompt: null,
    }
  }

  // Fetch course prompt if no lesson prompt and courseId is provided
  if (!lessonContext.lessonPrompt && courseId) {
    const courseContext = await fetchCourseContext(payload, courseId, user, reqLogger)
    lessonContext = {
      ...lessonContext,
      exercises,
      courseContextText: courseContext.courseContextText,
      coursePrompt: courseContext.coursePrompt,
    }
  } else {
    lessonContext = {
      ...lessonContext,
      exercises,
      courseContextText: undefined,
      coursePrompt: null,
    }
  }

  // Diagnostic: surface whether the auto-context block was produced and a
  // short preview of it. Helps catch silent extraction failures in prod.
  reqLogger.info(
    {
      relationTo: context.relationTo,
      hasLessonPrompt: !!lessonContext.lessonPrompt,
      hasLessonContextBlock: !!lessonContext.lessonContextBlock,
      lessonContextBlockPreview: lessonContext.lessonContextBlock?.slice(0, 300),
      lessonContextBlockLength: lessonContext.lessonContextBlock?.length ?? 0,
    },
    'Resolved lesson context for chat',
  )

  return lessonContext
}

/**
 * Re-export for tests/diagnostics. Keeps the helper isolated and unit-testable.
 */
export { buildLessonContextBlock as _buildLessonContextBlock }

export interface ComposedSystemInstructions {
  instructions: string
  promptResolution: {
    promptId?: string
    promptTitle?: string
    resolvedFrom: string
    fallbackReason?: string
  }
  systemPromptCount: number
  teacherProfileSlug: string
  teacherProfileResolvedFrom: string
}

/**
 * Compose full system instructions from all sources
 * Priority: lesson prompt > course prompt > default prompt
 */
export async function composeFullSystemInstructions(
  payload: Payload,
  lessonPrompt: Prompt | null,
  reqLogger: Logger,
  coursePrompt?: Prompt | null,
  courseContextText?: string,
  userId?: string,
  lessonContextBlock?: string,
  lessonContextText?: string,
  exercises?: LessonContext['exercises'],
  hasImageAttached: boolean = false,
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

  // Resolve teacher profile (per-request, no caching)
  const teacherProfile = await resolveTeacherProfile(payload, userId)

  // Build teacher profile block
  const teacherProfileBlock = buildTeacherProfileBlock(teacherProfile)

  reqLogger.info(
    {
      teacherProfileSlug: teacherProfile.profileSlug,
      resolvedFrom: teacherProfile.resolvedFrom,
    },
    'Resolved teacher profile',
  )

  // Compose final system instructions:
  // system prompts + teacher profile + lesson/course prompt +
  // lesson context block (fallback metadata) + course/lesson context + exercises
  const instructions = composeSystemInstructions(
    systemPromptsResult.templates,
    promptResolution.template,
    teacherProfileBlock,
    lessonContextBlock,
    lessonContextText,
    courseContextText,
    exercises,
    hasImageAttached,
  )

  return {
    instructions,
    promptResolution,
    systemPromptCount: systemPromptsResult.count,
    teacherProfileSlug: teacherProfile.profileSlug,
    teacherProfileResolvedFrom: teacherProfile.resolvedFrom,
  }
}
