/**
 * Activity Logging Utility
 *
 * Helper to log user activities to UserStats collection
 */

import type { Payload } from 'payload'

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
  payload: Payload
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
      const currentLog = ((stats as any).activityLog as ActivityEntry[]) || []
      const updatedLog = [activityEntry, ...currentLog].slice(0, 50) // Keep max 50

      await payload.update({
        collection: 'user-stats',
        id: stats.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
        data: { activityLog: updatedLog } as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
        } as any,
        overrideAccess: true,
      })
    }
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
