/**
 * @fileType type-test
 * @domain study-plan
 * @pattern type-safety
 * @ai-summary TypeScript type tests for new StudyPlanDay and TimeframeMode fields
 */
import { describe, expect, it } from 'vitest'

import type { StudyPlanDay, TimeframeMode } from '@/lib/study-plan/types'

describe('StudyPlanDay type definitions', () => {
  describe('TimeframeMode union includes mastery_cycle', () => {
    it('should accept mastery_cycle as valid TimeframeMode value', () => {
      // This test will FAIL at compile time until mastery_cycle is added to TimeframeMode
      const mode: TimeframeMode = 'mastery_cycle'
      expect(mode).toBe('mastery_cycle')
    })
  })

  describe('StudyPlanDay has tasks array field', () => {
    it('should accept StudyPlanDay with tasks array', () => {
      // This test will FAIL at compile time until tasks field is added to StudyPlanDay
      const day: StudyPlanDay = {
        dayId: 'day-1',
        date: '2026-03-01',
        activityType: 'practice',
        topicIds: ['topic-1', 'topic-2'],
        status: 'planned',
        estimatedDurationMinutes: 60,
        tasks: [
          { label: 'Review weak topics', description: 'Focus on areas with low mastery scores' },
          {
            label: 'Complete practice exercises',
            description: 'Solve 10 exercises from the practice set',
          },
        ],
      }

      expect(day.tasks).toHaveLength(2)
      expect(day.tasks![0].label).toBe('Review weak topics')
      expect(day.tasks![0].description).toBe('Focus on areas with low mastery scores')
    })

    it('should accept StudyPlanDay with empty tasks array', () => {
      const day: StudyPlanDay = {
        dayId: 'day-1',
        date: '2026-03-01',
        activityType: 'full_simulation',
        topicIds: [],
        status: 'planned',
        estimatedDurationMinutes: 120,
        tasks: [],
      }

      expect(day.tasks).toHaveLength(0)
    })
  })

  describe('StudyPlanDay has timeframeMode field', () => {
    it('should accept StudyPlanDay with timeframeMode field', () => {
      // This test will FAIL at compile time until timeframeMode field is added to StudyPlanDay
      const day: StudyPlanDay = {
        dayId: 'day-1',
        date: '2026-03-01',
        activityType: 'practice',
        topicIds: ['topic-1'],
        status: 'planned',
        estimatedDurationMinutes: 60,
        timeframeMode: 'balanced',
      }

      expect(day.timeframeMode).toBe('balanced')
    })

    it('should accept all TimeframeMode values in timeframeMode field', () => {
      const modes: TimeframeMode[] = ['survival', 'high_intensity', 'balanced', 'mastery_cycle']

      const day: StudyPlanDay = {
        dayId: 'day-1',
        date: '2026-03-01',
        activityType: 'practice',
        topicIds: ['topic-1'],
        status: 'planned',
        estimatedDurationMinutes: 60,
        timeframeMode: modes[3], // mastery_cycle
      }

      expect(day.timeframeMode).toBe('mastery_cycle')
    })
  })

  describe('StudyPlanDay with both new fields combined', () => {
    it('should accept StudyPlanDay with both tasks and timeframeMode', () => {
      const day: StudyPlanDay = {
        dayId: 'day-1',
        date: '2026-03-01',
        activityType: 'hybrid',
        topicIds: ['topic-1', 'topic-2', 'topic-3'],
        status: 'planned',
        estimatedDurationMinutes: 90,
        tasks: [
          { label: 'Warm-up drill', description: 'Quick review of key concepts' },
          { label: 'Main practice', description: 'Work through practice problems' },
          { label: 'Review solutions', description: 'Check answers and understand mistakes' },
        ],
        timeframeMode: 'high_intensity',
      }

      expect(day.tasks).toHaveLength(3)
      expect(day.timeframeMode).toBe('high_intensity')
    })
  })
})
