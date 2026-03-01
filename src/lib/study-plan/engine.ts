import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

import { ACTIVITY_DURATIONS, MASTERY_WEIGHTS, MAX_TOPICS_PER_DAY } from './constants'
import type {
  ActivityType,
  GeneratePlanInput,
  MasteryLevel,
  StudyPlanDay,
  TopicInput,
} from './types'

/**
 * Get activity type based on days until exam.
 * - 1 → warmup
 * - 2 → full_simulation
 * - 3-5 → hybrid (High Intensity)
 * - 6-7 → practice (Standard)
 */
export function getActivityForDaysUntilExam(daysUntilExam: number): ActivityType {
  if (daysUntilExam <= 1) return 'warmup'
  if (daysUntilExam === 2) return 'full_simulation'
  if (daysUntilExam <= 5) return 'hybrid'
  return 'practice'
}

/**
 * Generate task descriptions for a day based on activity type and topics.
 */
export function generateTaskDescriptions(
  activityType: ActivityType,
  topicLabels: string[],
): string[] {
  const tasks: string[] = []

  switch (activityType) {
    case 'warmup':
      // Warm-up: 1 Weak topic + formulas/key notes (no full simulation)
      if (topicLabels.length > 0) {
        tasks.push(`Learning: ${topicLabels[0]}`)
      }
      tasks.push('Review formulas and key notes')
      break

    case 'full_simulation':
      // Full simulation: Full simulation + mistake analysis (+ optional quick Weak drill)
      tasks.push('Full simulation practice')
      tasks.push('Mistake analysis')
      if (topicLabels.length > 0) {
        tasks.push(`Quick drill: ${topicLabels[0]}`)
      }
      break

    case 'hybrid':
      // High Intensity: Weak focus + targeted drills + optional mini simulation/question set
      topicLabels.forEach((label) => {
        tasks.push(`Drills: ${label}`)
      })
      // Add some variety
      tasks.push('Targeted practice on weak areas')
      break

    case 'practice':
      // Standard: Learning + Drills per topic
      topicLabels.forEach((label) => {
        tasks.push(`Learning: ${label}`)
        tasks.push(`Drills: ${label}`)
      })
      break

    case 'reinforcement':
      // Reinforcement: Focus on mistakes
      topicLabels.forEach((label) => {
        tasks.push(`Review: ${label}`)
      })
      tasks.push('Mistake log review')
      break
  }

  return tasks
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
 * Get topic labels from topic IDs
 */
function getTopicLabels(topicIds: string[], topics: TopicInput[]): string[] {
  return topicIds
    .map((id) => topics.find((t) => t.topicId === id)?.topicLabel)
    .filter((label): label is string => !!label)
}

/**
 * Generate study plan based on days until exam.
 * - Shows last 7 days before exam (not more)
 * - Each day has activity type based on its specific daysUntilExam value
 * - Returns empty array if exam date is in the past or today
 */
export function generateStudyPlan(input: GeneratePlanInput): StudyPlanDay[] {
  const { today, examDate, topics, idGenerator } = input

  // Parse dates
  const todayDate = parseISO(today)
  const examDateObj = parseISO(examDate)

  // Calculate days available until exam
  const daysAvailable = differenceInCalendarDays(examDateObj, todayDate)

  // If exam is today or in the past, return empty array
  if (daysAvailable <= 0) {
    return []
  }

  // Determine how many days to show (max 7)
  const planDaysCount = Math.min(7, daysAvailable)

  // Start from the last N days before exam
  const startDate = addDays(examDateObj, -planDaysCount)

  // Build topic cycle
  const cycle = buildTopicCycle(topics)
  const allTopicIds = topics.map((t) => t.topicId)

  // Generate days
  const days: StudyPlanDay[] = []
  for (let dayIndex = 0; dayIndex < planDaysCount; dayIndex++) {
    const dayDate = addDays(startDate, dayIndex)
    const date = format(dayDate, 'yyyy-MM-dd')

    // Calculate days until exam for THIS specific day
    const daysUntilExam = differenceInCalendarDays(examDateObj, dayDate)

    // Get activity type based on days until exam
    const activityType = getActivityForDaysUntilExam(daysUntilExam)

    // Pick topics for this day
    const topicIds = pickTopicsForDay(cycle, dayIndex, activityType, allTopicIds, topics)

    // Get topic labels for task descriptions
    const topicLabels = getTopicLabels(topicIds, topics)

    // Generate task descriptions
    const tasks = generateTaskDescriptions(activityType, topicLabels)

    days.push({
      dayId: idGenerator(),
      date,
      activityType,
      topicIds,
      status: 'planned',
      estimatedDurationMinutes: ACTIVITY_DURATIONS[activityType],
      tasks,
    })
  }

  return days
}
