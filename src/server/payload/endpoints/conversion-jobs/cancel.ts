/**
 * Cancel Conversion Job Handler
 *
 * Cancels a conversion job by:
 * 1. Validating job exists and is not in terminal status
 * 2. Updating job status to cancelled
 * 3. Cleaning up resources
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const cancelConversionHandler: PayloadHandler = async (req) => {
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

  // Validate job can be cancelled
  const terminalStatuses = ['completed', 'failed', 'cancelled']
  if (terminalStatuses.includes(job.status)) {
    throw new APIError(`Cannot cancel job in ${job.status} status. Job is already terminal.`, 400)
  }

  // Cancel the Payload job if running
  if (job.payloadJobId) {
    try {
      await payload.jobs.cancel({
        where: { id: { equals: job.payloadJobId } },
      })
    } catch (error) {
      console.warn('[cancelConversion] Could not cancel payload job:', error)
    }
  }

  // Update job status to cancelled
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'cancelled',
      currentStageMessage: 'Conversion cancelled by user',
      completedAt: new Date().toISOString(),
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Conversion job cancelled',
    jobId: job.id,
  })
}
