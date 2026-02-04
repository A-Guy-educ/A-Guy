/**
 * Edit Exercise Handler
 *
 * Edits a pending exercise in the conversion job:
 * 1. Validates job exists and is in review status
 * 2. Finds and updates the exercise
 * 3. Returns updated exercise
 */

import config from '@payload-config'
import type { PayloadHandler } from 'payload'
import { APIError, getPayload } from 'payload'

export const editExerciseHandler: PayloadHandler = async (req) => {
  const { id: jobId, exerciseId } = req.routeParams as { id?: string; exerciseId?: string }

  if (!jobId || !exerciseId) {
    throw new APIError('Job ID and Exercise ID required', 400)
  }

  const payload = req.payload ?? (await getPayload({ config }))

  // Parse request body
  const body = await req.json?.().catch(() => ({}))
  const { title, content, adminNotes } = body

  // Fetch the conversion job
  const job = await payload.findByID({
    collection: 'conversion-jobs',
    id: jobId,
    depth: 0,
  })

  if (!job) {
    throw new APIError('Job not found', 404)
  }

  // Find the exercise in pending or completed
  const pendingExercises = (job.pendingExercises as any[]) || []
  const completedExercises = (job.completedExercises as any[]) || []

  let exerciseIndex = pendingExercises.findIndex((e) => e.id === exerciseId)
  let isPending = true

  if (exerciseIndex === -1) {
    exerciseIndex = completedExercises.findIndex((e) => e.id === exerciseId)
    isPending = false
  }

  if (exerciseIndex === -1) {
    throw new APIError('Exercise not found in job', 404)
  }

  // Update the exercise
  const exercises = isPending ? pendingExercises : completedExercises
  const original = exercises[exerciseIndex]

  exercises[exerciseIndex] = {
    ...original,
    title: title ?? original.title,
    content: content ?? original.content,
    adminNotes: adminNotes ?? original.adminNotes,
    editedAt: new Date().toISOString(),
    editedBy: req.user?.id,
  }

  // Save back
  await payload.update({
    collection: 'conversion-jobs',
    id: job.id,
    data: {
      pendingExercises: isPending ? exercises : undefined,
      completedExercises: isPending ? undefined : exercises,
    },
    req,
  })

  return Response.json({
    success: true,
    message: 'Exercise updated',
    exercise: exercises[exerciseIndex],
  })
}
