import { beforeEach, describe, expect, it } from 'vitest'

import { ACTIVITY_TEMPLATES } from '@/lib/study-plan/constants'
import { generateStudyPlan, getTimeframeMode } from '@/lib/study-plan/engine'
import type { TopicInput } from '@/lib/study-plan/types'

describe('study-plan engine', () => {
  describe('getTimeframeMode', () => {
    it('0 days → survival', () => {
      expect(getTimeframeMode(0)).toBe('survival')
    })

    it('1 day → survival', () => {
      expect(getTimeframeMode(1)).toBe('survival')
    })

    it('2 days → survival', () => {
      expect(getTimeframeMode(2)).toBe('survival')
    })

    it('3 days → high_intensity', () => {
      expect(getTimeframeMode(3)).toBe('high_intensity')
    })

    it('5 days → high_intensity', () => {
      expect(getTimeframeMode(5)).toBe('high_intensity')
    })

    it('6 days → balanced', () => {
      expect(getTimeframeMode(6)).toBe('balanced')
    })

    it('7 days → balanced', () => {
      expect(getTimeframeMode(7)).toBe('balanced')
    })

    it('8 days → mastery_cycle', () => {
      expect(getTimeframeMode(8)).toBe('mastery_cycle')
    })

    it('30 days → mastery_cycle', () => {
      expect(getTimeframeMode(30)).toBe('mastery_cycle')
    })
  })

  describe('generateStudyPlan', () => {
    let idCounter = 0
    const idGenerator = () => `id-${idCounter++}`

    beforeEach(() => {
      idCounter = 0
    })

    it('Determinism — identical inputs produce identical outputs', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-07', // 6 days left → balanced mode
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as const },
        ],
        idGenerator,
      }

      const result1 = generateStudyPlan(input)
      idCounter = 0 // Reset for second call
      const result2 = generateStudyPlan(input)

      expect(result1).toEqual(result2)
    })

    it('7 days — 1 topic (7+ days)', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-08', // 7 days left → balanced mode, generates 7 days
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('7 days — 3 topics (7+ days)', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-08', // 7 days left → balanced mode
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as const },
          { topicId: 't3', topicLabel: 'Topic 3', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('Adaptive days — 10+ days left → 7 days', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-20', // 19 days left, capped at 7
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as const },
          { topicId: 't3', topicLabel: 'Topic 3', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('Adaptive days — 3 days left → 3 days', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-04', // 3 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(3)
    })

    it('Adaptive days — 1 day left → 1 day', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-02', // 1 day left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(1)
    })

    it('Adaptive days — 0 days left (exam today) → 1 day', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-01', // 0 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(1)
    })

    it('Timeframe mode: survival — 0 days left → 1 warmup day', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-01', // 0 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(1)
      result.forEach((day) => {
        expect(day.activityType).toBe('warmup')
        expect(day.timeframeMode).toBe('survival')
      })
    })

    it('Timeframe mode: survival — 1 day left → 1 warmup day', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-02', // 1 day left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(1)
      result.forEach((day) => {
        expect(day.activityType).toBe('warmup')
        expect(day.timeframeMode).toBe('survival')
      })
    })

    it('Timeframe mode: survival — 2 days left → 2 warmup days', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-03', // 2 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(2)
      result.forEach((day) => {
        expect(day.activityType).toBe('warmup')
        expect(day.timeframeMode).toBe('survival')
      })
    })

    it('Timeframe mode: high_intensity — 3 days left', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-04', // 3 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      const expected = ACTIVITY_TEMPLATES.high_intensity
      result.forEach((day, idx) => {
        expect(day.activityType).toBe(expected[idx])
      })
    })

    it('Timeframe mode: balanced — 6 days left', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-07', // 6 days left → balanced mode
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      const expected = ACTIVITY_TEMPLATES.balanced
      result.forEach((day, idx) => {
        expect(day.activityType).toBe(expected[idx])
      })
    })

    it('Each day has timeframeMode and tasks fields', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-08', // 7 days left → balanced mode
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as const },
        ],
        idGenerator,
      }

      const result = generateStudyPlan(input)

      result.forEach((day) => {
        expect(day.timeframeMode).toBeDefined()
        expect(day.timeframeMode).toBe('balanced')
        expect(day.tasks).toBeDefined()
        expect(Array.isArray(day.tasks)).toBe(true)
        expect(day.tasks!.length).toBeGreaterThan(0)
      })
    })

    it('Fallback: no weak topics — all medium or strong', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-08', // 7 days left → balanced mode
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'medium' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      expect(() => generateStudyPlan(input)).not.toThrow()

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)

      // Non-simulation days should have topicIds
      result.forEach((day) => {
        if (day.activityType !== 'full_simulation') {
          expect(day.topicIds.length).toBeGreaterThan(0)
        }
      })
    })

    it('Fallback: all strong topics', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-08', // 7 days left → balanced mode
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'strong' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      expect(() => generateStudyPlan(input)).not.toThrow()

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('Hybrid 70/30 split — weak bucket gets more topics', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-07', // 6 days left → balanced mode
        topics: [
          { topicId: 'weak1', topicLabel: 'Weak 1', mastery: 'weak' as const },
          { topicId: 'weak2', topicLabel: 'Weak 2', mastery: 'weak' as const },
          { topicId: 'strong1', topicLabel: 'Strong 1', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      const result = generateStudyPlan(input)

      // Find hybrid days
      const hybridDays = result.filter((d) => d.activityType === 'hybrid')
      expect(hybridDays.length).toBeGreaterThan(0)

      // Check that at least one hybrid day has weak topics
      const weakTopics = ['weak1', 'weak2']
      const strongTopics = ['strong1']

      // At least one hybrid day should have weak topics
      const hasWeak = hybridDays.some((d) => d.topicIds.some((t) => weakTopics.includes(t)))
      expect(hasWeak).toBe(true)

      // Overall weak count should be >= strong count across all hybrid days
      let totalWeak = 0
      let totalStrong = 0
      hybridDays.forEach((d) => {
        totalWeak += d.topicIds.filter((t) => weakTopics.includes(t)).length
        totalStrong += d.topicIds.filter((t) => strongTopics.includes(t)).length
      })

      expect(totalWeak).toBeGreaterThanOrEqual(totalStrong)
    })

    it('Full simulation gets all topics', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-07', // 6 days left → balanced mode has full_simulation on day 5
        topics: [
          { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const },
          { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as const },
          { topicId: 't3', topicLabel: 'Topic 3', mastery: 'strong' as const },
        ],
        idGenerator,
      }

      const result = generateStudyPlan(input)

      // Find full_simulation day
      const simDay = result.find((d) => d.activityType === 'full_simulation')
      expect(simDay).toBeDefined()

      if (simDay) {
        const allTopicIds = input.topics.map((t) => t.topicId).sort()
        expect(simDay.topicIds.sort()).toEqual(allTopicIds)
      }
    })

    it('Consecutive dates — starting from today', () => {
      const input = {
        today: '2026-03-15',
        examDate: '2026-03-22', // 7 days left → balanced mode = 7 days
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)

      for (let i = 0; i < 7; i++) {
        const expectedDate = new Date('2026-03-15')
        expectedDate.setDate(expectedDate.getDate() + i)
        const expectedDateStr = expectedDate.toISOString().split('T')[0]

        expect(result[i].date).toBe(expectedDateStr)
      }
    })
  })
})
