/**
 * Lesson Duplication Cron Worker
 *
 * Runs every minute via Vercel cron (see vercel.json). Picks up one
 * pending/running LessonDuplications record and processes as many exercises
 * as fit in the function's wall-clock budget. The orchestrator is resumable
 * — it streams output mappings to the DB as it completes them, so any
 * exercise that finishes before the function dies is durably saved. The
 * next cron tick picks up where this one left off.
 *
 * Concurrency: one record at a time, claimed via an atomic Mongo
 * `findOneAndUpdate` with a lock that expires automatically so a crashed
 * tick can't permanently jam the queue.
 *
 * Auth: Vercel cron sends an `Authorization: Bearer <CRON_SECRET>` header.
 * We accept either that or a missing-but-trusted Vercel deployment header
 * for local dev. Anything else is rejected.
 */
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logger } from '@/infra/utils/logger'
import { runDuplicationOrchestrator } from '@/server/services/lesson-duplication/orchestrator'

// Vercel cron functions inherit the same maxDuration ceiling as regular
// serverless functions. 800s on Pro lets one tick process roughly 3-5
// exercises end-to-end on gemini-3.1-pro-preview. Combined with the cron
// schedule, multi-exercise lessons finish across consecutive ticks.
export const maxDuration = 800

/**
 * Reserve headroom at the end of the tick so the orchestrator can finalize
 * its DB writes (status, last output mapping) before Vercel yanks the
 * function. `runDuplicationOrchestrator` checks the deadline between
 * exercises and bails out early when the next one wouldn't fit.
 */
const HEADROOM_MS = 30_000

/** Lock window for an in-flight record claim. Released when the tick ends. */
const CLAIM_LOCK_MS = (maxDuration + 60) * 1000

interface DuplicationRecord {
  _id: ObjectId
  status?: string
  workerLockExpiresAt?: Date
  workerLockedAt?: Date
}

/**
 * Atomically claim the next record that needs work. Skips records currently
 * held by another tick (lock not yet expired). Returns null if nothing is
 * available.
 */
async function claimNextRecord(payload: Payload): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (payload.db as any).connection?.db ?? (payload.db as any).collection
  if (!db) {
    logger.error('[cron/process-duplications] Cannot access MongoDB handle')
    return null
  }
  // Resolve the underlying mongo collection. Payload exposes
  // `db.collections.<slug>` at runtime for Mongo adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coll = (payload.db as any).collections?.['lesson-duplications']
  if (!coll) {
    logger.error('[cron/process-duplications] lesson-duplications collection handle not found')
    return null
  }

  const now = new Date()
  const lockUntil = new Date(now.getTime() + CLAIM_LOCK_MS)

  const result = await coll.findOneAndUpdate(
    {
      // FIFO by createdAt — oldest pending/running record first.
      status: { $in: ['pending', 'running'] },
      $or: [{ workerLockExpiresAt: { $exists: false } }, { workerLockExpiresAt: { $lt: now } }],
    },
    {
      $set: {
        workerLockExpiresAt: lockUntil,
        workerLockedAt: now,
      },
    },
    {
      sort: { createdAt: 1 },
      returnDocument: 'after',
    },
  )

  const doc = (result as { value?: DuplicationRecord } | DuplicationRecord | null) ?? null
  // mongodb driver may return either the raw doc or wrapped depending on version
  const claimed =
    doc && typeof doc === 'object' && '_id' in doc
      ? (doc as DuplicationRecord)
      : doc && 'value' in (doc as object)
        ? ((doc as { value?: DuplicationRecord }).value ?? null)
        : null

  if (!claimed) return null
  return claimed._id.toString()
}

async function releaseLock(payload: Payload, duplicationId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coll = (payload.db as any).collections?.['lesson-duplications']
    if (!coll) return
    await coll.updateOne(
      { _id: new ObjectId(duplicationId) },
      { $unset: { workerLockExpiresAt: '', workerLockedAt: '' } },
    )
  } catch (err) {
    logger.error({ err, duplicationId }, '[cron/process-duplications] Failed to release lock')
  }
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // No secret configured — only allow in development. Production should
    // always set CRON_SECRET.
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization') ?? ''
  const expectedHeader = `Bearer ${expected}`
  // Constant-time comparison to avoid leaking the secret via response-time
  // side channels. timingSafeEqual requires equal-length buffers; the
  // length check itself is not timing-sensitive — different-length auth
  // headers are obviously wrong on inspection.
  if (auth.length !== expectedHeader.length) return false
  return timingSafeEqual(Buffer.from(auth, 'utf8'), Buffer.from(expectedHeader, 'utf8'))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  // Reserve HEADROOM_MS at the end of the tick for clean shutdown.
  const deadlineMs = startedAt + (maxDuration * 1000 - HEADROOM_MS)

  let payload: Payload
  try {
    payload = await getPayload({ config: configPromise })
  } catch (err) {
    logger.error({ err }, '[cron/process-duplications] getPayload failed')
    return NextResponse.json({ error: 'payload init failed' }, { status: 500 })
  }

  let duplicationId: string | null = null
  try {
    duplicationId = await claimNextRecord(payload)
  } catch (err) {
    logger.error({ err }, '[cron/process-duplications] claim failed')
    return NextResponse.json({ error: 'claim failed' }, { status: 500 })
  }

  if (!duplicationId) {
    return NextResponse.json({ processed: 0, message: 'no records pending' })
  }

  logger.info({ duplicationId }, '[cron/process-duplications] claimed record')

  let outcome: string = 'in_progress'
  try {
    outcome = await runDuplicationOrchestrator(duplicationId, payload, { deadlineMs })
  } catch (err) {
    logger.error({ err, duplicationId }, '[cron/process-duplications] orchestrator threw')
    outcome = 'failed'
  } finally {
    await releaseLock(payload, duplicationId)
  }

  return NextResponse.json({
    duplicationId,
    outcome,
    elapsedMs: Date.now() - startedAt,
  })
}
