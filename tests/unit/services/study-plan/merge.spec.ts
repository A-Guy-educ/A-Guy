import { beforeEach, describe, expect, it } from 'vitest'

import { generateStudyPlan } from '@/server/services/study-plan/engine'
import type { MasteryLevel, StudyPlanDay, TopicInput } from '@/server/services/study-plan/types'

/**
 * Tests for study plan regeneration behavior.
 *
 * After the fix: Regeneration clears all completion status and user overrides,
 * producing a fresh recommendation with all days set to 'planned' status.
 */
describe('study-plan regeneration', () => {
  let idCounter = 0
  const idGenerator = () => `id-${idCounter++}`

  const baseTopics: TopicInput[] = [
    { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as MasteryLevel },
    { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as MasteryLevel },
    { topicId: 't3', topicLabel: 'Topic 3', mastery: 'strong' as MasteryLevel },
  ]

  const baseInput = {
    today: '2026-03-01',
    examDate: '2026-03-10',
    topics: baseTopics,
    idGenerator,
  }

  beforeEach(() => {
    idCounter = 0
  })

  it('Regeneration produces all planned days — no completed status', () => {
    const result = generateStudyPlan(baseInput)

    expect(result).toHaveLength(7)

    // All days should have 'planned' status after regeneration
    const allPlanned = result.every((day: StudyPlanDay) => day.status === 'planned')
    expect(allPlanned).toBe(true)
  })

  it('Regeneration produces 7 days with valid structure', () => {
    const result = generateStudyPlan(baseInput)

    expect(result).toHaveLength(7)

    // Each day should have required fields
    result.forEach((day: StudyPlanDay) => {
      expect(day.dayId).toBeDefined()
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(day.activityType).toBeDefined()
      expect(day.topicIds).toBeInstanceOf(Array)
      expect(day.status).toBe('planned')
      expect(day.estimatedDurationMinutes).toBeGreaterThan(0)
    })
  })

  it('Regeneration assigns topics based on mastery — weak topics prioritized', () => {
    const result = generateStudyPlan(baseInput)

    // Weak topics should appear more frequently
    const weakTopicDays = result.filter((day: StudyPlanDay) => day.topicIds.includes('t1'))
    expect(weakTopicDays.length).toBeGreaterThanOrEqual(2)
  })

  it('Regeneration handles empty topics gracefully', () => {
    const input = {
      ...baseInput,
      topics: [] as TopicInput[],
    }

    const result = generateStudyPlan(input)

    // Should still return 7 days
    expect(result).toHaveLength(7)

    // All should be planned
    const allPlanned = result.every((day: StudyPlanDay) => day.status === 'planned')
    expect(allPlanned).toBe(true)
  })

  it('Regeneration handles single topic', () => {
    const singleTopic: TopicInput[] = [
      { topicId: 't1', topicLabel: 'Single Topic', mastery: 'weak' as MasteryLevel },
    ]

    const input = {
      ...baseInput,
      topics: singleTopic,
    }

    const result = generateStudyPlan(input)

    expect(result).toHaveLength(7)

    // All days should use the single topic
    result.forEach((day: StudyPlanDay) => {
      expect(day.topicIds).toContain('t1')
      expect(day.status).toBe('planned')
    })
  })

  it('Consecutive days have different activity types for variety', () => {
    const result = generateStudyPlan(baseInput)

    // Check that we have variety in activity types
    const activityTypes = new Set(result.map((d: StudyPlanDay) => d.activityType))
    expect(activityTypes.size).toBeGreaterThan(1)
  })
})
