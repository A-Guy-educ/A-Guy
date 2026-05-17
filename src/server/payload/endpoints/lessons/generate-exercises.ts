/**
 * POST /api/lessons/:id/generate-exercises
 *
 * Two-phase exercise generation:
 * 1. Script phase (no AI): create N empty draft exercises in DB
 * 2. AI phase: generate content for each exercise one at a time
 *    - Save immediately after each exercise
 *    - If rate limit occurs, already-prepared exercises are saved
 *    - Return results with progress info
 *
 * Access: admin only.
 */
import type { PayloadRequest } from 'payload'
import { logger } from '@/infra/utils/logger'
import {
  createEmptyExercises,
  generateExerciseContent,
  updateExerciseWithContent,
} from '@/infra/llm/services/exercise-generation-service'

interface GenerateExercisesBody {
  prompt?: unknown
  count?: unknown
  difficultyLevel?: unknown
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isPositiveInteger = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 20

export interface ExerciseResult {
  exerciseId: string
  status: 'pending' | 'generated' | 'failed'
  error?: string
}

export interface GenerateExercisesResult {
  success: boolean
  lessonId: string
  requestedCount: number
  createdCount: number
  generatedCount: number
  exerciseIds: string[]
  results: ExerciseResult[]
  error?: string
}

export async function generateExercisesEndpoint(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  // 2) Lesson id from path: /lessons/:id/generate-exercises
  const url = new URL(req.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/generate-exercises/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return Response.json({ success: false, error: 'Lesson id missing from path' }, { status: 400 })
  }

  // 3) Parse body
  let body: GenerateExercisesBody = {}
  try {
    if (req.json) {
      body = (await req.json()) as GenerateExercisesBody
    }
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = isNonEmptyString(body.prompt) ? body.prompt.trim() : ''
  const count = isPositiveInteger(body.count) ? body.count : 10
  const difficultyLevel =
    body.difficultyLevel === 'easy' ||
    body.difficultyLevel === 'medium' ||
    body.difficultyLevel === 'hard'
      ? body.difficultyLevel
      : 'medium'

  if (!prompt) {
    return Response.json({ success: false, error: 'prompt is required' }, { status: 400 })
  }

  // 4) Verify lesson exists
  try {
    await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return Response.json(
      { success: false, error: `Lesson "${lessonId}" not found` },
      { status: 404 },
    )
  }

  reqLogger.info({ lessonId, count, prompt: prompt.slice(0, 50) }, '[Generate Exercises] Starting')

  // ─────────────────────────────────────────────────────────────────
  // Phase 1: Create N empty draft exercises (no AI)
  // ─────────────────────────────────────────────────────────────────
  let exerciseIds: string[]
  try {
    exerciseIds = await createEmptyExercises(lessonId, count, req.payload)
    reqLogger.info({ count: exerciseIds.length }, '[Generate Exercises] Created empty exercises')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reqLogger.error({ err: message }, '[Generate Exercises] Failed to create exercises')
    return Response.json(
      { success: false, error: `Failed to create exercises: ${message}` },
      { status: 500 },
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 2: Generate content for each exercise (AI, one at a time)
  // ─────────────────────────────────────────────────────────────────
  const results: ExerciseResult[] = exerciseIds.map((id) => ({ exerciseId: id, status: 'pending' }))
  let generatedCount = 0

  for (let i = 0; i < exerciseIds.length; i++) {
    const exerciseId = exerciseIds[i]
    reqLogger.info(
      { exerciseIndex: i + 1, total: exerciseIds.length, exerciseId },
      '[Generate Exercises] Generating content',
    )

    const genResult = await generateExerciseContent(
      {
        prompt,
        lessonId,
        exerciseIndex: i + 1,
        difficultyLevel,
      },
      req.payload,
    )

    if (!genResult.success || !genResult.data) {
      const errorMsg = genResult.error || 'Generation failed'
      results[i] = { exerciseId, status: 'failed', error: errorMsg }
      reqLogger.warn(
        { exerciseId, error: errorMsg },
        '[Generate Exercises] Failed to generate content — stopping',
      )
      // Stop on first failure (likely rate limit) — already-created exercises are safe
      break
    }

    const updateResult = await updateExerciseWithContent(
      exerciseId,
      genResult.data.blocks,
      req.payload,
    )

    if (!updateResult.success) {
      results[i] = { exerciseId, status: 'failed', error: updateResult.error }
      reqLogger.warn(
        { exerciseId, error: updateResult.error },
        '[Generate Exercises] Failed to save content — stopping',
      )
      break
    }

    results[i] = { exerciseId, status: 'generated' }
    generatedCount++
    reqLogger.info(
      { exerciseIndex: i + 1, total: exerciseIds.length, exerciseId },
      '[Generate Exercises] Content generated successfully',
    )
  }

  const response: GenerateExercisesResult = {
    success: true,
    lessonId,
    requestedCount: count,
    createdCount: exerciseIds.length,
    generatedCount,
    exerciseIds,
    results,
  }

  reqLogger.info(
    {
      lessonId,
      createdCount: exerciseIds.length,
      generatedCount,
    },
    '[Generate Exercises] Completed',
  )

  return Response.json(response)
}
