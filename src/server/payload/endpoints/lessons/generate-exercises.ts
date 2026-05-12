/**
 * POST /api/lessons/:id/generate-exercises
 *
 * @fileType api-route
 * @domain lessons
 * @pattern exercise-generation
 * @ai-summary Generates AI-powered exercises for a lesson based on admin prompt
 *
 * Body: { prompt: string, exerciseType?: 'mcq' | 'true_false' | 'free_response' | 'table' | 'mixed' }
 *
 * - Creates 10 exercises using AI based on the lesson context and admin prompt
 * - Each exercise includes: prompt, hint, solution, fullSolution
 * - Exercises are automatically linked to the lesson via afterChange hook
 *
 * Access: admin only.
 */
import type { PayloadRequest } from 'payload'
import type {
  ExerciseType,
  GeneratedExercise,
} from '@/infra/llm/services/exercise-generation-service'
import { generateExercises } from '@/infra/llm/services/exercise-generation-service'
import { logger } from '@/infra/utils/logger'
import { APIError } from 'payload'
import { generateId } from '@/server/payload/collections/Exercises/defaults'
import type {
  InlineRichText,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionFreeResponseBlock,
  QuestionTableBlock,
  McqAnswer,
  TrueFalseAnswer,
} from '@/server/payload/collections/Exercises/types'

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'mcq',
  'true_false',
  'free_response',
  'table',
  'mixed',
]

