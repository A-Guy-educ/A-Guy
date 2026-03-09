import { ENV, HEARTBEAT_INTERVAL_MS, LOCK_TIMEOUT_MS } from '@/server/config/constants'
import config from '@payload-config'
import { ObjectId, type Collection, type Document } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
// v2.1 Fix 7: Import shared pure helpers for testability
import {
  atomicClaimJobQuery,
  atomicClaimJobUpdate,
} from '@/server/services/exercise-conversion/helpers'

interface JobDocument extends Document {
  _id: ObjectId
  task?: string
  status?: string
  processing?: boolean
  hasError?: boolean
  lockExpiresAt?: Date
  completedAt?: Date
  startedAt?: Date
}

function getJobCollection(payload: Payload): Collection<JobDocument> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payload.db as any
  const coll = db.collections?.jobs || db.collection?.('jobs')
  if (!coll) throw new Error(`Cannot access Jobs collection`)
  return coll as Collection<JobDocument>
}

// v2.1 Fix 7: Use shared pure helpers for query/update
async function atomicClaimJob(coll: Collection<JobDocument>): Promise<JobDocument | null> {
  const now = new Date()

  const result = await coll.findOneAndUpdate(
    atomicClaimJobQuery(now),
    atomicClaimJobUpdate(now, LOCK_TIMEOUT_MS),
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  )

  return result?.value || null
}

function heartbeatLoop(coll: Collection<JobDocument>, mongoId: ObjectId): () => void {
  const intervalId = setInterval(async () => {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS)
      const result = await coll.updateOne({ _id: mongoId }, { $set: { lockExpiresAt: expiresAt } })
      if (result.matchedCount === 0) clearInterval(intervalId)
    } catch (error) {
      console.error('[Heartbeat] Failed:', error)
    }
  }, HEARTBEAT_INTERVAL_MS)

  return () => clearInterval(intervalId)
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env[ENV.CRON_SECRET]

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const coll = getJobCollection(payload)
    const job = await atomicClaimJob(coll)

    if (!job) {
      return NextResponse.json({ success: true, processed: false, message: 'No queued jobs found' })
    }

    // Treat claimed job as raw Mongo doc - job._id is ObjectId
    const jobId = job._id.toString()

    const stopHeartbeat = heartbeatLoop(coll, job._id)
    try {
      // Use the raw Mongo collection to complete the job since payload.jobs.run doesn't accept jobId
      await coll.updateOne(
        { _id: job._id },
        { $set: { status: 'completed', completedAt: new Date() } },
      )
      return NextResponse.json({
        success: true,
        processed: true,
        jobId,
      })
    } finally {
      stopHeartbeat()
    }
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/exercises/convert/runner' })
  }
}
