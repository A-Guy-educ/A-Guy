import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

import {
  ACTIVITY_DURATIONS,
  ACTIVITY_TEMPLATES,
  MASTERY_WEIGHTS,
  MAX_TOPICS_PER_DAY,
  TASK_TEMPLATES,
} from './constants'
import type {
  ActivityType,
  GeneratePlanInput,
  MasteryLevel,
  StudyPlanDay,
  TimeframeMode,
  TopicInput,
} from './types'

/**
 * Determine timeframe mode based on days until exam.
 * - <= 2 days: survival
 * - 3-5 days: high_intensity
 * - 6-7 days: balanced
 * - >= 8 days: mastery_cycle
 */
export function getTimeframeMode(daysUntilExam: number): TimeframeMode {
  if (daysUntilExam <= 2) return 'survival'
  if (daysUntilExam <= 5) return 'high_intensity'
  if (daysUntilExam <= 7) return 'balanced'
  return 'mastery_cycle'
}

/**
 * Sort topics by priority: weak first, then medium, then strong.
 * Uses stable sort by topicId within same mastery level.
 */
export function sortTopicsByPriority(topics: TopicInput[]): TopicInput[] {
  const masteryOrder: Record<MasteryLevel, number> = {
    weak: 0,
    medium: 1,
    strong: 2,
  }

  return [...topics].sort((a, b) => {
    const orderDiff = masteryOrder[a.mastery] - masteryOrder[b.mastery]
    if (orderDiff !== 0) return orderDiff
    // Stable sort same mastery level
    return a.topicId.localeCompare(b.topicId)
  })
}

/**
 * Build a weighted topic cycle where each topic appears MA[mastery] times.
 * Order: weak topics firstSTERY_WEIGHTS (3x each), medium (2x each), strong (1x each).
 * Within same weight, topics are sorted by topicId for determinism.
 */
export function buildTopicCycle(topics: TopicInput[]): string[] {
  if (topics.length === 0) return []

  // Separate topics by mastery level with fallback rules
  const sortedTopics = sortTopicsByPriority(topics)

  // Build buckets with fallback
  const weakTopics = sortedTopics.filter((t) => t.mastery === 'weak')
  const mediumTopics = sortedTopics.filter((t) => t.mastery === 'medium')
  const strongTopics = sortedTopics.filter((t) => t.mastery === 'strong')

  // Apply fallback rules
  let primaryTopics = weakTopics
  if (primaryTopics.length === 0) {
    primaryTopics = mediumTopics.length > 0 ? mediumTopics : strongTopics
  }

  // Build cycle: weak (3x), medium (2x), strong (1x)
  const cycle: string[] = []

  // Add weak topics 3 times each
  const weakSorted = [...weakTopics].sort((a, b) => a.topicId.localeCompare(b.topicId))
  for (let i = 0; i < MASTERY_WEIGHTS.weak; i++) {
    for (const topic of weakSorted) {
      cycle.push(topic.topicId)
    }
  }

  // Add medium topics 2 times each
  const mediumSorted = [...mediumTopics].sort((a, b) => a.topicId.localeCompare(b.topicId))
  for (let i = 0; i < MASTERY_WEIGHTS.medium; i++) {
    for (const topic of mediumSorted) {
      cycle.push(topic.topicId)
    }
  }

  // Add strong topics 1 time each
  const strongSorted = [...strongTopics].sort((a, b) => a.topicId.localeCompare(b.topicId))
  for (const topic of strongSorted) {
    cycle.push(topic.topicId)
  }

  return cycle
}

/**
 * Pick topics for hybrid activity type using 70/30 weak/strong split.
 */
