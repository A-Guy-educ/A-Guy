/**
 * Stats Streak API
 *
 * POST /api/stats/streak
 * Updates user's daily streak based on activity
 */

import { getPayload } from 'payload'

import config from '@payload-config'

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getYesterdayDateString(): string {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id
  const today = getTodayDateString()
  const yesterday = getYesterdayDateString()

  // Find or create UserStats for user
  const existingStats = await payload.find({
    collection: 'user-stats',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  let statsId: string
  let currentStreak: number
  let longestStreak: number

  if (existingStats.docs.length > 0) {
    const stats = existingStats.docs[0]
    statsId = stats.id as string
    const lastActiveDate = stats.lastActiveDate

    // If already counted today, no-op (idempotent)
    if (lastActiveDate === today) {
      return Response.json({
        success: true,
        currentStreak: stats.currentStreak || 0,
        longestStreak: stats.longestStreak || 0,
      })
    }

    // Calculate new streak
    if (lastActiveDate === yesterday) {
      // Consecutive day - increment streak
      currentStreak = (stats.currentStreak || 0) + 1
    } else {
      // Gap in days - reset streak to 1
      currentStreak = 1
    }

    longestStreak = Math.max(stats.longestStreak || 0, currentStreak)

    // Update stats - use type assertion to bypass Payload type issues
    await payload.update({
      collection: 'user-stats',
      id: statsId,
      data: {
        currentStreak,
        longestStreak,
        lastActiveDate: today,
      },
      overrideAccess: true,
    } as never)
  } else {
    // First time - create new stats with streak = 1
    currentStreak = 1
    longestStreak = 1

    const created = (await payload.create({
      collection: 'user-stats',
      data: {
        user: userId,
        currentStreak,
        longestStreak,
        lastActiveDate: today,
        totalTimeSpentSeconds: 0,
      },
      overrideAccess: true,
    } as never)) as unknown as { id: string }
    statsId = created.id
  }

  return Response.json({
    success: true,
    currentStreak,
    longestStreak,
  })
}
