import { queryCourseBySlug, queryPublishedCourses } from '@/server/repos/queries/courses'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

type MockPayload = {
  find?: Mock
}

describe('Course Content Status Filtering', () => {
  describe('queryPublishedCourses', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('includes courses with contentStatus "none"', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryPublishedCourses()

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'courses',
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

    it('includes "soon" courses where contentStatusVisible is true', async () => {
      const { getPayload } = await import('payload')
      const mockCourse = {
        id: 'course-1',
        title: 'Coming Soon Course',
        contentStatus: 'soon',
        contentStatusVisible: true,
      }
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockCourse] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPublishedCourses()

      // The query should return courses where soon+visible=true
      expect(result).toContainEqual(mockCourse)
    })

    it('excludes "soon" courses where contentStatusVisible is false', async () => {
      const { getPayload } = await import('payload')
      // Simulate the filter excluding hidden soon content
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryPublishedCourses()

      // Verify the where clause includes the contentStatusVisible filter
      const findCall = mockPayload.find!.mock.calls[0][0]
      const conditions = findCall.where.and

      // Find the contentStatus filter
      const contentStatusCondition = conditions.find((c: any) => c.or && Array.isArray(c.or))

      expect(contentStatusCondition).toBeDefined()
      expect(contentStatusCondition.or).toEqual([
        { contentStatus: { not_equals: 'soon' } },
        { contentStatusVisible: { equals: true } },
      ])
    })
  })

  describe('queryCourseBySlug', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('includes contentStatusVisible filter in query', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryCourseBySlug({ slug: 'test-course' })

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'courses',
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
})
