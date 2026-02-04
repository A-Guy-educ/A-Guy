/**
 * Override Verification Handler
 *
 * Overrides verification failure for a pending exercise:
 * - Clears the verification failure
 * - Allows exercise to proceed
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const overrideVerificationHandler: PayloadHandler = async (req) => {
  const { id: jobId, exerciseId: exerciseIndexStr } = req.routeParams as {
    id?: string
    exerciseId?: string
  }

  if (!jobId || exerciseIndexStr === undefined) {
    throw new APIError('Job ID and Exercise ID required', 400)
  }

  const exerciseIndex = parseInt(exerciseIndexStr, 10)
  if (isNaN(exerciseIndex)) {
    throw new APIError('Invalid exercise ID', 400)
  }

  const payload = req.payload ?? (await getPayload({ config }))

  // Fetch the conversion job
  const job = await payload.findByID({
    collection: 'conversion-jobs',
    id: jobId,
    depth: 0,
  })

  if (!job) {
    throw new APIError('Job not found', 404)
  }

  const pendingExercises = [...((job.pendingExercises as any[]) || [])]

  if (exerciseIndex >= pendingExercises.length) {
    throw new APIError(`Exercise index ${exerciseIndex} not found`, 404)
  }

  const exercise = pendingExercises[exerciseIndex]

  // Clear verification failure
  if (exercise.verificationResult) {
    exercise.verificationResult = {
      ...exercise.verificationResult,
      passed: true,
      message: 'Overridden by admin',
    }
  }

  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      pendingExercises,
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Verification overridden',
    jobId: job.id,
    exerciseIndex,
    verificationResult: exercise.verificationResult,
  })
}
