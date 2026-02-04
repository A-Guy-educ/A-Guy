/**
 * Approve Stage Handler
 *
 * Approves pending exercises after a review stage:
 * 1. Validates job exists and is in review status
 * 2. Approves pending exercises
 * 3. Updates job status to continue processing
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const approveStageHandler: PayloadHandler = async (req) => {
  const { id: jobId } = req.routeParams as { id?: string }

  if (!jobId) {
    throw new APIError('Job ID required', 400)
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

  // Validate job is in review status
  if (job.status !== 'review') {
    throw new APIError(`Job is not in review status. Current status: ${job.status}`, 400)
  }

  const pendingExercises = (job.pendingExercises as any[]) || []

  // Move pending exercises to completed
  const completedExercises = (job.completedExercises as any[]) || []

  for (const pending of pendingExercises) {
    completedExercises.push({
      ...pending,
      approvedAt: new Date().toISOString(),
      status: 'approved',
    })
  }

  // Update job
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'running',
      currentStage: 'SEGMENT_PERSIST',
      currentStageMessage: 'Exercises approved, continuing processing',
      pendingExercises: [],
      completedExercises,
      progress: {
        ...(job.progress as object),
        approvedExercises: completedExercises.length,
      },
    },
    req,
  })

  return Response.json({
    success: true,
    message: `Approved ${pendingExercises.length} exercises`,
    jobId: job.id,
    approvedCount: pendingExercises.length,
  })
}
