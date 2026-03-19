/**
 * Stats Activity API
 *
 * GET /api/stats/activity
 * Returns user's recent activity timeline
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const activityQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
})

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Parse query params
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '10', 10)

  const validation = activityQuerySchema.safeParse({ limit })
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid query params', details: validation.error.flatten() },
      { status: 400 },
    )
  }

  const { limit: validLimit } = validation.data

  // Fetch UserStats for the user
  const userStatsResult = await payload.find({
    collection: 'user-stats',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  const userStats = userStatsResult.docs[0]
  const activityLog = userStats?.activityLog || []

  // Sort by timestamp desc and limit
  const sortedActivities = [...activityLog]
    .sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return dateB - dateA
    })
    .slice(0, validLimit)

  // Map to response format
  const activities = sortedActivities.map((activity) => ({
    actionType: activity.actionType,
    label: activity.label,
    targetId: activity.targetId,
    targetCollection: activity.targetCollection,
    timestamp: activity.timestamp,
  }))

  return Response.json({
    activities,
  })
}
