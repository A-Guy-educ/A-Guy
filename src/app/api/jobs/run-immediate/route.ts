import { LOCK_TIMEOUT_MS } from '@/server/config/constants'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

async function getJobsCollection(payload: any) {
  const db = payload.db as any
  // Use direct MongoDB access like status API does
  const coll = db.connection?.collection?.('payload-jobs')
  if (!coll) throw new Error('Cannot access Jobs collection')
  return coll
}

async function atomicClaimAndRunJob(coll: any, jobId: string) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS)

  // Atomic claim and update processing to true
  // Include all jobs except 'processing: true' and 'hasError: true'
  const job = await coll.findOneAndUpdate(
    {
      _id: new ObjectId(jobId),
      processing: { $ne: true },
      hasError: { $ne: true },
      $or: [
        { lockExpiresAt: { $exists: false } },
        { lockExpiresAt: { $lt: now } },
      ],
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

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Admin-only access
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 })
    }

    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const coll = await getJobsCollection(payload)
    const job = await atomicClaimAndRunJob(coll, jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found, already running, or already completed' }, { status: 404 })
    }

    // Trigger the actual job task using payload.jobs.run
    await payload.jobs.run({
      id: jobId,
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job execution triggered successfully',
    })
  } catch (error) {
    console.error('[run-immediate] Error:', error)
    return NextResponse.json({ error: 'Failed to trigger job execution' }, { status: 500 })
  }
}
