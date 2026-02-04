/**
 * Reject Exercise Handler
 *
 * Rejects a single pending exercise with a reason:
 * - Moves from pendingExercises to completedExercises with rejected status
 * - Updates progress counters
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const rejectExerciseHandler: PayloadHandler = async (req) => {
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

  const jsonBody = req.json ? await req.json() : null
  const body = (jsonBody || {}) as { reason?: string }
  const reason = body?.reason ?? 'No reason provided'

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
  const completedExercises = [...((job.completedExercises as any[]) || [])]

  if (exerciseIndex >= pendingExercises.length) {
    throw new APIError(`Exercise index ${exerciseIndex} not found`, 404)
  }

  const exercise = pendingExercises[exerciseIndex]
  const now = new Date().toISOString()

  // Move from pending to completed as rejected
  pendingExercises.splice(exerciseIndex, 1)
  completedExercises.push({
    ...exercise,
    status: 'rejected',
    adminNotes: reason,
    approvedAt: now,
  })

  // Update progress
  const rejectedCount = (job.progress as any)?.rejectedExercises + 1 || 1

  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      pendingExercises,
      completedExercises,
      progress: {
        ...(job.progress as object),
        rejectedExercises: rejectedCount,
      },
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Exercise rejected',
    jobId: job.id,
    exerciseIndex,
    status: 'rejected',
    reason,
    rejectedCount,
  })
}
