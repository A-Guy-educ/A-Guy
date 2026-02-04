/**
 * Approve All Handler
 *
 * Approves all pending exercises across all segments:
 * 1. Validates job exists
 * 2. Approves all pending exercises
 * 3. Transitions job to completed if all done
 */

import config from '@payload-config'
import type { ConversionJob } from '@payload-types'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const approveAllHandler: PayloadHandler = async (req) => {
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

  const pendingExercises = (job.pendingExercises as ConversionJob['pendingExercises']) || []
  const completedExercises: ConversionJob['pendingExercises'] = []
  const segments = (job.segments as ConversionJob['segments']) || []

  // Approve all pending
  const now = new Date().toISOString()
  for (const pending of pendingExercises) {
    completedExercises.push({
      ...pending,
      approvedAt: now,
      status: 'approved',
    })
  }

  // Mark all segments as completed
  const updatedSegments = segments.map((seg) => ({
    ...seg,
    status: 'completed',
    processedAt: seg.processedAt || now,
  }))

  // Calculate totals
  const totalExercises = completedExercises.length

  // Update job to completed
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'completed',
      progress: {
        ...(job.progress as object),
        currentStage: 'COMPLETE',
        currentStageMessage: 'All exercises approved',
        totalExercises,
        approvedExercises: completedExercises.length,
        completedSegments: updatedSegments.length,
      },
      completedAt: now,
      pendingExercises: [],
      completedExercises,
      segments: updatedSegments,
    },
    req,
  })

  return Response.json({
    success: true,
    message: `Approved all ${pendingExercises.length} exercises`,
    jobId: job.id,
    approvedCount: pendingExercises.length,
    status: 'completed',
  })
}
