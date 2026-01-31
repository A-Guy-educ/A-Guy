import { loadRuntimeConfig } from '@/infra/config/runtime/runtime-config'
import { LOCK_TIMEOUT_MS } from '@/server/config/constants'
import configPromise from '@payload-config'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

async function getJobsCollection(payloadInstance: Payload) {
  const db = payloadInstance.db as any
  // Payload 3.x: Use collections.jobs or collection('jobs')
  const coll =
    db.collections?.jobs || db.collection?.('jobs') || db.connection?.collection?.('payload-jobs')
  if (!coll) throw new Error('Cannot access Jobs collection')
  return coll
}

async function atomicClaimAndRunJob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coll: any,
  jobId: string,
) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coll: any,
  jobId: string,
  status: 'completed' | 'failed',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!user || (user as any).role !== 'admin') {
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

    console.log(`[run-immediately] Executing job ${jobId} synchronously`)

    // v2.1 Fix: Load runtime config before job execution
    // This ensures getExternalStorageUrl() works correctly when fetching PDFs
    console.log('[run-immediately] Loading runtime config...')
    await loadRuntimeConfig(payload)
    console.log('[run-immediately] Runtime config loaded')

    // Normalize job object: MongoDB returns _id (ObjectId), but task handler expects id (string)
    const job = {
      ...jobDoc,
      id: jobId, // Add string id for task handler compatibility
    }

    // Execute the task synchronously by calling the handler directly
    const req = {
      payload,
      user,
      headers: request.headers,
    }

    // Dynamic import to avoid ES module initialization order issues
    const { pdfToExercisesTask } = await import('@/server/payload/jobs/pdf-to-exercises-task')

    // Call the handler synchronously
    await pdfToExercisesTask.handler({ job, req })

    // Update job status to completed
    await updateJobStatus(coll, jobId, 'completed', job.output)

    console.log(`[run-immediately] Job ${jobId} completed successfully`)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job executed successfully',
    })
  } catch (error) {
    console.error('[run-immediately] Error:', error)

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
      console.error('[run-immediately] Failed to update job status:', updateError)
    }

    return NextResponse.json(
      {
        error: `Failed to execute job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
