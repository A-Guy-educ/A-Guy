/**
 * Exercise Generation Cron Worker
 *
 * Runs every minute via Vercel cron (see vercel.json). Picks up one
 * pending/running ExerciseGenerations record and processes as many exercises
 * as fit in the function's wall-clock budget. The orchestrator is resumable
 * — it streams output to the DB as exercises complete, so any exercise that
 * finishes before the function dies is durably saved. The next cron tick
 * picks up where this one left off.
 *
 * Auth: Vercel cron sends an `Authorization: Bearer <CRON_SECRET>` header.
 */
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logger } from '@/infra/utils/logger'
import {
  runExerciseGenerationOrchestrator,
  STUCK_FAILURE_CODE,
} from '@/server/services/exercise-generation/orchestrator'

export const maxDuration = 800

const HEADROOM_MS = 30_000

/** Lock window for an in-flight record claim. */
const CLAIM_LOCK_MS = (maxDuration + 60) * 1000

interface GenerationRecord {
  _id: ObjectId
  status?: string
  workerLockExpiresAt?: Date
  workerLockedAt?: Date
  claimAttempts?: number
  outputExercises?: unknown[]
}

async function claimNextRecord(payload: Payload): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coll = (payload.db as any).collections?.['exercise-generations']
  if (!coll) {
    logger.error(
      '[cron/process-exercise-generations] exercise-generations collection handle not found',
    )
    return null
  }

  const now = new Date()
  const lockUntil = new Date(now.getTime() + CLAIM_LOCK_MS)

  const result = await coll.findOneAndUpdate(
    {
      status: { $in: ['pending', 'running'] },
      $nor: [{ claimAttempts: { $gte: 5 } }],
      $or: [{ workerLockExpiresAt: { $exists: false } }, { workerLockExpiresAt: { $lt: now } }],
    },
    {
      $inc: { claimAttempts: 1 },
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

  const doc = (result as { value?: GenerationRecord } | GenerationRecord | null) ?? null
  const claimed =
    doc && typeof doc === 'object' && '_id' in doc
      ? (doc as GenerationRecord)
      : doc && 'value' in (doc as object)
        ? ((doc as { value?: GenerationRecord }).value ?? null)
        : null

  if (!claimed) return null
  return claimed._id.toString()
}

async function releaseLock(payload: Payload, generationId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coll = (payload.db as any).collections?.['exercise-generations']
    if (!coll) return
    await coll.updateOne(
      { _id: new ObjectId(generationId) },
      { $unset: { workerLockExpiresAt: '', workerLockedAt: '' } },
    )
  } catch (err) {
    logger.error(
      { err, generationId },
      '[cron/process-exercise-generations] Failed to release lock',
    )
  }
}

async function markStuckAndFailed(payload: Payload, generationId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coll = (payload.db as any).collections?.['exercise-generations']
    if (!coll) return
    await coll.updateOne({ _id: new ObjectId(generationId) }, {
      $set: { status: 'failed' },
      $push: {
        failures: {
          exerciseRef: '',
          sectionIndex: 0,
          code: STUCK_FAILURE_CODE,
          message:
            'Record was auto-failed after 5 consecutive cron ticks produced no new output exercises.',
          suggestedAction: 'skip',
          resolved: false,
        },
      },
    } as never)
    logger.warn(
      { generationId },
      '[cron/process-exercise-generations] Auto-failed stuck record after max attempts',
    )
  } catch (err) {
    logger.error(
      { err, generationId },
      '[cron/process-exercise-generations] Failed to mark record as stuck/failed',
    )
  }
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization') ?? ''
  const expectedHeader = `Bearer ${expected}`
  if (auth.length !== expectedHeader.length) return false
  return timingSafeEqual(Buffer.from(auth, 'utf8'), Buffer.from(expectedHeader, 'utf8'))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const deadlineMs = startedAt + (maxDuration * 1000 - HEADROOM_MS)

  let payload: Payload
  try {
    payload = await getPayload({ config: configPromise })
  } catch (err) {
    logger.error({ err }, '[cron/process-exercise-generations] getPayload failed')
    return NextResponse.json({ error: 'payload init failed' }, { status: 500 })
  }

  let generationId: string | null = null
  try {
    generationId = await claimNextRecord(payload)
  } catch (err) {
    logger.error({ err }, '[cron/process-exercise-generations] claim failed')
    return NextResponse.json({ error: 'claim failed' }, { status: 500 })
  }

  if (!generationId) {
    return NextResponse.json({ processed: 0, message: 'no records pending' })
  }

  // Re-read the claimed record to capture pre-orchestrator outputExercises.length
  const claimedRecord = await payload.findByID({
    collection: 'exercise-generations',
    id: generationId,
    depth: 0,
    overrideAccess: true,
  })
  const preTickOutputCount =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (claimedRecord as any).outputExercises?.length ?? 0

  // Auto-fail if we've now hit the threshold
  const currentAttempts =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (claimedRecord as any).claimAttempts ?? 1
  if (currentAttempts >= 5) {
    await markStuckAndFailed(payload, generationId)
    await releaseLock(payload, generationId)
    return NextResponse.json({
      generationId,
      outcome: 'failed',
      reason: STUCK_FAILURE_CODE,
      elapsedMs: Date.now() - startedAt,
    })
  }

  logger.info({ generationId }, '[cron/process-exercise-generations] claimed record')

  let outcome: string = 'in_progress'
  try {
    outcome = await runExerciseGenerationOrchestrator(generationId, payload, { deadlineMs })
  } catch (err) {
    logger.error({ err, generationId }, '[cron/process-exercise-generations] orchestrator threw')
    outcome = 'failed'
  } finally {
    await releaseLock(payload, generationId)
  }

  // Reset claimAttempts on any progress
  if (outcome !== 'failed') {
    const afterRecord = await payload.findByID({
      collection: 'exercise-generations',
      id: generationId,
      depth: 0,
      overrideAccess: true,
    })
    const postTickOutputCount =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (afterRecord as any).outputExercises?.length ?? 0
    if (postTickOutputCount > preTickOutputCount) {
      await payload.update({
        collection: 'exercise-generations',
        id: generationId,
        data: { claimAttempts: 0 } as never,
        overrideAccess: true,
      })
      logger.info(
        { generationId, preTickOutputCount, postTickOutputCount },
        '[cron/process-exercise-generations] Reset claimAttempts — progress detected',
      )
    }
  }

  return NextResponse.json({
    generationId,
    outcome,
    elapsedMs: Date.now() - startedAt,
  })
}
