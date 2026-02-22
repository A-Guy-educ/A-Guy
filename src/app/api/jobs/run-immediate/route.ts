import { loadRuntimeConfig } from '@/infra/config/runtime/runtime-config'
import { logger } from '@/infra/utils/logger'
import { LOCK_TIMEOUT_MS } from '@/server/config/constants'
import configPromise from '@payload-config'
import { ObjectId, type Collection, type Document } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import type { Payload, User } from 'payload'
import { getPayload } from 'payload'

const log = logger.child({ route: 'run-immediate' })

interface JobDocument extends Document {
  _id: ObjectId
  taskSlug?: string
  task?: string
  processing?: boolean
  hasError?: boolean
  lockExpiresAt?: Date
  completedAt?: Date
  startedAt?: Date
  output?: unknown
}

async function getJobsCollection(payloadInstance: Payload): Promise<Collection<JobDocument>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payloadInstance.db as any
  // Payload 3.x: Use collections.jobs or collection('jobs')
  const coll =
    db.collections?.jobs || db.collection?.('jobs') || db.connection?.collection?.('payload-jobs')
  if (!coll) throw new Error('Cannot access Jobs collection')
  return coll as Collection<JobDocument>
}

async function atomicClaimAndRunJob(
  coll: Collection<JobDocument>,
  jobId: string,
): Promise<JobDocument | null> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS)

  const job = await coll.findOneAndUpdate(
    {
      _id: new ObjectId(jobId),
      processing: { $ne: true },
      hasError: { $ne: true },
      $or: [{ lockExpiresAt: { $exists: false } }, { lockExpiresAt: { $lt: now } }],
    },
    {
      $set: {
        processing: true,
        startedAt: now,
        lockExpiresAt: expiresAt,
      },
    },
    { returnDocument: 'after' },
  )

  return job
}

async function updateJobStatus(
  coll: Collection<JobDocument>,
  jobId: string,
  status: 'completed' | 'failed',
  output?: unknown,
): Promise<void> {
  const update: Record<string, unknown> = {
    processing: false,
    completedAt: new Date(),
    hasError: status === 'failed',
  }

  if (output) {
    update.jobOutput = output
  }

  await coll.updateOne({ _id: new ObjectId(jobId) }, { $set: update })
}

export async function POST(request: NextRequest) {
  let payload: Payload | null = null

  try {
    payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    // Admin-only access
    const typedUser = user as User | null
    if (!user || (typedUser && 'role' in typedUser && typedUser.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 })
    }

    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    // Access the jobs collection through payload.db with a properly connected instance
    const coll = await getJobsCollection(payload)

    const jobDoc = await atomicClaimAndRunJob(coll, jobId)

    if (!jobDoc) {
      return NextResponse.json(
        { error: 'Job not found, already running, or already completed' },
        { status: 404 },
      )
    }

    log.info({ jobId }, '[run-immediately] Executing job synchronously')

    // Load runtime config before job execution
    log.info('[run-immediately] Loading runtime config...')
    await loadRuntimeConfig(payload)
    log.info('[run-immediately] Runtime config loaded')

    // Normalize job object: MongoDB returns _id (ObjectId), but task handler expects id (string)
    const job = {
      ...jobDoc,
      id: jobId, // Add string id for task handler compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: (jobDoc as any).input || {},
    }

    // Execute the task synchronously by calling the handler directly
    // Extract auth headers from request for downstream services
    const req = {
      payload,
      user,
      headers: {
        authorization: request.headers.get('authorization') ?? undefined,
        cookie: request.headers.get('cookie') ?? undefined,
      },
    }

    // Dynamic import to avoid ES module initialization order issues
    const { pdfToExercisesTask } = await import('@/server/payload/jobs/pdf-to-exercises-task')
    const { pdfToExercisesV2Task } = await import('@/server/payload/jobs/pdf-to-exercises-v2-task')

    // Determine which handler to use based on task slug
    const taskSlug = jobDoc.taskSlug
    if (taskSlug === 'pdf_to_exercises_v2') {
      // Call V2 handler synchronously
      await pdfToExercisesV2Task.handler({ job, req })
    } else {
      // Call V1 handler synchronously
      await pdfToExercisesTask.handler({ job, req })
    }

    // Update job status to completed
    await updateJobStatus(coll, jobId, 'completed', (job as JobDocument).output)

    log.info({ jobId }, '[run-immediately] Job completed successfully')

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job executed successfully',
    })
  } catch (error) {
    log.error({ err: error }, '[run-immediately] Error')

    // Try to update job status to failed if we can identify the job
    try {
      if (payload) {
        const coll = await getJobsCollection(payload)
        const { jobId } = await request.json().catch(() => ({}))

        if (jobId) {
          await updateJobStatus(coll, jobId, 'failed', { error: String(error) })
        }
      }
    } catch (updateError) {
      log.error({ err: updateError }, '[run-immediately] Failed to update job status')
    }

    return NextResponse.json(
      {
        error: `Failed to execute job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
