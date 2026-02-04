/**
 * Finalize Conversion Job Handler
 *
 * Finalizes a completed conversion job:
 * 1. Validates job exists and is in completed status
 * 2. Generates summary
 * 3. Updates job as finalized
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const finalizeHandler: PayloadHandler = async (req) => {
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

  // Validate job is completed
  if (job.status !== 'completed') {
    throw new APIError(`Job is not completed. Current status: ${job.status}`, 400)
  }

  const completedExercises = (job.completedExercises as any[]) || []
  const segments = (job.segments as any[]) || []

  // Generate summary
  const summary = {
    totalExercises: completedExercises.length,
    totalSegments: segments.length,
    completedSegments: segments.filter((s) => s.status === 'completed').length,
    failedSegments: segments.filter((s) => s.status === 'failed').length,
    skippedExercises: (job.progress as any)?.skippedExercises || 0,
    dedupedExercises: (job.progress as any)?.dedupedExercises || 0,
    duration: job.startedAt
      ? Math.floor((new Date().getTime() - new Date(job.startedAt).getTime()) / 1000)
      : 0,
  }

  // Update job as finalized
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      isFinalized: true,
      finalizedAt: new Date().toISOString(),
      summary,
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Conversion job finalized',
    jobId: job.id,
    summary,
  })
}