interface GenerateExercisesBody {
  prompt?: unknown
  exerciseType?: unknown
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

const isExerciseType = (v: unknown): v is ExerciseType =>
  typeof v === 'string' && VALID_EXERCISE_TYPES.includes(v as ExerciseType)

function makeInlineRichText(value: string): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

type ContentBlockResult =
  | QuestionSelectMcqBlock
  | QuestionSelectTrueFalseBlock
  | QuestionFreeResponseBlock
  | QuestionTableBlock

export function transformToContentBlock(generated: GeneratedExercise): ContentBlockResult {
  const base = {
    id: generateId(),
    prompt: makeInlineRichText(generated.prompt),
    hint: makeInlineRichText(generated.hint),
    solution: makeInlineRichText(generated.solution),
    fullSolution: makeInlineRichText(generated.fullSolution),
  }

  if (generated.type === 'question_table') {
    return {
      ...base,
      type: 'question_table',
      table: generated.table || {
        headers: ['Column 1', 'Column 2'],
        rowsData: [['', '']],
        answers: {},
      },
    } as QuestionTableBlock
  }

  if (generated.type === 'question_free_response') {
    return {
      ...base,
      type: 'question_free_response',
      answer: {
        acceptedAnswers: Array.isArray(generated.answer)
          ? generated.answer
          : generated.answer
            ? [String(generated.answer)]
            : [],
      },
    } as QuestionFreeResponseBlock
  }

  // question_select (MCQ or True/False)
  const isTrueFalse = generated.options?.length === 2
  const correctOpt = generated.options?.find((o) => o.correct)

  if (isTrueFalse) {
    const trueFalseAnswer: TrueFalseAnswer = {
      correctOptionId: correctOpt?.id || 'true',
    }
    return {
      ...base,
      type: 'question_select',
      variant: 'true_false',
      selectionMode: 'single',
      options: generated.options!.map((opt) => ({
        id: opt.id as 'true' | 'false',
        value: opt.correct,
        label: makeInlineRichText(opt.label),
      })),
      answer: trueFalseAnswer,
    } as QuestionSelectTrueFalseBlock
  }

  // MCQ
  const mcqAnswer: McqAnswer = {
    multiSelect: false,
    options:
      generated.options?.map((opt) => ({
        id: opt.id,
        content: makeInlineRichText(opt.label),
      })) || [],
    correctOptionIds: correctOpt ? [correctOpt.id] : ['a'],
  }

  return {
    ...base,
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    options: mcqAnswer.options,
    answer: mcqAnswer,
  } as QuestionSelectMcqBlock
}

export async function generateExercisesEndpoint(req: PayloadRequest): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId, endpoint: 'generate-exercises' })

  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  // 2) Lesson id from path: /lessons/:id/generate-exercises
  const url = new URL(req.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/generate-exercises/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return Response.json({ error: 'Lesson id missing from path' }, { status: 400 })
  }

  // 3) Parse + validate body
  let body: GenerateExercisesBody = {}
  try {
    if (req.json) {
      body = (await req.json()) as GenerateExercisesBody
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = body.prompt
  if (!isNonEmptyString(prompt)) {
    return Response.json({ error: 'prompt is required and must be non-empty' }, { status: 400 })
  }

  if (prompt.length > 2000) {
    return Response.json({ error: 'prompt must be 2000 characters or less' }, { status: 400 })
  }

  const exerciseType: ExerciseType = isExerciseType(body.exerciseType) ? body.exerciseType : 'mixed'

  // 4) Fetch lesson with context
  let lessonTitle = ''
  let lessonDescription = ''
  let chapterTitle: string | undefined
  let courseTitle: string | undefined

  try {
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 2, // Get chapter and course for context
      overrideAccess: true,
      req,
    })

    if (!lesson) {
      return Response.json({ error: `Lesson "${lessonId}" not found` }, { status: 404 })
    }

    lessonTitle = (lesson.title as string) || ''
    lessonDescription = (lesson.description as string) || ''

    // Get chapter title
    const chapter = lesson.chapter as { title?: string } | string | null
    if (chapter && typeof chapter === 'object' && 'title' in chapter) {
      chapterTitle = chapter.title as string
    }

    // Get course title
    const course = lesson.course as { title?: string; courseLabel?: string } | string | null
    if (course && typeof course === 'object' && 'title' in course) {
      courseTitle = (course.title as string) || (course.courseLabel as string)
    }

    reqLogger.info(
      { lessonId, lessonTitle, chapterTitle, courseTitle },
      '[Generate Exercises] Fetched lesson context',
    )
  } catch (error) {
    const isNotFoundError = error instanceof APIError && error.status === 404
    if (isNotFoundError) {
      return Response.json({ error: `Lesson "${lessonId}" not found` }, { status: 404 })
    }
    reqLogger.error({ error }, '[Generate Exercises] Failed to fetch lesson')
    return Response.json({ error: 'Failed to fetch lesson' }, { status: 500 })
  }

  // 5) Generate exercises via LLM
  reqLogger.info({ prompt, exerciseType }, '[Generate Exercises] Starting generation')
  const generationResult = await generateExercises(
    {
      lessonTitle,
      lessonDescription,
      chapterTitle,
      courseTitle,
      adminPrompt: prompt,
      exerciseType,
      count: 10,
    },
    req.payload,
  )

  if (!generationResult.success || !generationResult.data) {
    reqLogger.error({ error: generationResult.error }, '[Generate Exercises] Generation failed')
    return Response.json(
      { error: generationResult.error || 'Failed to generate exercises' },
      { status: 500 },
    )
  }

  const generatedExercises = generationResult.data
  reqLogger.info({ count: generatedExercises.length }, '[Generate Exercises] Generated exercises')

  // 6) Create exercises in DB
  const createdExerciseIds: string[] = []
  const exerciseCreationErrors: string[] = []

  for (let i = 0; i < generatedExercises.length; i++) {
    const generated = generatedExercises[i]
    const exerciseNumber = i + 1

    try {
      const contentBlock = transformToContentBlock(generated)

      const exercise = await req.payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: `Exercise ${exerciseNumber}`,
          content: {
            blocks: [contentBlock],
          },
          origin: 'manual',
        },
        overrideAccess: true,
        req,
        draft: true,
      })

      createdExerciseIds.push(exercise.id)
      reqLogger.info(
        { exerciseId: exercise.id, exerciseNumber },
        '[Generate Exercises] Created exercise',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      reqLogger.error({ error, exerciseNumber }, '[Generate Exercises] Failed to create exercise')
      exerciseCreationErrors.push(`Exercise ${exerciseNumber}: ${message}`)
    }
  }

  // If all exercises failed to create, return error
  if (createdExerciseIds.length === 0) {
    return Response.json(
      {
        error: 'Failed to create any exercises',
        details: exerciseCreationErrors,
      },
      { status: 500 },
    )
  }

  // If some exercises failed, log but return partial success
  if (exerciseCreationErrors.length > 0) {
    reqLogger.warn(
      { created: createdExerciseIds.length, failed: exerciseCreationErrors.length },
      '[Generate Exercises] Partial success - some exercises failed',
    )
  }

  reqLogger.info(
    { createdCount: createdExerciseIds.length },
    '[Generate Exercises] Completed successfully',
  )

  return Response.json({
    success: true,
    count: createdExerciseIds.length,
    exerciseIds: createdExerciseIds,
    partialErrors: exerciseCreationErrors.length > 0 ? exerciseCreationErrors : undefined,
  })
}
