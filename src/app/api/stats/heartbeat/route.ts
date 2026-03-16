/**
 * Stats Heartbeat API
 *
 * POST /api/stats/heartbeat
 * Increments user's total time spent
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const heartbeatSchema = z.object({
  seconds: z.number().min(30).max(60),
})

export async function POST(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = heartbeatSchema.safeParse(body)

  if (!validation.success) {
    return Response.json(
      { error: 'Invalid request', details: validation.error.flatten() },
      { status: 400 },
    )
  }

  const { seconds } = validation.data

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

  if (existingStats.docs.length > 0) {
    // Update existing stats - use type assertion to bypass Payload type issues
    const updated = (await payload.update({
      collection: 'user-stats',
      id: existingStats.docs[0].id,
      data: {
        totalTimeSpentSeconds: (existingStats.docs[0].totalTimeSpentSeconds || 0) + seconds,
        lastHeartbeatAt: new Date().toISOString(),
      },
      overrideAccess: true,
    } as never)) as unknown as { id: string }
    statsId = updated.id
  } else {
    // Create new stats - use type assertion to bypass Payload type issues
    const created = await payload.create({
      collection: 'user-stats',
      data: {
        user: userId,
        totalTimeSpentSeconds: seconds,
        lastHeartbeatAt: new Date().toISOString(),
        currentStreak: 0,
        longestStreak: 0,
      },
      overrideAccess: true,
    } as never)
    statsId = created.id as string
  }

  // Fetch updated stats to return current total
  const updatedStats = (await payload.findByID({
    collection: 'user-stats',
    id: statsId,
    overrideAccess: true,
  } as never)) as unknown as {
    totalTimeSpentSeconds: number
  }

  return Response.json({
    success: true,
    totalTimeSpentSeconds: updatedStats.totalTimeSpentSeconds,
  })
}
