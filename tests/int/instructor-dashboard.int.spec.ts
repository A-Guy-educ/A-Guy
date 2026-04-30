/**
 * Integration tests for the instructor dashboard API route
 *
 * @fileType integration-test
 * @domain lms
 * @pattern instructor-dashboard
 * @ai-summary Tests for the admin and instructor dashboard API endpoints
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Check if DATABASE_URL is set to Atlas (testcontainers don't work with Atlas)
const dbUrl = process.env.DATABASE_URL || ''
const isAtlasUrl = dbUrl.includes('mongodb+srv://') || dbUrl.includes('.mongodb.net')

describe.skipIf(isAtlasUrl)('GET /api/instructor/dashboard', () => {
  // Mock user objects
  const mockAdminUser = {
    id: 'admin-user-123',
    collection: 'users' as const,
    role: 'admin' as const,
    email: 'admin@test.com',
    name: 'Admin User',
  }

  const mockInstructorUser = {
    id: 'instructor-user-456',
    collection: 'users' as const,
    role: 'instructor' as const,
    email: 'instructor@test.com',
    name: 'Instructor User',
  }

  const mockCourse: {
    id: string
    title: string
    slug: string
    courseLabel: string
  } = {
    id: 'course-789',
    title: 'Test Course',
    slug: 'test-course',
    courseLabel: 'TC-101',
  }

  const mockInstructorAssignment: {
    id: string
    instructor: { id: string; name: string }
    course: string
    role: string
    canGrade: boolean
    canMessageStudents: boolean
  } = {
    id: 'assignment-001',
    instructor: {
      id: 'instructor-user-456',
      name: 'Instructor User',
    },
    course: 'course-789',
    role: 'primary',
    canGrade: true,
    canMessageStudents: true,
  }

  beforeAll(() => {
    // Mock payload setup happens in each test via vi.doMock
    // No global mock needed since we test different auth scenarios
  })

  describe('Authentication', () => {
    it('returns 401 when no user is authenticated', async () => {
      const { GET } = await import('@/app/api/instructor/dashboard/route')

      // Mock auth to return null user
      const mockAuthPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: null }),
        find: vi.fn(),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockAuthPayload,
        }
      })

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 when user is not admin or instructor', async () => {
      const mockStudentUser = {
        id: 'student-user-999',
        collection: 'users' as const,
        role: 'student' as const,
      }

      const mockStudentPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockStudentUser }),
        find: vi.fn(),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockStudentPayload,
        }
      })

      // Re-import to pick up the new mock
      vi.resetModules()
      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)
      expect(response.status).toBe(403)
    })
  })

  describe('Admin branch', () => {
    it('returns all courses with instructor assignments for admin users', async () => {
      // Reset modules and set up fresh mocks for this test
      vi.resetModules()

      const mockAdminPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockAdminUser }),
        find: vi
          .fn()
          .mockResolvedValueOnce({
            docs: [mockCourse],
            totalDocs: 1,
          })
          .mockResolvedValueOnce({
            docs: [mockInstructorAssignment],
            totalDocs: 1,
          })
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          }),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockAdminPayload,
        }
      })

      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        success: boolean
        data: {
          courses: Array<{
            id: string
            title: string
            instructors?: Array<{ id: string; name: string; role: string }>
          }>
        }
      }

      expect(json.success).toBe(true)
      expect(json.data.courses).toHaveLength(1)
      expect(json.data.courses[0].id).toBe(mockCourse.id)
      expect(json.data.courses[0].instructors).toBeDefined()
      expect(json.data.courses[0].instructors).toHaveLength(1)
      expect(json.data.courses[0].instructors![0].name).toBe('Instructor User')
      expect(json.data.courses[0].instructors![0].role).toBe('primary')
    })

    it('returns courses with empty instructors array when no assignments exist', async () => {
      vi.resetModules()

      const mockAdminPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockAdminUser }),
        find: vi
          .fn()
          .mockResolvedValueOnce({
            docs: [mockCourse],
            totalDocs: 1,
          })
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          })
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          }),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockAdminPayload,
        }
      })

      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        success: boolean
        data: {
          courses: Array<{ id: string; instructors?: unknown[] }>
        }
      }

      expect(json.data.courses[0].instructors).toEqual([])
    })
  })

  describe('Instructor branch', () => {
    it('returns only courses assigned to the instructor', async () => {
      vi.resetModules()

      const mockInstructorPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockInstructorUser }),
        find: vi
          .fn()
          // getInstructorCourseIds returns [mockCourse.id]
          .mockResolvedValueOnce({
            docs: [{ course: mockCourse.id }],
            totalDocs: 1,
          })
          // payload.find for courses
          .mockResolvedValueOnce({
            docs: [mockCourse],
            totalDocs: 1,
          })
          // payload.find for enrolled users
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          }),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockInstructorPayload,
        }
      })

      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        success: boolean
        data: {
          courses: Array<{ id: string }>
        }
      }

      expect(json.success).toBe(true)
      expect(json.data.courses).toHaveLength(1)
      expect(json.data.courses[0].id).toBe(mockCourse.id)
      // Instructors field should NOT be present for instructor branch
      expect(json.data.courses[0]).not.toHaveProperty('instructors')
    })

    it('returns empty courses array when instructor has no assignments', async () => {
      vi.resetModules()

      const mockInstructorPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockInstructorUser }),
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 0,
        }),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockInstructorPayload,
        }
      })

      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        success: boolean
        data: { courses: unknown[]; totalCourses: number }
      }

      expect(json.success).toBe(true)
      expect(json.data.courses).toEqual([])
      expect(json.data.totalCourses).toBe(0)
    })
  })

  describe('Response shape', () => {
    it('returns correct response structure for admin', async () => {
      vi.resetModules()

      const mockAdminPayload = vi.fn(() => ({
        auth: vi.fn().mockResolvedValue({ user: mockAdminUser }),
        find: vi
          .fn()
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          })
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          })
          .mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
          }),
      })) as unknown as ReturnType<typeof vi.fn>

      vi.doMock('payload', async (importOriginal) => {
        const actual = await importOriginal<typeof import('payload')>()
        return {
          ...actual,
          getPayload: () => mockAdminPayload,
        }
      })

      const { GET } = await import('@/app/api/instructor/dashboard/route')

      const request = new NextRequest('http://localhost/api/instructor/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        success: boolean
        data: {
          courses: unknown[]
          totalStudents: number
          totalCourses: number
        }
      }

      expect(json).toHaveProperty('success')
      expect(json).toHaveProperty('data')
      expect(json.data).toHaveProperty('courses')
      expect(json.data).toHaveProperty('totalStudents')
      expect(json.data).toHaveProperty('totalCourses')
    })
  })
})
