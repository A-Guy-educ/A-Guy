import { ENV, HEARTBEAT_INTERVAL_MS, LOCK_TIMEOUT_MS } from '@/server/config/constants'
import { JOBS_COLLECTION } from '@/server/payload/jobs/constants'
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

// Payload's built-in jobs queue lives in the `payload-jobs` Mongo collection.
// Use the same proven access chain as JobService.fromPayload: the raw
// connection.collection() path works in deployed runtime; db.collections
// does not expose the jobs collection.
function getJobCollection(payload: Payload): Collection<JobDocument> {
  const db = payload.db as unknown as {
    connection?: { collection?: (name: string) => unknown }
    collections?: Record<string, unknown>
    collection?: (name: string) => unknown
  }
  const coll =
    db.connection?.collection?.(JOBS_COLLECTION) ||
    db.collections?.['payload-jobs'] ||
    db.collections?.jobs ||
    db.collection?.(JOBS_COLLECTION)
  if (!coll) {
    // DIAG-v4: surface the real deployed adapter shape so we stop guessing.
    const anyDb = db as unknown as Record<string, unknown>
    const conn = anyDb.connection as Record<string, unknown> | undefined
    const diag = {
      marker: 'DIAG-v4',
      dbKeys: Object.keys(anyDb || {}),
      connType: typeof anyDb.connection,
      connKeys: conn ? Object.keys(conn).slice(0, 25) : null,
      connCollectionType: typeof conn?.collection,
      connDbType: typeof (conn?.db as Record<string, unknown> | undefined),
      collectionsType: typeof anyDb.collections,
      collectionsKeys: anyDb.collections
        ? Object.keys(anyDb.collections as object).slice(0, 40)
        : null,
      dbCollectionFnType: typeof anyDb.collection,
    }
    throw new Error(`Cannot access Jobs collection :: ${JSON.stringify(diag)}`)
  }
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
