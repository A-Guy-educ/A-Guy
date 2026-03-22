import { queryLessonsByChapter, queryLessonsByCourse } from '@/server/repos/queries/lessons'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/server/repos/queries/chapters', () => ({
  queryChaptersByCourse: vi.fn(),
}))

type MockPayload = {
  find?: Mock
  findByID?: Mock
}

describe('Lesson Content Status Filtering', () => {
  describe('queryLessonsByChapter', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('includes contentStatusVisible filter in query', async () => {
      const { getPayload } = await import('payload')

      // Mock chapter and course as published+active
      const mockPayload: MockPayload = {
        findByID: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'chapter-1',
            status: 'published',
            isActive: true,
            course: 'course-1',
          })
          .mockResolvedValueOnce({
            id: 'course-1',
            status: 'published',
            isActive: true,
          }),
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryLessonsByChapter({ chapterId: 'chapter-1' })

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'lessons',
          where: expect.objectContaining({
            and: expect.arrayContaining([
              expect.objectContaining({
                or: expect.arrayContaining([
                  expect.objectContaining({ contentStatus: { not_equals: 'soon' } }),
                  expect.objectContaining({ contentStatusVisible: { equals: true } }),
                ]),
              }),
            ]),
          }),
        }),
      )
    })
  })

  describe('queryLessonsByCourse', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('includes contentStatusVisible filter in query', async () => {
      const { getPayload } = await import('payload')
      const { queryChaptersByCourse } = await import('@/server/repos/queries/chapters')

      // Mock chapters
      const mockChapters = [
        { id: 'chapter-1', title: 'Chapter 1', order: 0, status: 'published', isActive: true },
      ]
      ;(queryChaptersByCourse as Mock).mockResolvedValue(mockChapters)

      const mockPayload: MockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'course-1',
          status: 'published',
          isActive: true,
        }),
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryLessonsByCourse({ courseId: 'course-1' })

      // Verify the query includes contentStatusVisible filter
      expect(mockPayload.find).toHaveBeenCalled()
      const findCall = mockPayload.find!.mock.calls[0][0]

      expect(findCall.where.and).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            or: expect.arrayContaining([
              expect.objectContaining({ contentStatus: { not_equals: 'soon' } }),
              expect.objectContaining({ contentStatusVisible: { equals: true } }),
            ]),
          }),
        ]),
      )
    })
  })
})
