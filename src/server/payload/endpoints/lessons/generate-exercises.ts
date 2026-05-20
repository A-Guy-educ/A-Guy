/**
 * POST /api/lessons/:id/generate-exercises
 *
 * @fileType api-route
 * @domain lessons
 * @pattern exercise-generation-job
 * @ai-summary Creates an ExerciseGenerations record to generate exercises via AI.
 *
 * Body: { prompt: string, maxCount: number, difficultyLevel: 'easy' | 'medium' | 'hard' }
 *
 * Creates a pending ExerciseGenerations record and returns { id }.
 * The actual generation work is handled by the cron worker.
 *
 * Access: admin only.
 */
import type { PayloadRequest } from 'payload'

import {
  GENERATION_DIFFICULTY_LEVELS,
  type GenerationDifficultyLevel,
} from '@/server/payload/collections/ExerciseGenerations'

interface GenerateExercisesBody {
  prompt?: unknown
  maxCount?: unknown
  difficultyLevel?: unknown
}

const isDifficultyLevel = (v: unknown): v is GenerationDifficultyLevel =>
  typeof v === 'string' && (GENERATION_DIFFICULTY_LEVELS as readonly string[]).includes(v)

export async function generateExercisesEndpoint(req: PayloadRequest): Promise<Response> {
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

  // Validate prompt (required, must be non-empty string)
  if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    return Response.json(
      { error: 'prompt is required and must be a non-empty string' },
      { status: 400 },
    )
  }

  // Validate maxCount (optional, default 10, must be 1-20)
  const maxCount = typeof body.maxCount === 'number' ? body.maxCount : 10
  if (!Number.isInteger(maxCount) || maxCount < 1 || maxCount > 20) {
    return Response.json({ error: 'maxCount must be an integer between 1 and 20' }, { status: 400 })
  }

  // Validate difficultyLevel (optional, default 'medium')
  const difficultyLevel: GenerationDifficultyLevel = isDifficultyLevel(body.difficultyLevel)
    ? body.difficultyLevel
    : 'medium'

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
    return Response.json({ error: `Lesson "${lessonId}" not found` }, { status: 404 })
  }

  // 5) Create the generation record
  const record = await req.payload.create({
    collection: 'exercise-generations',
    data: {
      lesson: lessonId,
      prompt: body.prompt.trim(),
      maxCount,
      difficultyLevel,
      status: 'pending',
    } as never,
    overrideAccess: true,
    req,
  })

  return Response.json({ id: record.id, status: 'pending' })
}
