/**
 * POST /api/exercises/generate-support
 * Generates AI-powered hints, solutions, and full solutions
 *
 * Supports three scopes:
 * - section: Single block within an exercise
 * - exercise: All question blocks in an exercise
 * - lesson: All exercises in a lesson
 */
import type { PayloadRequest } from 'payload'
import { logger } from '@/infra/utils/logger'
import { GenerateSupportSchema } from './generate-support/schema'
import { handleSectionScope } from './generate-support/handle-section-scope'
import { handleExerciseScope } from './generate-support/handle-exercise-scope'
import { handleLessonScope } from './generate-support/handle-lesson-scope'

export async function generateSupportEndpoint(
  req: PayloadRequest & { json?: () => Promise<unknown> },
) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = req.json ? await req.json() : null
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = GenerateSupportSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json(
      {
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    )
  }

  const input = parseResult.data

  if (input.scope === 'section') {
    return handleSectionScope(req, input, reqLogger)
  }

  if (input.scope === 'exercise') {
    return handleExerciseScope(req, input, reqLogger)
  }

  if (input.scope === 'lesson') {
    return handleLessonScope(req, input, reqLogger)
  }

  return Response.json({ success: false, error: 'Invalid scope' }, { status: 400 })
}
