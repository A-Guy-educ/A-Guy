import { describe, expect, it } from 'vitest'

import { mergeStudyPlan } from '@/lib/study-plan/merge'
import type { MasteryLevel, StudyPlanDay, TopicInput } from '@/lib/study-plan/types'

describe('mergeStudyPlan', () => {
  const _baseTopics: TopicInput[] = [
    { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as MasteryLevel },
    { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as MasteryLevel },
    { topicId: 't-deleted', topicLabel: 'Deleted Topic', mastery: 'strong' as MasteryLevel },
  ]

  const newInput = {
    today: '2026-03-01',
    examDate: '2026-03-10',
    topics: [
      { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as MasteryLevel },
      { topicId: 't2', topicLabel: 'Topic 2', mastery: 'medium' as MasteryLevel },
    ],
    idGenerator: () => 'new-id',
  }

  it('Preserve completed days — status, dayId, topicIds, activityType unchanged', () => {
    const existingDays: StudyPlanDay[] = [
      {
        dayId: 'completed-0',
        date: '2026-03-01',
        activityType: 'warmup',
        topicIds: ['t1'],
        status: 'completed',
        estimatedDurationMinutes: 20,
      },
      {
        dayId: 'planned-1',
        date: '2026-03-02',
        activityType: 'practice',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'completed-2',
        date: '2026-03-03',
        activityType: 'warmup',
        topicIds: ['t-deleted'],
        status: 'completed',
        estimatedDurationMinutes: 20,
      },
      // Days 4-6 (future)
      {
        dayId: 'planned-3',
        date: '2026-03-04',
        activityType: 'practice',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'planned-4',
        date: '2026-03-05',
        activityType: 'hybrid',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 50,
      },
      {
        dayId: 'planned-5',
        date: '2026-03-06',
        activityType: 'reinforcement',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 30,
      },
      {
        dayId: 'planned-6',
        date: '2026-03-07',
        activityType: 'warmup',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
    ]

    const result = mergeStudyPlan(existingDays, newInput)
    expect(result).toHaveLength(7)

    // Day 0 should be preserved as completed
    const day0 = result.find((d) => d.date === '2026-03-01')
    expect(day0?.status).toBe('completed')
    expect(day0?.dayId).toBe('completed-0')
    expect(day0?.topicIds).toEqual(['t1'])
    expect(day0?.activityType).toBe('warmup')

    // Day 2 should be preserved as completed
    const day2 = result.find((d) => d.date === '2026-03-03')
    expect(day2?.status).toBe('completed')
    expect(day2?.dayId).toBe('completed-2')
    expect(day2?.topicIds).toEqual(['t-deleted'])
  })

  it('Recalculate planned days — new values replacing planned days', () => {
    const existingDays: StudyPlanDay[] = [
      {
        dayId: 'old-planned-0',
        date: '2026-03-01',
        activityType: 'warmup',
        topicIds: ['t-old'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
      {
        dayId: 'old-planned-1',
        date: '2026-03-02',
        activityType: 'practice',
        topicIds: ['t-old'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      // Days 2-6
      {
        dayId: 'old-2',
        date: '2026-03-03',
        activityType: 'warmup',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
      {
        dayId: 'old-3',
        date: '2026-03-04',
        activityType: 'practice',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'old-4',
        date: '2026-03-05',
        activityType: 'hybrid',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 50,
      },
      {
        dayId: 'old-5',
        date: '2026-03-06',
        activityType: 'reinforcement',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 30,
      },
      {
        dayId: 'old-6',
        date: '2026-03-07',
        activityType: 'warmup',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
    ]

    const result = mergeStudyPlan(existingDays, newInput)
    expect(result).toHaveLength(7)

    // Planned days should have new values (different dayId)
    const plannedDays = result.filter((d) => d.status === 'planned')
    expect(plannedDays.length).toBeGreaterThan(0)

    // None of the planned days should have the old dayId
    plannedDays.forEach((day) => {
      expect(day.dayId).not.toBe('old-planned-0')
      expect(day.dayId).not.toBe('old-planned-1')
    })
  })

  it('Output always 7 days', () => {
    const existingDays: StudyPlanDay[] = [
      {
        dayId: 'c1',
        date: '2026-03-01',
        activityType: 'warmup',
        topicIds: ['t1'],
        status: 'completed',
        estimatedDurationMinutes: 20,
      },
    ]

    const result = mergeStudyPlan(existingDays, newInput)
    expect(result).toHaveLength(7)
  })

  it('Topic deletion from planned days — deleted topic not in planned days', () => {
    const existingDays: StudyPlanDay[] = [
      {
        dayId: 'planned-0',
        date: '2026-03-01',
        activityType: 'warmup',
        topicIds: ['t-deleted'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
      // Days 1-6
      {
        dayId: 'p1',
        date: '2026-03-02',
        activityType: 'practice',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'p2',
        date: '2026-03-03',
        activityType: 'warmup',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
      {
        dayId: 'p3',
        date: '2026-03-04',
        activityType: 'practice',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'p4',
        date: '2026-03-05',
        activityType: 'hybrid',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 50,
      },
      {
        dayId: 'p5',
        date: '2026-03-06',
        activityType: 'reinforcement',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 30,
      },
      {
        dayId: 'p6',
        date: '2026-03-07',
        activityType: 'warmup',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
    ]

    const result = mergeStudyPlan(existingDays, newInput)
    expect(result).toHaveLength(7)

    // Planned days should NOT contain 't-deleted'
    const plannedDays = result.filter((d) => d.status === 'planned')
    plannedDays.forEach((day) => {
      expect(day.topicIds).not.toContain('t-deleted')
    })
  })

  it('Topic preserved in completed days — deleted topic remains in completed', () => {
    const existingDays: StudyPlanDay[] = [
      {
        dayId: 'completed-0',
        date: '2026-03-01',
        activityType: 'warmup',
        topicIds: ['t-deleted'],
        status: 'completed',
        estimatedDurationMinutes: 20,
      },
      // Days 1-6
      {
        dayId: 'p1',
        date: '2026-03-02',
        activityType: 'practice',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'p2',
        date: '2026-03-03',
        activityType: 'warmup',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
      {
        dayId: 'p3',
        date: '2026-03-04',
        activityType: 'practice',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 45,
      },
      {
        dayId: 'p4',
        date: '2026-03-05',
        activityType: 'hybrid',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 50,
      },
      {
        dayId: 'p5',
        date: '2026-03-06',
        activityType: 'reinforcement',
        topicIds: ['t1'],
        status: 'planned',
        estimatedDurationMinutes: 30,
      },
      {
        dayId: 'p6',
        date: '2026-03-07',
        activityType: 'warmup',
        topicIds: ['t2'],
        status: 'planned',
        estimatedDurationMinutes: 20,
      },
    ]

    const result = mergeStudyPlan(existingDays, newInput)

    expect(result).toHaveLength(7)

    // Completed day should still have 't-deleted'
    const completedDay = result.find((d) => d.date === '2026-03-01')
    expect(completedDay?.status).toBe('completed')
    expect(completedDay?.topicIds).toContain('t-deleted')
  })
})
