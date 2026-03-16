/**
 * Activity Logging Utility
 *
 * Helper to log user activities to UserStats collection
 */

interface ActivityEntry {
  actionType:
    | 'lesson_completed'
    | 'exercise_attempted'
    | 'exercise_completed'
    | 'question_asked'
    | 'conversation_started'
  label: string
  targetId: string
  targetCollection: string
  timestamp: string
}

interface LogActivityParams {
  payload: {
    find: (options: {
      collection: string
      where: Record<string, unknown>
      limit?: number
      overrideAccess?: boolean
    }) => Promise<{ docs: Array<{ id: string; activityLog?: ActivityEntry[] }> }>
    update: (options: {
      collection: string
      id: string
      data: Record<string, unknown>
      overrideAccess?: boolean
    }) => Promise<{ id: string | unknown }>
    create: (options: {
      collection: string
      data: Record<string, unknown>
      overrideAccess?: boolean
    }) => Promise<{ id: string | unknown }>
  }
  userId: string
  actionType: ActivityEntry['actionType']
  label: string
  targetId: string
  targetCollection: string
}

export async function logActivity({
  payload,
  userId,
  actionType,
  label,
  targetId,
  targetCollection,
}: LogActivityParams): Promise<void> {
  const activityEntry: ActivityEntry = {
    actionType,
    label,
    targetId,
    targetCollection,
    timestamp: new Date().toISOString(),
  }

  try {
    const userStatsResult = await payload.find({
      collection: 'user-stats',
      where: { user: { equals: userId } },
      limit: 1,
      overrideAccess: true,
    })

    if (userStatsResult.docs.length > 0) {
      const stats = userStatsResult.docs[0]
      const currentLog = (stats.activityLog as ActivityEntry[]) || []
      const updatedLog = [activityEntry, ...currentLog].slice(0, 50) // Keep max 50

      await payload.update({
        collection: 'user-stats',
        id: stats.id,
        data: { activityLog: updatedLog },
        overrideAccess: true,
      })
    } else {
      // Create new UserStats with activity
      await payload.create({
        collection: 'user-stats',
        data: {
          user: userId,
          activityLog: [activityEntry],
          totalTimeSpentSeconds: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
