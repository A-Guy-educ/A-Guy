/**
 * Payment Quota Service
 *
 * @fileType service
 * @domain payments
 * @pattern rolling-window-quota
 * @ai-summary Enforces usage-based quotas for video/exam with rolling windows
 */

import { ObjectId, type Collection, type Document } from 'mongodb'
import { hoursToMs } from '@/infra/utils/time'
import type { Payload } from 'payload'

export type QuotaType = 'chat' | 'video' | 'exam'

// User type with payment fields for quota service
interface UserWithPaymentFields {
  id: string
  videoGenerationsUsed?: number
  videoGenerationsWindowStart?: string
  examCreationsUsed?: number
  examCreationsWindowStart?: string
  chatQuestionsUsed?: number
  chatWindowStart?: string
  subscriptionStatus?: 'none' | 'active' | 'expired' | 'cancelled' | 'failed'
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  courseEntitlements?: Array<{
    course: string | { id: string }
    grantMethod: 'admin' | 'payment' | 'code'
    grantedAt: string
    expiresAt?: string | null
  }>
}

export interface QuotaResult {
  allowed: boolean
  used: number
  max: number | null
  resetAt: string | null
  reason?: 'subscription_expired' | 'quota_exceeded' | 'window_expired'
}

// Default quotas (free tier)
const DEFAULT_VIDEO_QUOTA = 0
const DEFAULT_EXAM_QUOTA = 0

function getUsersCollection(payload: Payload): Collection<Document> | null {
  const db = payload.db as unknown as {
    connection?: { collection?: (name: string) => unknown }
    collections?: Record<string, unknown>
    collection?: (name: string) => unknown
  }

  const collection =
    db.connection?.collection?.('users') ||
    db.collections?.['users'] ||
    (db.collections as Record<string, unknown>)?.users ||
    db.collection?.('users') ||
    null

  return (collection as Collection<Document>) ?? null
}

/**
 * Check and increment video quota
 */
export async function checkAndIncrementVideoQuota(
  payload: Payload,
  userId: string,
): Promise<QuotaResult> {
  const now = new Date()
  const windowMs = hoursToMs(12) // 12 hour rolling window

  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as UserWithPaymentFields | null

  if (!user) {
    return { allowed: false, used: 0, max: 0, resetAt: null, reason: 'subscription_expired' }
  }

  // Check subscription status - if cancelled, access continues until period end
  if (
    user.subscriptionStatus === 'expired' ||
    (user.subscriptionStatus === 'cancelled' &&
      user.currentPeriodEnd &&
      new Date(user.currentPeriodEnd) < now)
  ) {
    return {
      allowed: false,
      used: user.videoGenerationsUsed || 0,
      max: DEFAULT_VIDEO_QUOTA,
      resetAt: null,
      reason: 'subscription_expired',
    }
  }

  // Get quota limit from active pricing plan (via course entitlements)
  const maxQuota = DEFAULT_VIDEO_QUOTA // Default free tier

  const windowStart = user.videoGenerationsWindowStart
    ? new Date(user.videoGenerationsWindowStart)
    : null
  let used = user.videoGenerationsUsed || 0

  // Check if window expired
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    used = 0
  }

  if (used >= maxQuota) {
    const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null
    return { allowed: false, used, max: maxQuota, resetAt, reason: 'quota_exceeded' }
  }

  // Increment quota
  const collection = getUsersCollection(payload)

  if (collection) {
    const cutoffDate = new Date(now.getTime() - windowMs)

    // Try atomic increment (window still valid)
    let result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        videoGenerationsWindowStart: { $gte: cutoffDate },
        $or: [
          { videoGenerationsUsed: { $lt: maxQuota } },
          { videoGenerationsUsed: { $exists: false } },
        ],
      },
      { $inc: { videoGenerationsUsed: 1 } },
      { returnDocument: 'after' },
    )

    if (result) {
      const resetAt = new Date(
        new Date(result.videoGenerationsWindowStart).getTime() + windowMs,
      ).toISOString()
      return {
        allowed: true,
        used: result.videoGenerationsUsed,
        max: maxQuota,
        resetAt,
      }
    }

    // Window expired - try reset to 1
    result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        $or: [
          { videoGenerationsWindowStart: { $lt: cutoffDate } },
          { videoGenerationsWindowStart: { $exists: false } },
        ],
      },
      { $set: { videoGenerationsWindowStart: now, videoGenerationsUsed: 1 } },
      { returnDocument: 'after' },
    )

    if (result) {
      const resetAt = new Date(now.getTime() + windowMs).toISOString()
      return { allowed: true, used: 1, max: maxQuota, resetAt }
    }
  }

  // Fallback: non-atomic increment
  const newWindowStart = windowExpired ? now.toISOString() : user.videoGenerationsWindowStart
  const newUsed = used + 1

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      videoGenerationsUsed: newUsed,
      videoGenerationsWindowStart: newWindowStart,
    },
    overrideAccess: true,
  })

  const resetAt = newWindowStart
    ? new Date(new Date(newWindowStart).getTime() + windowMs).toISOString()
    : null

  return { allowed: true, used: newUsed, max: maxQuota, resetAt }
}

