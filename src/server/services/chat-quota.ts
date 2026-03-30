/**
 * Chat Quota Service
 *
 * @fileType service
 * @domain chat
 * @pattern rolling-window-quota
 * @ai-summary Checks and increments authenticated user chat quota (rolling window)
 */
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

/**
 * Check if user has quota remaining and increment if so.
 * Uses a rolling window: if windowStart + windowHours has passed, reset the counter.
 */
export async function checkAndIncrementChatQuota(
  payload: Payload,
  userId: string,
): Promise<ChatQuotaResult> {
  const { maxQuestions, windowHours } = await getQuotaConfig()
  const now = new Date()

  const user = await payload.findByID({ collection: 'users', id: userId })
  const windowStart = user.chatWindowStart ? new Date(user.chatWindowStart) : null
  let questionsUsed = user.chatQuestionsUsed ?? 0

  // If no window or window expired, start fresh
  const windowMs = hoursToMs(windowHours)
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() > windowMs

  if (windowExpired) {
    questionsUsed = 0
  }

  // Check limit
  if (questionsUsed >= maxQuestions) {
    const resetAt = windowStart ? new Date(windowStart.getTime() + windowMs).toISOString() : null
    return { allowed: false, questionsUsed, maxQuestions, resetAt }
  }

  // Increment
  const newWindowStart = windowExpired ? now.toISOString() : user.chatWindowStart
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
