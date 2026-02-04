/**
 * SSE Stream Handler for Conversion Jobs
 *
 * Provides real-time streaming of job progress, logs, and events
 * to connected clients using Server-Sent Events.
 */

import type { PayloadHandler } from 'payload'

export const streamHandler: PayloadHandler = async (req) => {
  const { id: jobId } = req.routeParams as { id?: string }

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Job ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Set up SSE headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const payload = req.payload ?? (await import('@payload-config')).default

        // Fetch initial job state
        const job = await payload.findByID({
          collection: 'conversion-jobs',
          id: jobId,
          depth: 0,
        })

        if (!job) {
          controller.enqueue(
            `event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`,
          )
          controller.close()
          return
        }

        // Send initial state
        controller.enqueue(
          `event: connected\ndata: ${JSON.stringify({ jobId: job.id, status: job.status })}\n\n`,
        )

        // Send initial job data
        controller.enqueue(`event: state\ndata: ${JSON.stringify(serializeJobForStream(job))}\n\n`)

        // Send initial logs if any
        if (job.logs && job.logs.length > 0) {
          controller.enqueue(`event: logs\ndata: ${JSON.stringify(job.logs)}\n\n`)
        }

        // Poll for updates until job reaches terminal state
        await pollForUpdates(payload, jobId, controller, job.status as string)
      } catch (error) {
        console.error('[SSE Stream] Error:', error)
        controller.enqueue(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        controller.close()
      }
    },
    cancel() {
      // Client disconnected
      console.log('[SSE Stream] Client disconnected:', jobId)
    },
  })

  return new Response(stream, { headers })
}

/**
 * Poll for job updates and send events
 */
async function pollForUpdates(
  payload: any,
  jobId: string,
  controller: ReadableStreamDefaultController,
  initialStatus: string,
): Promise<void> {
  const terminalStatuses = ['completed', 'failed', 'cancelled']
  const pollInterval = 1000 // 1 second
  const maxIterations = 300 // 5 minutes max
  let iterations = 0

  while (iterations < maxIterations) {
    try {
      const job = await payload.findByID({
        collection: 'conversion-jobs',
        id: jobId,
        depth: 0,
      })

      if (!job) {
        controller.enqueue(`event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`)
        break
      }

      const jobStatus = job.status as string

      // Check if status changed
      if (jobStatus !== initialStatus) {
        controller.enqueue(`event: status\ndata: ${JSON.stringify({ status: jobStatus })}\n\n`)
      }

      // Send updated state
      controller.enqueue(`event: state\ndata: ${JSON.stringify(serializeJobForStream(job))}\n\n`)

      // Check for review required
      if (jobStatus === 'review') {
        controller.enqueue(
          `event: review_required\ndata: ${JSON.stringify({
            message: 'Job requires approval to continue',
            pendingExercises: job.pendingExercises?.length || 0,
          })}\n\n`,
        )
      }

      // Check if job reached terminal state
      if (terminalStatuses.includes(jobStatus)) {
        controller.enqueue(`event: complete\ndata: ${JSON.stringify({ status: jobStatus })}\n\n`)
        break
      }

      // Wait before next poll
      await sleep(pollInterval)
      iterations++
    } catch (error) {
      console.error('[SSE Stream] Poll error:', error)
      controller.enqueue(`event: error\ndata: ${JSON.stringify({ error: 'Poll error' })}\n\n`)
      break
    }
  }

  controller.close()
}

/**
 * Serialize job document for streaming
 */
function serializeJobForStream(job: any): Record<string, unknown> {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    currentStage: job.currentStage,
    progress: job.progress,
    segments: job.segments,
    pendingExercises: job.pendingExercises,
    completedExercises: job.completedExercises,
    totalExercises: job.totalExercises,
    logs: job.logs,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
