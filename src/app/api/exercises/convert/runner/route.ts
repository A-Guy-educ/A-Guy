import { ENV, HEARTBEAT_INTERVAL_MS, LOCK_TIMEOUT_MS } from '@/server/config/constants'
import config from '@payload-config'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
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

// Payload's built-in jobs queue lives in the `payload-jobs` Mongo collection.
// Access it through the Mongoose connection (the proven pattern used across
// this codebase) rather than db.collections, which does not expose it.
function getJobCollection(payload: Payload): Collection<JobDocument> {
  const adapter = payload.db as MongooseAdapter
  const mongoDb = adapter.connection?.db
  const coll =
    mongoDb?.collection('payload-jobs') ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload.db as any).collections?.['payload-jobs']
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
