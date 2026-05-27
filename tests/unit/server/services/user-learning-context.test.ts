/**
 * Unit tests for user-learning-context.ts
 * Tests the fetchUserLearningContext and fetchLessonContext functions
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import {
  fetchLessonContext,
  fetchUserLearningContext,
  buildUserContextBlock,
  type UserLearningContext,
} from '@/server/services/user-learning-context'
import { logger } from '@/infra/utils/logger'

vi.mock('@/infra/utils/logger', () => ({
  logger: {
    child: vi.fn(() => logger),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const createMockPayload = (overrides?: Partial<Payload>) => {
  const mockFind = vi.fn()
  const mockFindByID = vi.fn()
  return {
    find: mockFind,
    findByID: mockFindByID,
    ...overrides,
  } as unknown as Payload & {
    find: ReturnType<typeof vi.fn>
    findByID: ReturnType<typeof vi.fn>
  }
}

describe('fetchUserLearningContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty context when no progress records exist', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({ docs: [] })

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7')

    expect(result.activeCourses).toEqual([])
    expect(result.completedLessons).toBe(0)
    expect(result.completedChapters).toBe(0)
    expect(result.totalExercisesCompleted).toBe(0)
    expect(result.recentActivity).toEqual([])
    expect(result.currentStreak).toBe(0)
    expect(result.studyPlan).toBeNull()
    expect(result.lessonContext).toBeNull()
  })

  it('returns lessonContext when lesson context params are provided', async () => {
    const mockPayload = createMockPayload()
    // First call: user progress (empty)
    mockPayload.find
      .mockResolvedValueOnce({ docs: [] })
      // Second call: lesson query
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'lesson-1',
            title: 'Linear Equations',
            slug: 'linear-equations',
            topicDescription: 'Introduction to linear equations',
            exercises: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
            chapter: {
              slug: 'chapter-1',
              course: { slug: 'algebra-1' },
            },
          },
        ],
      })

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7', {
      courseSlug: 'algebra-1',
      lessonSlug: 'linear-equations',
      chapterSlug: 'chapter-1',
    })

    expect(result.lessonContext).not.toBeNull()
    expect(result.lessonContext?.lessonTitle).toBe('Linear Equations')
    expect(result.lessonContext?.exerciseCount).toBe(3)
    expect(result.lessonContext?.topicDescription).toBe('Introduction to linear equations')
    expect(result.lessonContext?.lessonUrl).toBe(
      '/courses/algebra-1/chapters/chapter-1/lessons/linear-equations',
    )
  })

  it('does not fetch lesson context when params are not provided', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({ docs: [] })

    await fetchUserLearningContext(mockPayload, 'user-123', '7')

    // Should only be called once (for user progress), not for lesson
    expect(mockPayload.find).toHaveBeenCalledTimes(1)
  })

  it('calculates completed counts from progress records', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'progress-1',
          user: 'user-123',
          gradeLevel: '7',
          progressRecords: [
            {
              recordType: 'lesson',
              recordId: 'lesson-1',
              status: 'completed',
              lastAccessedAt: '2024-01-01',
            },
            {
              recordType: 'lesson',
              recordId: 'lesson-2',
              status: 'completed',
              lastAccessedAt: '2024-01-02',
            },
            {
              recordType: 'chapter',
              recordId: 'chapter-1',
              status: 'completed',
              lastAccessedAt: '2024-01-03',
            },
            {
              recordType: 'exercise',
              recordId: 'exercise-1',
              status: 'completed',
              lastAccessedAt: '2024-01-04',
            },
            {
              recordType: 'exercise',
              recordId: 'exercise-2',
              status: 'completed',
              lastAccessedAt: '2024-01-05',
            },
          ],
        },
      ],
    })

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7')

    expect(result.completedLessons).toBe(2)
    expect(result.completedChapters).toBe(1)
    expect(result.totalExercisesCompleted).toBe(2)
  })

  it('calculates average score from scored records', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'progress-1',
          user: 'user-123',
          gradeLevel: '7',
          progressRecords: [
            {
              recordType: 'exercise',
              recordId: 'exercise-1',
              score: 80,
              lastAccessedAt: '2024-01-01',
            },
            {
              recordType: 'exercise',
              recordId: 'exercise-2',
              score: 90,
              lastAccessedAt: '2024-01-02',
            },
            {
              recordType: 'exercise',
              recordId: 'exercise-3',
              score: null,
              lastAccessedAt: '2024-01-03',
            },
          ],
        },
      ],
    })

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7')

    expect(result.averageScore).toBe(85) // (80 + 90) / 2 = 85
  })

  it('calculates learning streak from consecutive activity days', async () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'progress-1',
          user: 'user-123',
          gradeLevel: '7',
          progressRecords: [
            { recordType: 'lesson', recordId: 'lesson-1', lastAccessedAt: today.toISOString() },
            { recordType: 'lesson', recordId: 'lesson-2', lastAccessedAt: yesterday.toISOString() },
            {
              recordType: 'lesson',
              recordId: 'lesson-3',
              lastAccessedAt: twoDaysAgo.toISOString(),
            },
          ],
        },
      ],
    })

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7')

    expect(result.currentStreak).toBe(3)
  })

  it('returns empty context on error', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockRejectedValue(new Error('Database error'))

    const result = await fetchUserLearningContext(mockPayload, 'user-123', '7')

    expect(result.activeCourses).toEqual([])
    expect(result.completedLessons).toBe(0)
    expect(result.lessonContext).toBeNull()
  })
})

describe('fetchLessonContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no lesson is found', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({ docs: [] })

    const result = await fetchLessonContext(
      mockPayload,
      { courseSlug: 'algebra-1', lessonSlug: 'nonexistent', chapterSlug: 'chapter-1' },
      logger,
    )

    expect(result).toBeNull()
  })

  it('returns lesson context with correct structure when lesson is found', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'lesson-abc',
          title: 'Quadratic Functions',
          slug: 'quadratic-functions',
          topicDescription: 'Working with quadratic expressions',
          exercises: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }, { id: 'e5' }],
          chapter: {
            slug: 'functions-chapter',
            course: { slug: 'algebra-2' },
          },
        },
      ],
    })

    const result = await fetchLessonContext(
      mockPayload,
      {
        courseSlug: 'algebra-2',
        lessonSlug: 'quadratic-functions',
        chapterSlug: 'functions-chapter',
      },
      logger,
    )

    expect(result).toEqual({
      lessonId: 'lesson-abc',
      lessonTitle: 'Quadratic Functions',
      lessonSlug: 'quadratic-functions',
      courseSlug: 'algebra-2',
      chapterSlug: 'functions-chapter',
      exerciseCount: 5,
      topicDescription: 'Working with quadratic expressions',
      lessonUrl: '/courses/algebra-2/chapters/functions-chapter/lessons/quadratic-functions',
    })
  })

  it('handles lesson with no exercises gracefully', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'lesson-xyz',
          title: 'Review Session',
          slug: 'review',
          exercises: [],
          chapter: {
            slug: 'review-chapter',
            course: { slug: 'geometry' },
          },
        },
      ],
    })

    const result = await fetchLessonContext(
      mockPayload,
      { courseSlug: 'geometry', lessonSlug: 'review', chapterSlug: 'review-chapter' },
      logger,
    )

    expect(result?.exerciseCount).toBe(0)
    expect(result?.topicDescription).toBe('')
  })

  it('uses fallback values when lesson fields are missing', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 'lesson-123',
          // missing title, slug, topicDescription
          exercises: [],
          chapter: {
            slug: 'ch-1',
            course: { slug: 'course-1' },
          },
        },
      ],
    })

    const result = await fetchLessonContext(
      mockPayload,
      { courseSlug: 'course-1', lessonSlug: 'some-lesson', chapterSlug: 'ch-1' },
      logger,
    )

    expect(result?.lessonTitle).toBe('Untitled Lesson')
    expect(result?.lessonSlug).toBe('some-lesson')
    expect(result?.topicDescription).toBe('')
  })

  it('returns null on database error', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockRejectedValue(new Error('Connection failed'))

    const result = await fetchLessonContext(
      mockPayload,
      { courseSlug: 'algebra-1', lessonSlug: 'lesson-1', chapterSlug: 'chapter-1' },
      logger,
    )

    expect(result).toBeNull()
  })
})

describe('buildUserContextBlock', () => {
  it('includes lesson context when present', () => {
    const context: UserLearningContext = {
      activeCourses: [],
      completedLessons: 0,
      completedChapters: 0,
      totalExercisesCompleted: 0,
      averageScore: null,
      recentActivity: [],
      currentStreak: 0,
      studyPlan: null,
      lessonContext: {
        lessonId: 'lesson-1',
        lessonTitle: 'Introduction to Algebra',
        lessonSlug: 'intro-algebra',
        courseSlug: 'algebra-1',
        chapterSlug: 'chapter-1',
        exerciseCount: 10,
        topicDescription: 'Basic algebraic concepts',
        lessonUrl: '/courses/algebra-1/chapters/chapter-1/lessons/intro-algebra',
      },
    }

    const block = buildUserContextBlock(context)

    expect(block).toContain('### Current Lesson')
    expect(block).toContain('Introduction to Algebra')
    expect(block).toContain('Exercises: 10')
    expect(block).toContain('Topic: Basic algebraic concepts')
    expect(block).toContain('/courses/algebra-1/chapters/chapter-1/lessons/intro-algebra')
  })

  it('does not include lesson section when lesson context is null', () => {
    const context: UserLearningContext = {
      activeCourses: [],
      completedLessons: 5,
      completedChapters: 2,
      totalExercisesCompleted: 50,
      averageScore: 85,
      recentActivity: [],
      currentStreak: 3,
      studyPlan: null,
      lessonContext: null,
    }

    const block = buildUserContextBlock(context)

    expect(block).not.toContain('### Current Lesson')
    expect(block).toContain('### Completion Stats')
  })
})
