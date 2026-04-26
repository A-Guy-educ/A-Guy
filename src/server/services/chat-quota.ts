/**
 * Chat Quota Service
 *
 * @fileType service
 * @domain chat
 * @pattern rolling-window-quota
 * @ai-summary Checks and increments authenticated user chat quota (rolling window)
 */
import { ObjectId, type Collection, type Document } from 'mongodb'
import { getChatConfig } from '@/infra/llm/providers/shared/chat-config'
import { hoursToMs } from '@/infra/utils/time'
import type { Payload } from 'payload'

const QUOTA_DEFAULTS = { maxQuestions: 15, windowHours: 12 }

export interface ChatQuotaResult {
  allowed: boolean
  questionsUsed: number
  maxQuestions: number
  resetAt: string | null
}

async function getQuotaConfig() {
  try {
    const config = await getChatConfig()
    return { ...QUOTA_DEFAULTS, ...config.quota }
  } catch {
    return QUOTA_DEFAULTS
  }
}

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
 * Check if user has quota remaining and increment if so.
 * Uses a rolling window: if windowStart + windowHours has passed, reset the counter.
 * Uses atomic findOneAndUpdate to prevent race conditions.
 */
export async function checkAndIncrementChatQuota(
  payload: Payload,
  userId: string,
): Promise<ChatQuotaResult> {
  const { maxQuestions, windowHours } = await getQuotaConfig()
  const now = new Date()
  const windowMs = hoursToMs(windowHours)
  const cutoffDate = new Date(now.getTime() - windowMs) // time before which window is expired

  const collection = getUsersCollection(payload)

  // Fallback to non-atomic path if collection is unavailable
  if (!collection) {
    const user = await payload.findByID({ collection: 'users', id: userId })
    const windowStart = user?.chatWindowStart ? new Date(user.chatWindowStart) : null
    let questionsUsed = user?.chatQuestionsUsed ?? 0

    const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs
    if (windowExpired) {
      questionsUsed = 0
    }

    if (questionsUsed >= maxQuestions) {
      const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null
      return { allowed: false, questionsUsed, maxQuestions, resetAt }
    }

    const newWindowStart = windowExpired ? now.toISOString() : user?.chatWindowStart
    const newCount = questionsUsed + 1

    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        chatQuestionsUsed: newCount,
        chatWindowStart: newWindowStart,
      },
      overrideAccess: true,
    })

    const resetAt = newWindowStart
      ? new Date(new Date(newWindowStart).getTime() + windowMs).toISOString()
      : null

    return { allowed: true, questionsUsed: newCount, maxQuestions, resetAt }
  }

  // Try atomic increment (window still valid)
  let result = await collection.findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      chatWindowStart: { $gte: cutoffDate }, // window not expired
      chatQuestionsUsed: { $lt: maxQuestions },
    },
    { $inc: { chatQuestionsUsed: 1 } },
    { returnDocument: 'after' },
  )

  if (result) {
    const resetAt = new Date(new Date(result.chatWindowStart).getTime() + windowMs).toISOString()
    return { allowed: true, questionsUsed: result.chatQuestionsUsed, maxQuestions, resetAt }
  }

  // Window expired — try atomic reset to 1 (not increment from existing value)
  result = await collection.findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      chatWindowStart: { $lt: cutoffDate }, // window expired
    },
    { $set: { chatWindowStart: now, chatQuestionsUsed: 1 } },
    { returnDocument: 'after' },
  )

  if (result) {
    // New window started at `now`, one question consumed
    const resetAt = new Date(now.getTime() + windowMs).toISOString()
    return { allowed: true, questionsUsed: 1, maxQuestions, resetAt }
  }

  // Both atomics failed — user is at limit in a valid window (race)
  const fresh = await payload.findByID({ collection: 'users', id: userId })
  const windowStart = fresh?.chatWindowStart ? new Date(fresh.chatWindowStart) : null
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs
  const questionsUsed = windowExpired ? 0 : (fresh?.chatQuestionsUsed ?? 0)
  const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null

  return { allowed: questionsUsed < maxQuestions, questionsUsed, maxQuestions, resetAt }
}

/**
 * Get current quota status without incrementing.
 */
export async function getChatQuotaStatus(
  payload: Payload,
  userId: string,
): Promise<ChatQuotaResult> {
  const { maxQuestions, windowHours } = await getQuotaConfig()
  const now = new Date()

  const user = await payload.findByID({ collection: 'users', id: userId })
  const windowStart = user.chatWindowStart ? new Date(user.chatWindowStart) : null
  let questionsUsed = user.chatQuestionsUsed ?? 0

  const windowMs = hoursToMs(windowHours)
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    questionsUsed = 0
  }

  const resetAt =
    windowStart && !windowExpired ? new Date(windowStart.getTime() + windowMs).toISOString() : null

  return {
    allowed: questionsUsed < maxQuestions,
    questionsUsed,
    maxQuestions,
    resetAt,
  }
}
