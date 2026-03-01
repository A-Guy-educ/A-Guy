import { beforeEach, describe, expect, it } from 'vitest'

import { generateStudyPlan, getActivityForDaysUntilExam } from '@/lib/study-plan/engine'
import type { TopicInput } from '@/lib/study-plan/types'

describe('study-plan engine', () => {
  describe('getActivityForDaysUntilExam', () => {
    it('0 days → warmup', () => {
      expect(getActivityForDaysUntilExam(0)).toBe('warmup')
    })

    it('1 day → warmup', () => {
      expect(getActivityForDaysUntilExam(1)).toBe('warmup')
    })

    it('2 days → full_simulation', () => {
      expect(getActivityForDaysUntilExam(2)).toBe('full_simulation')
    })

    it('3 days → hybrid', () => {
      expect(getActivityForDaysUntilExam(3)).toBe('hybrid')
    })

    it('4 days → hybrid', () => {
      expect(getActivityForDaysUntilExam(4)).toBe('hybrid')
    })

    it('5 days → hybrid', () => {
      expect(getActivityForDaysUntilExam(5)).toBe('hybrid')
    })

    it('6 days → practice', () => {
      expect(getActivityForDaysUntilExam(6)).toBe('practice')
    })

    it('7 days → practice', () => {
      expect(getActivityForDaysUntilExam(7)).toBe('practice')
    })

    it('30 days → practice', () => {
      expect(getActivityForDaysUntilExam(30)).toBe('practice')
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
        examDate: '2026-03-20',
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

    it('Always 7 days — 1 topic', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-20',
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('Always 7 days — 3 topics', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-20',
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

    it('Always 7 days — 10 topics', () => {
      const topics: TopicInput[] = Array.from({ length: 10 }, (_, i) => ({
        topicId: `t${i}`,
        topicLabel: `Topic ${i}`,
        mastery: (['weak', 'medium', 'strong'] as const)[i % 3],
      }))

      const input = {
        today: '2026-03-01',
        examDate: '2026-03-20',
        topics,
        idGenerator,
      }

      const result = generateStudyPlan(input)
      expect(result).toHaveLength(7)
    })

    it('Timeframe mode: survival — 0 days left', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-01', // 0 days left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      result.forEach((day) => {
        expect(day.activityType).toBe('warmup')
      })
    })

    it('Timeframe mode: survival — 1 day left', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-02', // 1 day left
        topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
        idGenerator,
      }

      const result = generateStudyPlan(input)
      result.forEach((day) => {
        expect(day.activityType).toBe('warmup')
      })
    })

    it('Fallback: no weak topics — all medium or strong', () => {
      const input = {
        today: '2026-03-01',
        examDate: '2026-03-20',
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
        examDate: '2026-03-20',
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
        examDate: '2026-03-20', // balanced mode
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
        examDate: '2026-03-20', // balanced mode has full_simulation on day 5
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

    // Per-Day Activity Type Tests (based on daysUntilExam for each day)
    describe('per-day activity type based on daysUntilExam', () => {
      let idCounter = 0
      const idGenerator = () => `id-${idCounter++}`

      beforeEach(() => {
        idCounter = 0
      })

      it('daysUntilExam=1 → all days get warmup activity (1 day plan)', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-02', // 1 day until exam
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        // When exam is 1 day away, all days should be warmup
        result.forEach((day) => {
          expect(day.activityType).toBe('warmup')
        })
      })

      it('daysUntilExam=2 → day 1 is full_simulation (2 days from exam), day 2 is warmup (1 day from exam)', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-03', // 2 days until exam
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        // Day 1 (2026-03-01): 2 days from exam → full_simulation
        expect(result[0].activityType).toBe('full_simulation')
        expect(result[0].date).toBe('2026-03-01')

        // Day 2 (2026-03-02): 1 day from exam → warmup
        expect(result[1].activityType).toBe('warmup')
        expect(result[1].date).toBe('2026-03-02')
      })

      it('daysUntilExam=7 → practice(6), practice(7), hybrid(5), hybrid(4), hybrid(3), full_simulation(2), warmup(1)', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-08', // 7 days until exam
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        // Day 1: 2026-03-01, 7 days from exam → practice (Standard)
        expect(result[0].activityType).toBe('practice')
        expect(result[0].date).toBe('2026-03-01')

        // Day 2: 2026-03-02, 6 days from exam → practice (Standard)
        expect(result[1].activityType).toBe('practice')
        expect(result[1].date).toBe('2026-03-02')

        // Day 3: 2026-03-03, 5 days from exam → hybrid (High Intensity)
        expect(result[2].activityType).toBe('hybrid')
        expect(result[2].date).toBe('2026-03-03')

        // Day 4: 2026-03-04, 4 days from exam → hybrid (High Intensity)
        expect(result[3].activityType).toBe('hybrid')
        expect(result[3].date).toBe('2026-03-04')

        // Day 5: 2026-03-05, 3 days from exam → hybrid (High Intensity)
        expect(result[4].activityType).toBe('hybrid')
        expect(result[4].date).toBe('2026-03-05')

        // Day 6: 2026-03-06, 2 days from exam → full_simulation
        expect(result[5].activityType).toBe('full_simulation')
        expect(result[5].date).toBe('2026-03-06')

        // Day 7: 2026-03-07, 1 day from exam → warmup
        expect(result[6].activityType).toBe('warmup')
        expect(result[6].date).toBe('2026-03-07')
      })

      it('daysUntilExam=12 → only last 7 days shown, starting 5 days before exam (examDate - 7)', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-13', // 12 days until exam
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        // With 12 days until exam, we should only show 7 days
        // The plan should start from examDate - 7 (5 days before exam)
        // Day 1: 2026-03-06 (7 days before exam)
        // Day 7: 2026-03-12 (1 day before exam)

        expect(result).toHaveLength(7)

        // First day should be examDate - 7 = 2026-03-06
        expect(result[0].date).toBe('2026-03-06')

        // Last day should be examDate - 1 = 2026-03-12
        expect(result[6].date).toBe('2026-03-12')
      })

      it('daysAvailable=0 → returns empty array', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-01', // 0 days until exam (same day)
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        // When exam is today or passed, return empty array
        expect(result).toHaveLength(0)
      })

      it('each day has topicIds array with at least 1 string', () => {
        const input = {
          today: '2026-03-01',
          examDate: '2026-03-20', // 19 days until exam
          topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
          idGenerator,
        }

        const result = generateStudyPlan(input)

        result.forEach((day) => {
          expect(Array.isArray(day.topicIds)).toBe(true)
          expect(day.topicIds.length).toBeGreaterThan(0)
          day.topicIds.forEach((topicId) => {
            expect(typeof topicId).toBe('string')
            expect(topicId.length).toBeGreaterThan(0)
          })
        })
      })
    })
  })
})