/**
 * Check and increment exam creation quota
 */
export async function checkAndIncrementExamQuota(
  payload: Payload,
  userId: string,
): Promise<QuotaResult> {
  const now = new Date()
  const windowMs = hoursToMs(12) // 12 hour rolling window

  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as UserWithPaymentFields | null

  if (!user) {
    return { allowed: false, used: 0, max: 0, resetAt: null, reason: 'subscription_expired' }
  }

  // Check subscription status
  if (
    user.subscriptionStatus === 'expired' ||
    (user.subscriptionStatus === 'cancelled' &&
      user.currentPeriodEnd &&
      new Date(user.currentPeriodEnd) < now)
  ) {
    return {
      allowed: false,
      used: user.examCreationsUsed || 0,
      max: DEFAULT_EXAM_QUOTA,
      resetAt: null,
      reason: 'subscription_expired',
    }
  }

  const maxQuota = DEFAULT_EXAM_QUOTA // Default free tier

  const windowStart = user.examCreationsWindowStart ? new Date(user.examCreationsWindowStart) : null
  let used = user.examCreationsUsed || 0

  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    used = 0
  }

  if (used >= maxQuota) {
    const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null
    return { allowed: false, used, max: maxQuota, resetAt, reason: 'quota_exceeded' }
  }

  // Increment quota
  const collection = getUsersCollection(payload)

  if (collection) {
    const cutoffDate = new Date(now.getTime() - windowMs)

    let result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        examCreationsWindowStart: { $gte: cutoffDate },
        $or: [{ examCreationsUsed: { $lt: maxQuota } }, { examCreationsUsed: { $exists: false } }],
      },
      { $inc: { examCreationsUsed: 1 } },
      { returnDocument: 'after' },
    )

    if (result) {
      const resetAt = new Date(
        new Date(result.examCreationsWindowStart).getTime() + windowMs,
      ).toISOString()
      return {
        allowed: true,
        used: result.examCreationsUsed,
        max: maxQuota,
        resetAt,
      }
    }

    result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        $or: [
          { examCreationsWindowStart: { $lt: cutoffDate } },
          { examCreationsWindowStart: { $exists: false } },
        ],
      },
      { $set: { examCreationsWindowStart: now, examCreationsUsed: 1 } },
      { returnDocument: 'after' },
    )

    if (result) {
      const resetAt = new Date(now.getTime() + windowMs).toISOString()
      return { allowed: true, used: 1, max: maxQuota, resetAt }
    }
  }

  // Fallback
  const newWindowStart = windowExpired ? now.toISOString() : user.examCreationsWindowStart
  const newUsed = used + 1

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      examCreationsUsed: newUsed,
      examCreationsWindowStart: newWindowStart,
    },
    overrideAccess: true,
  })

  const resetAt = newWindowStart
    ? new Date(new Date(newWindowStart).getTime() + windowMs).toISOString()
    : null

  return { allowed: true, used: newUsed, max: maxQuota, resetAt }
}

/**
 * Get quota status without incrementing
 */
export async function getQuotaStatus(
  payload: Payload,
  userId: string,
  quotaType: QuotaType,
): Promise<QuotaResult> {
  const now = new Date()
  const windowMs = hoursToMs(12)

  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as UserWithPaymentFields | null

  if (!user) {
    return { allowed: false, used: 0, max: 0, resetAt: null, reason: 'subscription_expired' }
  }

  // Check subscription status
  if (
    user.subscriptionStatus === 'expired' ||
    (user.subscriptionStatus === 'cancelled' &&
      user.currentPeriodEnd &&
      new Date(user.currentPeriodEnd) < now)
  ) {
    return {
      allowed: false,
      used: 0,
      max: 0,
      resetAt: null,
      reason: 'subscription_expired',
    }
  }

  let used: number
  let windowStart: Date | null
  let max: number | null

  switch (quotaType) {
    case 'chat':
      used = user.chatQuestionsUsed || 0
      windowStart = user.chatWindowStart ? new Date(user.chatWindowStart) : null
      max = 15 // Free tier
      break
    case 'video':
      used = user.videoGenerationsUsed || 0
      windowStart = user.videoGenerationsWindowStart
        ? new Date(user.videoGenerationsWindowStart)
        : null
      max = DEFAULT_VIDEO_QUOTA
      break
    case 'exam':
      used = user.examCreationsUsed || 0
      windowStart = user.examCreationsWindowStart ? new Date(user.examCreationsWindowStart) : null
      max = DEFAULT_EXAM_QUOTA
      break
  }

  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    used = 0
  }

  const resetAt =
    windowStart && !windowExpired ? new Date(windowStart.getTime() + windowMs).toISOString() : null

  return {
    allowed: used < (max || 0),
    used,
    max,
    resetAt,
  }
}
