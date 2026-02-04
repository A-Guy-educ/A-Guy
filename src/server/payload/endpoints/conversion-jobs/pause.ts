/**
 * Pause Conversion Job Handler
 *
 * Pauses a running conversion job by:
 * 1. Validating job exists and is in running status
 * 2. Updating job status to paused
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const pauseConversionHandler: PayloadHandler = async (req) => {
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

  // Validate job can be paused
  const pausableStatuses = ['running', 'review']
  if (!pausableStatuses.includes(job.status)) {
    throw new APIError(
      `Cannot pause job in ${job.status} status. Job must be running or in review.`,
      400,
    )
  }

  // Update job status to paused
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'paused',
      progress: {
        currentStageMessage: 'Conversion paused by user',
      },
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Conversion job paused',
    jobId: job.id,
  })
}
