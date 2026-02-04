/**
 * Approve Stage Handler
 *
 * Approves the current review stage and continues processing:
 * - Validates job is at a review gate
 * - Determines next stage based on current stage and action
 * - Updates job status to running
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

import { REVIEW_GATE_STAGES, STAGE_FLOW } from '../../services/conversion-review-service'

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

  const jsonBody = req.json ? await req.json() : null
  const body = (jsonBody || {}) as { action?: 'approve' | 'skip' }
  const action = body?.action ?? 'approve'

  // Validate current stage is a review gate
  const currentStage = job.currentStage as string
  if (!REVIEW_GATE_STAGES.includes(currentStage as any)) {
    throw new Error(`Cannot approve stage: current stage is "${currentStage}"`)
  }

  // Determine next stage
  const nextStage =
    action === 'skip' ? 'SEGMENT_PERSIST' : STAGE_FLOW[currentStage as keyof typeof STAGE_FLOW]

  // Update job status
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      status: 'running',
      currentStage: nextStage,
      currentStageMessage: action === 'skip' ? 'Stage skipped' : 'Stage approved',
    },
    req,
  })

  return Response.json({
    success: true,
    message: `Stage ${action === 'skip' ? 'skipped' : 'approved'}`,
    jobId: job.id,
    previousStage: currentStage,
    currentStage: nextStage,
    status: 'running',
  })
}
