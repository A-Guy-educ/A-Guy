/**
 * Preview Conversion Job Handler
 *
 * Generates a preview of conversion output without persisting:
 * 1. Validates job exists
 * 2. Processes a sample segment
 * 3. Returns preview data
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const previewHandler: PayloadHandler = async (req) => {
  const { id: jobId } = req.routeParams as { id?: string }

  if (!jobId) {
    throw new APIError('Job ID required', 400)
  }

  const payload = req.payload ?? (await getPayload({ config }))

  // Fetch the conversion job
  const job = await payload.findByID({
    collection: 'conversion-jobs',
    id: jobId,
    depth: 1,
  })

  if (!job) {
    throw new APIError('Job not found', 404)
  }

  // Return preview configuration
  const preview = {
    jobId: job.id,
    lesson: job.lesson,
    sourceMedia: job.sourceMedia,
    config: job.config,
    prompts: {
      extractorId: (job.prompts as any)?.extractor?.id || (job.prompts as any)?.extractor,
      verifierId: (job.prompts as any)?.verifier?.id || (job.prompts as any)?.verifier,
    },
    additionalRounds: job.additionalRounds,
    template: job.template,
    status: job.status,
  }

  return Response.json({
    success: true,
    preview,
  })
}
