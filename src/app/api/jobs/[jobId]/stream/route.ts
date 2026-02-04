import { requireAdminOrTestSecret } from '@/server/api/auth'
import { apiError } from '@/server/api/responses'
import type { JobStatus } from '@/server/payload/jobs/types'
import { JobService } from '@/server/payload/services/job-service'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

// SSE configuration
const POLL_INTERVAL_MS = 500
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000 // 5 minutes max
const MAX_IDLE_MS = 30000 // 30 seconds idle before closing

interface StreamEvent {
  type: string
  data: unknown
  id?: string
}

function formatSSEEvent(event: StreamEvent): string {
  let result = ''
  if (event.id) result += `id: ${event.id}\n`
  result += `event: ${event.type}\n`
  result += `data: ${JSON.stringify(event.data)}\n\n`
  return result
}

function getJobStatus(doc: any): JobStatus {
  if (doc.processing) return 'running'
  if (doc.hasError) return 'failed'
  if (doc.completedAt) return 'completed'
  return 'queued'
}

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  try {
    const { jobId } = await params
    const payload = await getPayload({ config })
    const authHeader = request.headers.get('authorization')

    // Auth check
    try {
      const { user } = await payload.auth({ headers: request.headers })
      requireAdminOrTestSecret(user as any, authHeader)
    } catch {
      return apiError('UNAUTHORIZED', 'Admin access required', 401)
    }

    // Validate jobId format
    if (!ObjectId.isValid(jobId)) {
      return apiError('VALIDATION_ERROR', 'Invalid job ID format', 400)
    }

    const jobService = JobService.fromPayload(payload)
    const job = await jobService.getById(jobId)

    if (!job) {
      return apiError('NOT_FOUND', 'Job not found', 404)
    }

    const startTime = Date.now()
    let lastLogCount = 0
    let lastActivityTime = Date.now()

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Helper to send event
        const sendEvent = (type: string, data: unknown, eventId?: string) => {
          const eventObj: StreamEvent = { type, data, id: eventId }
          controller.enqueue(encoder.encode(formatSSEEvent(eventObj)))
          lastActivityTime = Date.now()
        }

        // Helper to check if job is terminal
        const isTerminal = (status: JobStatus) => status === 'completed' || status === 'failed'

        try {
          // Send initial job status
          const initialStatus = getJobStatus(job)
          sendEvent('status', {
            id: job.id,
            status: initialStatus,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            processing: job.processing,
            hasError: job.hasError,
            output: job.output,
          })

          // Send initial logs if any
          const initialLogs = (job.output as any)?.logs || []
          if (initialLogs.length > 0) {
            sendEvent('logs', { logs: initialLogs, isInitial: true })
          }

          // If already terminal, send done event and close
          if (isTerminal(initialStatus)) {
            sendEvent('done', {
              status: initialStatus,
              finalOutput: job.output,
            })
            controller.close()
            return
          }

          // Poll for updates
          // eslint-disable-next-line no-constant-condition
          while (true) {
            // Check max stream duration
            if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
              sendEvent('done', { reason: 'timeout', status: 'running' })
              break
            }

            // Check idle timeout
            if (Date.now() - lastActivityTime > MAX_IDLE_MS) {
              sendEvent('done', { reason: 'idle_timeout', status: 'running' })
              break
            }

            // Fetch updated job
            const updatedJob = await jobService.getById(jobId)
            if (!updatedJob) {
              sendEvent('error', { message: 'Job not found' })
              break
            }

            const currentStatus = getJobStatus(updatedJob)
            const logs = (updatedJob.output as any)?.logs || []
            const newLogs = logs.slice(lastLogCount)

            // Send new logs
            if (newLogs.length > 0) {
              sendEvent('logs', { logs: newLogs, isInitial: false })
              lastLogCount = logs.length
            }

            // Send status update
            sendEvent('status', {
              id: updatedJob.id,
              status: currentStatus,
              processing: updatedJob.processing,
              hasError: updatedJob.hasError,
              completedAt: updatedJob.completedAt,
              output: updatedJob.output,
            })

            // Check if terminal
            if (isTerminal(currentStatus)) {
              sendEvent('done', {
                status: currentStatus,
                finalOutput: updatedJob.output,
              })
              break
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
          }
        } catch (_error) {
          sendEvent('error', { message: 'Stream error' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    console.error('[jobs/[jobId]/stream] Error:', error)
    return apiError('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
