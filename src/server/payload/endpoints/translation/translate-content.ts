/**
 * POST /api/translation/translate
 *
 * Unified endpoint for the Clone-and-Translate system.
 * Supports exercise, lesson, and course scope.
 */
import type { PayloadRequest } from 'payload'

import { logger } from '@/infra/utils/logger'
import { TranslateRequestSchema } from './translation-schema'
import { handleExerciseTranslation } from './handle-exercise-translation'
import { handleLessonTranslation } from './handle-lesson-translation'
import { handleCourseTranslation } from './handle-course-translation'

export async function translateContentEndpoint(
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

  const parseResult = TranslateRequestSchema.safeParse(body)
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

  if (input.scope === 'exercise') {
    return handleExerciseTranslation(
      req,
      {
        exerciseId: input.exerciseId,
        targetLocale: input.targetLocale,
        targetLessonId: input.targetLessonId,
        promptId: input.promptId,
      },
      reqLogger,
    )
  }

  if (input.scope === 'lesson') {
    return handleLessonTranslation(
      req,
      {
        lessonId: input.lessonId,
        targetLocale: input.targetLocale,
        targetChapterId: input.targetChapterId,
        includeExercises: input.includeExercises,
        promptId: input.promptId,
      },
      reqLogger,
    )
  }

  if (input.scope === 'course') {
    return handleCourseTranslation(
      req,
      {
        courseId: input.courseId,
        targetLocale: input.targetLocale,
        promptId: input.promptId,
      },
      reqLogger,
    )
  }

  return Response.json({ success: false, error: 'Invalid scope' }, { status: 400 })
}
