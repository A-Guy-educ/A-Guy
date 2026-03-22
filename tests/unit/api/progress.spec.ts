import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Unit tests for progress API logic
 *
 * Tests the Zod validation schema and the pure upsert logic
 * used by POST /api/progress without touching the database.
 */

// Mirror the Zod schema from src/app/api/progress/route.ts
const PostBodySchema = z.object({
  recordType: z.enum(['lesson', 'exercise', 'chapter']),
  recordId: z.string().min(1),
  completionPercentage: z.number().min(0).max(100),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  score: z.number().min(0).max(100).optional(),
  gradeLevel: z.string().min(1),
})

// Pure upsert logic extracted from the route handler
interface ProgressRecord {
  recordType: string
  recordId: string
  completionPercentage: number
  status: string
  score?: number
  lastAccessedAt?: string
}

function upsertProgressRecord(
  existing: ProgressRecord[],
  newRecord: ProgressRecord,
): ProgressRecord[] {
  const idx = existing.findIndex(
    (r) => r.recordType === newRecord.recordType && r.recordId === newRecord.recordId,
  )
  return idx >= 0
    ? existing.map((r, i) => (i === idx ? { ...r, ...newRecord } : r))
    : [...existing, newRecord]
}

// Pure filter logic from GET handler
function filterRecords(
  records: ProgressRecord[],
  filters: { recordType?: string; recordIds?: string[] },
): ProgressRecord[] {
  let filtered = records
  if (filters.recordType) {
    filtered = filtered.filter((r) => r.recordType === filters.recordType)
  }
  if (filters.recordIds) {
    filtered = filtered.filter((r) => filters.recordIds!.includes(r.recordId))
  }
  return filtered
}

// Course-level aggregation logic from GET handler
function computeCourseProgress(records: ProgressRecord[]): {
  percentage: number
  totalLessons: number
} {
  const lessonRecords = records.filter((r) => r.recordType === 'lesson')
  if (lessonRecords.length === 0) return { percentage: 0, totalLessons: 0 }
  const total = lessonRecords.reduce((sum, r) => sum + (r.completionPercentage ?? 0), 0)
  return {
    percentage: Math.round(total / lessonRecords.length),
    totalLessons: lessonRecords.length,
  }
}

