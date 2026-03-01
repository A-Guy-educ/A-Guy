import type { StudyPlanDay } from './types'

/**
 * Merge completion status from old plan to new plan based on topic IDs.
 *
 * If all topics in a new day were completed in the old plan,
 * the new day inherits the 'completed' status.
 *
 * Partial overlap does NOT inherit completion.
 */
export function mergeCompletionByTopic(
  oldDays: StudyPlanDay[],
  newDays: StudyPlanDay[],
): StudyPlanDay[] {
  // Build a Set of topic IDs that were completed in the old plan
  const completedTopicIds = new Set<string>()

  for (const oldDay of oldDays) {
    if (oldDay.status === 'completed') {
      for (const topicId of oldDay.topicIds) {
        completedTopicIds.add(topicId)
      }
    }
  }

  // If no completed topics, return new days as-is
  if (completedTopicIds.size === 0) {
    return newDays
  }

  // For each new day: if ALL of its topicIds were previously completed,
  // mark the new day as completed
  return newDays.map((newDay) => {
    if (newDay.status === 'completed') {
      // Already completed, keep as-is
      return newDay
    }

    // Check if all topics in this day were completed
    const allTopicsCompleted = newDay.topicIds.every((topicId) => completedTopicIds.has(topicId))

    if (allTopicsCompleted && newDay.topicIds.length > 0) {
      return {
        ...newDay,
        status: 'completed',
      }
    }

    return newDay
  })
}