export function pickTopicsForHybrid(
  topics: TopicInput[],
  dayIndex: number,
  totalSlots: number,
): string[] {
  // Separate topics into weak and strong buckets (with fallback to medium)
  const sortedTopics = sortTopicsByPriority(topics)

  const weakTopics = sortedTopics.filter((t) => t.mastery === 'weak')
  const mediumTopics = sortedTopics.filter((t) => t.mastery === 'medium')
  const strongTopics = sortedTopics.filter((t) => t.mastery === 'strong')

  // Apply fallback rules
  let weakBucket = weakTopics
  let strongBucket = strongTopics

  // If no weak, use medium as primary (weak) bucket
  if (weakBucket.length === 0 && mediumTopics.length > 0) {
    weakBucket = mediumTopics
  }

  // If no strong, use medium as secondary bucket
  if (strongBucket.length === 0 && mediumTopics.length > 0) {
    strongBucket = mediumTopics
  }

  // Compute slots
  const weakSlots = Math.ceil(totalSlots * 0.7)
  const strongSlots = totalSlots - weakSlots

  // Build deterministic cycles for each bucket
  const weakCycle: string[] = []
  const strongCycle: string[] = []

  // Build weak cycle (topics sorted by topicId)
  const weakSorted = [...weakBucket].sort((a, b) => a.topicId.localeCompare(b.topicId))
  for (const topic of weakSorted) {
    for (let i = 0; i < MASTERY_WEIGHTS.weak; i++) {
      weakCycle.push(topic.topicId)
    }
  }

  // Build strong cycle (topics sorted by topicId)
  const strongSorted = [...strongBucket].sort((a, b) => a.topicId.localeCompare(b.topicId))
  for (const topic of strongSorted) {
    for (let i = 0; i < MASTERY_WEIGHTS.strong; i++) {
      strongCycle.push(topic.topicId)
    }
  }

  // Pick from cycles with dayIndex offset
  const selectedWeak: string[] = []
  const selectedStrong: string[] = []

  if (weakCycle.length > 0) {
    const weakOffset = (dayIndex * weakSlots) % weakCycle.length
    for (let i = 0; i < weakSlots; i++) {
      selectedWeak.push(weakCycle[(weakOffset + i) % weakCycle.length])
    }
  }

  if (strongCycle.length > 0) {
    const strongOffset = (dayIndex * strongSlots) % strongCycle.length
    for (let i = 0; i < strongSlots; i++) {
      selectedStrong.push(strongCycle[(strongOffset + i) % strongCycle.length])
    }
  }

  // Combine weak first, then strong, deduplicate while preserving order
  const combined = [...selectedWeak, ...selectedStrong]
  const seen = new Set<string>()
  return combined.filter((topicId) => {
    if (seen.has(topicId)) return false
    seen.add(topicId)
    return true
  })
}

/**
 * Pick topics for a specific day based on activity type.
 */
export function pickTopicsForDay(
  cycle: string[],
  dayIndex: number,
  activityType: ActivityType,
  allTopicIds: string[],
  topics: TopicInput[],
): string[] {
  // Full simulation gets all topics
  if (activityType === 'full_simulation') {
    return [...allTopicIds]
  }

  // Hybrid uses special 70/30 logic
  if (activityType === 'hybrid') {
    return pickTopicsForHybrid(topics, dayIndex, MAX_TOPICS_PER_DAY.hybrid)
  }

  // Other activity types use the cycle
  const maxTopics = MAX_TOPICS_PER_DAY[activityType]
  const offset = dayIndex * maxTopics

  const selected: string[] = []
  for (let i = 0; i < maxTopics; i++) {
    const cycleIndex = (offset + i) % cycle.length
    const topicId = cycle[cycleIndex]
    if (!selected.includes(topicId)) {
      selected.push(topicId)
    }
  }

  return selected
}

/**
 * Generate an adaptive study plan anchored to today.
 * The number of days generated is min(7, max(1, daysLeft)).
 * If exam is today (daysLeft <= 0), generates 1 warmup day.
 */
export function generateStudyPlan(input: GeneratePlanInput): StudyPlanDay[] {
  const { today, examDate, topics, idGenerator } = input

  // Calculate days until exam
  const todayDate = parseISO(today)
  const examDateObj = parseISO(examDate)
  const daysLeft = differenceInCalendarDays(examDateObj, todayDate)

  // Adaptive day count: min(7, max(1, daysLeft))
  // Special case: if exam is today or passed (daysLeft <= 0), generate 1 warmup day
  const dayCount = daysLeft <= 0 ? 1 : Math.min(7, Math.max(1, daysLeft))

  // Determine timeframe mode (only affects activity template)
  const mode = getTimeframeMode(daysLeft)
  const template = ACTIVITY_TEMPLATES[mode]

  // Build topic cycle
  const cycle = buildTopicCycle(topics)
  const allTopicIds = topics.map((t) => t.topicId)

  // Generate adaptive number of days anchored to today
  const days: StudyPlanDay[] = []
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const date = format(addDays(todayDate, dayIndex), 'yyyy-MM-dd')
    const activityType = template[dayIndex]
    const topicIds = pickTopicsForDay(cycle, dayIndex, activityType, allTopicIds, topics)

    // Get concrete tasks for this activity type
    const tasks = TASK_TEMPLATES[activityType] || []

    days.push({
      dayId: idGenerator(),
      date,
      activityType,
      topicIds,
      status: 'planned',
      estimatedDurationMinutes: ACTIVITY_DURATIONS[activityType],
      tasks,
      timeframeMode: mode,
    })
  }

  return days
}