describe('Progress API', () => {
  describe('PostBodySchema validation', () => {
    it('should accept valid lesson completion', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-123',
        completionPercentage: 100,
        status: 'completed',
        gradeLevel: '8',
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid exercise with score', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'exercise',
        recordId: 'ex-456',
        completionPercentage: 75,
        status: 'in_progress',
        score: 80,
        gradeLevel: 'ט',
      })
      expect(result.success).toBe(true)
      expect(result.data?.score).toBe(80)
    })

    it('should reject missing recordId', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: '',
        completionPercentage: 50,
        status: 'in_progress',
        gradeLevel: '8',
      })
      expect(result.success).toBe(false)
    })

    it('should reject completionPercentage > 100', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 150,
        status: 'completed',
        gradeLevel: '8',
      })
      expect(result.success).toBe(false)
    })

    it('should reject completionPercentage < 0', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: -10,
        status: 'completed',
        gradeLevel: '8',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid recordType', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'quiz',
        recordId: 'quiz-1',
        completionPercentage: 50,
        status: 'in_progress',
        gradeLevel: '8',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid status', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 50,
        status: 'paused',
        gradeLevel: '8',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing gradeLevel', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 50,
        status: 'in_progress',
      })
      expect(result.success).toBe(false)
    })

    it('should allow score to be omitted', () => {
      const result = PostBodySchema.safeParse({
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 100,
        status: 'completed',
        gradeLevel: '8',
      })
      expect(result.success).toBe(true)
      expect(result.data?.score).toBeUndefined()
    })
  })

  describe('upsertProgressRecord', () => {
    it('should add a new record to an empty array', () => {
      const result = upsertProgressRecord([], {
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 50,
        status: 'in_progress',
      })
      expect(result).toHaveLength(1)
      expect(result[0].recordId).toBe('lesson-1')
    })

    it('should add a new record when no match exists', () => {
      const existing = [
        {
          recordType: 'lesson',
          recordId: 'lesson-1',
          completionPercentage: 100,
          status: 'completed',
        },
      ]
      const result = upsertProgressRecord(existing, {
        recordType: 'exercise',
        recordId: 'ex-1',
        completionPercentage: 50,
        status: 'in_progress',
      })
      expect(result).toHaveLength(2)
    })

    it('should update existing record by (recordType, recordId)', () => {
      const existing = [
        {
          recordType: 'lesson',
          recordId: 'lesson-1',
          completionPercentage: 50,
          status: 'in_progress',
        },
        {
          recordType: 'exercise',
          recordId: 'ex-1',
          completionPercentage: 100,
          status: 'completed',
        },
      ]
      const result = upsertProgressRecord(existing, {
        recordType: 'lesson',
        recordId: 'lesson-1',
        completionPercentage: 100,
        status: 'completed',
      })
      expect(result).toHaveLength(2)
      expect(result[0].completionPercentage).toBe(100)
      expect(result[0].status).toBe('completed')
      // Other record unchanged
      expect(result[1].recordId).toBe('ex-1')
    })

    it('should not match records with same recordId but different recordType', () => {
      const existing = [
        { recordType: 'lesson', recordId: 'id-1', completionPercentage: 50, status: 'in_progress' },
      ]
      const result = upsertProgressRecord(existing, {
        recordType: 'exercise',
        recordId: 'id-1',
        completionPercentage: 100,
        status: 'completed',
      })
      expect(result).toHaveLength(2)
    })

    it('should preserve existing fields when merging', () => {
      const existing = [
        {
          recordType: 'exercise',
          recordId: 'ex-1',
          completionPercentage: 50,
          status: 'in_progress',
          score: 60,
          lastAccessedAt: '2025-01-01',
        },
      ]
      const result = upsertProgressRecord(existing, {
        recordType: 'exercise',
        recordId: 'ex-1',
        completionPercentage: 100,
        status: 'completed',
      })
      expect(result[0].score).toBe(60)
      expect(result[0].completionPercentage).toBe(100)
    })
  })

  describe('filterRecords', () => {
    const records: ProgressRecord[] = [
      { recordType: 'lesson', recordId: 'L1', completionPercentage: 100, status: 'completed' },
      { recordType: 'lesson', recordId: 'L2', completionPercentage: 50, status: 'in_progress' },
      { recordType: 'exercise', recordId: 'E1', completionPercentage: 100, status: 'completed' },
      { recordType: 'chapter', recordId: 'C1', completionPercentage: 75, status: 'in_progress' },
    ]

    it('should return all records with no filters', () => {
      expect(filterRecords(records, {})).toHaveLength(4)
    })

    it('should filter by recordType', () => {
      const result = filterRecords(records, { recordType: 'lesson' })
      expect(result).toHaveLength(2)
      expect(result.every((r) => r.recordType === 'lesson')).toBe(true)
    })

    it('should filter by recordIds', () => {
      const result = filterRecords(records, { recordIds: ['L1', 'E1'] })
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.recordId)).toEqual(['L1', 'E1'])
    })

    it('should combine filters', () => {
      const result = filterRecords(records, { recordType: 'lesson', recordIds: ['L1', 'L2', 'E1'] })
      expect(result).toHaveLength(2)
      expect(result.every((r) => r.recordType === 'lesson')).toBe(true)
    })

    it('should return empty array when no matches', () => {
      expect(filterRecords(records, { recordIds: ['nonexistent'] })).toHaveLength(0)
    })
  })

  describe('computeCourseProgress', () => {
    it('should return 0 for empty records', () => {
      expect(computeCourseProgress([])).toEqual({ percentage: 0, totalLessons: 0 })
    })

    it('should only count lesson records', () => {
      const records: ProgressRecord[] = [
        { recordType: 'lesson', recordId: 'L1', completionPercentage: 100, status: 'completed' },
        { recordType: 'exercise', recordId: 'E1', completionPercentage: 50, status: 'in_progress' },
      ]
      const result = computeCourseProgress(records)
      expect(result.totalLessons).toBe(1)
      expect(result.percentage).toBe(100)
    })

    it('should average lesson completion percentages', () => {
      const records: ProgressRecord[] = [
        { recordType: 'lesson', recordId: 'L1', completionPercentage: 100, status: 'completed' },
        { recordType: 'lesson', recordId: 'L2', completionPercentage: 50, status: 'in_progress' },
        { recordType: 'lesson', recordId: 'L3', completionPercentage: 0, status: 'not_started' },
      ]
      const result = computeCourseProgress(records)
      expect(result.totalLessons).toBe(3)
      expect(result.percentage).toBe(50) // (100+50+0)/3 = 50
    })

    it('should round the percentage', () => {
      const records: ProgressRecord[] = [
        { recordType: 'lesson', recordId: 'L1', completionPercentage: 100, status: 'completed' },
        { recordType: 'lesson', recordId: 'L2', completionPercentage: 33, status: 'in_progress' },
      ]
      const result = computeCourseProgress(records)
      expect(result.percentage).toBe(67) // (100+33)/2 = 66.5 → 67
    })
  })
})
