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
 * Access: admin only.
 */
import { NextResponse } from 'next/server'
import { withApiHandler } from '@/server/api/with-api-handler'
import type {
  ExerciseType,
  GeneratedExercise,
} from '@/infra/llm/services/exercise-generation-service'
import { generateExercises } from '@/infra/llm/services/exercise-generation-service'
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

function transformToContentBlock(generated: GeneratedExercise): ContentBlockResult {
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
    answer: mcqAnswer,
  } as QuestionSelectMcqBlock
}

export const POST = withApiHandler<unknown, unknown>({ auth: 'admin' }, async (ctx) => {
  const { payload, request, logger } = ctx

  // Parse body manually
  let rawBody: { prompt?: unknown; exerciseType?: unknown } = {}
  try {
    rawBody = (await request.json()) as typeof rawBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = rawBody.prompt
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required and must be non-empty' }, { status: 400 })
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: 'prompt must be 2000 characters or less' }, { status: 400 })
  }

  const exerciseType: ExerciseType = VALID_EXERCISE_TYPES.includes(
    rawBody.exerciseType as ExerciseType,
  )
    ? (rawBody.exerciseType as ExerciseType)
    : 'mixed'

  // Extract lesson id from path: /api/lessons/:id/generate-exercises
  const url = new URL(request.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/generate-exercises/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return NextResponse.json({ error: 'Lesson id missing from path' }, { status: 400 })
  }

  logger.info({ lessonId, prompt, exerciseType }, '[Generate Exercises] Starting')

  // Fetch lesson with context
  let lessonTitle = ''
  let lessonDescription = ''
  let chapterTitle: string | undefined
  let courseTitle: string | undefined

  try {
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 2,
      overrideAccess: false,
    })

    if (!lesson) {
      return NextResponse.json({ error: `Lesson "${lessonId}" not found` }, { status: 404 })
    }

    lessonTitle = (lesson.title as string) || ''
    lessonDescription = (lesson.description as string) || ''

    const chapter = lesson.chapter as { title?: string } | string | null
    if (chapter && typeof chapter === 'object' && 'title' in chapter) {
      chapterTitle = chapter.title as string
    }

    const course = lesson.course as { title?: string; courseLabel?: string } | string | null
    if (course && typeof course === 'object' && 'title' in course) {
      courseTitle = (course.title as string) || (course.courseLabel as string)
    }
  } catch (error) {
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500
    logger.error({ error }, '[Generate Exercises] Failed to fetch lesson')
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status })
  }

  // Generate exercises via LLM
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
    payload,
  )

  if (!generationResult.success || !generationResult.data) {
    logger.error({ error: generationResult.error }, '[Generate Exercises] Generation failed')
    return NextResponse.json(
      { error: generationResult.error || 'Failed to generate exercises' },
      { status: 500 },
    )
  }

  const generatedExercises = generationResult.data
  logger.info({ count: generatedExercises.length }, '[Generate Exercises] Generated exercises')

  // Create exercises in DB
  const createdExerciseIds: string[] = []
  const exerciseCreationErrors: string[] = []

  for (let i = 0; i < generatedExercises.length; i++) {
    const generated = generatedExercises[i]
    const exerciseNumber = i + 1

    try {
      const contentBlock = transformToContentBlock(generated)

      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: `Exercise ${exerciseNumber}`,
          content: {
            blocks: [contentBlock],
          },
          origin: 'manual',
        },
        draft: true,
      })

      createdExerciseIds.push(exercise.id)
      logger.info(
        { exerciseId: exercise.id, exerciseNumber },
        '[Generate Exercises] Created exercise',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ error, exerciseNumber }, '[Generate Exercises] Failed to create exercise')
      exerciseCreationErrors.push(`Exercise ${exerciseNumber}: ${message}`)
    }
  }

  if (createdExerciseIds.length === 0) {
    return NextResponse.json(
      { error: 'Failed to create any exercises', details: exerciseCreationErrors },
      { status: 500 },
    )
  }

  if (exerciseCreationErrors.length > 0) {
    logger.warn(
      { created: createdExerciseIds.length, failed: exerciseCreationErrors.length },
      '[Generate Exercises] Partial success',
    )
  }

  logger.info({ createdCount: createdExerciseIds.length }, '[Generate Exercises] Completed')

  return NextResponse.json({
    success: true,
    count: createdExerciseIds.length,
    exerciseIds: createdExerciseIds,
    partialErrors: exerciseCreationErrors.length > 0 ? exerciseCreationErrors : undefined,
  })
})
