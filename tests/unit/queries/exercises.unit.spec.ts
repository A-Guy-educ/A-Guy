import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryExerciseById, queryExercisesByLesson } from '@/lib/queries/exercises'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

describe('Exercise Queries', () => {
  describe('queryExerciseById', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns exercise when found', async () => {
      const mockExercise = {
        id: 'exercise-1',
        title: 'Test Exercise',
        questionType: 'mcq',
        contentJson: { stem: [] },
        answerSpecJson: { questionType: 'mcq', options: [], correctOptionIds: [] },
        lesson: {
          id: 'lesson-1',
          title: 'Test Lesson',
        },
      }

      const { getPayload } = await import('payload')
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue(mockExercise),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result = await queryExerciseById({ id: 'exercise-1' })

      expect(result).toEqual(mockExercise)
      expect(mockPayload.findByID).toHaveBeenCalledWith({
        collection: 'exercises',
        id: 'exercise-1',
        depth: 2,
      })
    })

    it('returns null when exercise not found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload = {
        findByID: vi.fn().mockRejectedValue(new Error('Not found')),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result = await queryExerciseById({ id: 'non-existent' })

      expect(result).toBeNull()
    })

    it('uses correct depth parameter', async () => {
      const mockExercise = {
        id: 'exercise-1',
        title: 'Test Exercise',
        lesson: {
          id: 'lesson-1',
          title: 'Test Lesson',
          chapter: {
            id: 'chapter-1',
            title: 'Test Chapter',
          },
        },
      }

      const { getPayload } = await import('payload')
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue(mockExercise),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await queryExerciseById({ id: 'exercise-1' })

      expect(mockPayload.findByID).toHaveBeenCalledWith({
        collection: 'exercises',
        id: 'exercise-1',
        depth: 2,
      })
    })
  })

  describe('queryExercisesByLesson', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns exercises for a lesson', async () => {
      const mockExercises = [
        {
          id: 'exercise-1',
          title: 'Exercise 1',
          lesson: 'lesson-1',
        },
        {
          id: 'exercise-2',
          title: 'Exercise 2',
          lesson: 'lesson-1',
        },
      ]

      const { getPayload } = await import('payload')
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockExercises }),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result = await queryExercisesByLesson({ lessonId: 'lesson-1' })

      expect(result).toEqual(mockExercises)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'exercises',
        where: {
          lesson: {
            equals: 'lesson-1',
          },
        },
        sort: 'createdAt',
        limit: 1000,
        pagination: false,
        depth: 1,
      })
    })

    it('returns empty array when no exercises found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result = await queryExercisesByLesson({ lessonId: 'lesson-without-exercises' })

      expect(result).toEqual([])
    })

    it('uses correct query parameters', async () => {
      const { getPayload } = await import('payload')
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await queryExercisesByLesson({ lessonId: 'lesson-1' })

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'exercises',
          where: {
            lesson: {
              equals: 'lesson-1',
            },
          },
          sort: 'createdAt',
          limit: 1000,
          pagination: false,
          depth: 1,
        }),
      )
    })
  })
})
