import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ObjectId } from 'mongodb'
import { LOCK_TIMEOUT_MS, HEARTBEAT_INTERVAL_MS, ENV } from '@/server/config/constants'
// v2.1 Fix 7: Import shared pure helpers for testability
import { atomicClaimJobQuery, atomicClaimJobUpdate } from '@/shared/exercise-conversion/helpers'

function getJobCollection(payload: any) {
  const db = payload.db as any
  const coll = db.collections?.jobs || db.collection?.('jobs')
  if (!coll) throw new Error(`Cannot access Jobs collection`)
  return {
    findOneAndUpdate: coll.findOneAndUpdate.bind(coll),
    updateOne: coll.updateOne.bind(coll),
  }
}

// v2.1 Fix 7: Use shared pure helpers for query/update
async function atomicClaimJob(coll: any): Promise<any> {
  const now = new Date()

  const result = await coll.findOneAndUpdate(
    atomicClaimJobQuery(now),
    atomicClaimJobUpdate(now, LOCK_TIMEOUT_MS),
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  )

  return result?.value || null
}

function heartbeatLoop(coll: any, mongoId: ObjectId): () => void {
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
      const result = await payload.jobs.run({ jobId })
      return NextResponse.json({
        success: true,
        processed: true,
        jobId,
        status: result.status,
        output: result.output,
      })
    } finally {
      stopHeartbeat()
    }
  } catch (error) {
    console.error('[Runner] Error:', error)
    return NextResponse.json({ error: 'Job execution failed' }, { status: 500 })
  }
}
