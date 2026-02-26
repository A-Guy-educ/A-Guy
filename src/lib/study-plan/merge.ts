import { generateStudyPlan } from './engine'
import type { GeneratePlanInput, StudyPlanDay } from './types'

/**
 * Merge existing completed days with a newly generated plan.
 * Completed days are preserved unchanged, planned days are regenerated.
 */
export function mergeStudyPlan(
  existingDays: StudyPlanDay[],
  newInput: GeneratePlanInput,
): StudyPlanDay[] {
  // Generate fresh 7-day plan
  const freshDays = generateStudyPlan(newInput)

  // Build map of completed days by date
  const completedMap = new Map<string, StudyPlanDay>()
  for (const day of existingDays) {
    if (day.status === 'completed') {
      completedMap.set(day.date, day)
    }
  }

  // Merge: use completed day if exists, otherwise use fresh day
  return freshDays.map((freshDay) => {
    const completedDay = completedMap.get(freshDay.date)
    if (completedDay) {
      return completedDay
    }
    return freshDay
  })
}
