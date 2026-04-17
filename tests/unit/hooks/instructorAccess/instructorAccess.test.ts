import { describe, expect, it, vi } from 'vitest'

import { AccountRole } from '@/infra/auth/roles'
import {
  isInstructor,
  isAdminUser,
  isInstructorForCourse,
  canInstructorGrade,
  canInstructorMessageStudents,
  getInstructorCourseIds,
  getInstructorRoleForCourse,
  InstructorUser,
} from '@/server/payload/hooks/auth/instructorAccess'

describe('instructorAccess Hook', () => {
  // --- isInstructor ---

  describe('isInstructor', () => {
    it('returns true for instructor role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Instructor,
        collection: 'users',
      }
      expect(isInstructor(user)).toBe(true)
    })

    it('returns false for student role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Student,
        collection: 'users',
      }
      expect(isInstructor(user)).toBe(false)
    })

    it('returns false for admin role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Admin,
        collection: 'users',
      }
      expect(isInstructor(user)).toBe(false)
    })

    it('returns false for null user', () => {
      expect(isInstructor(null)).toBe(false)
    })

    it('returns false for undefined user', () => {
      expect(isInstructor(undefined)).toBe(false)
    })
  })

  // --- isAdminUser ---

  describe('isAdminUser', () => {
    it('returns true for admin role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Admin,
        collection: 'users',
      }
      expect(isAdminUser(user)).toBe(true)
    })

    it('returns false for instructor role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Instructor,
        collection: 'users',
      }
      expect(isAdminUser(user)).toBe(false)
    })

    it('returns false for student role', () => {
      const user: InstructorUser = {
        id: 'user-123',
        role: AccountRole.Student,
        collection: 'users',
      }
      expect(isAdminUser(user)).toBe(false)
    })

    it('returns false for null user', () => {
      expect(isAdminUser(null)).toBe(false)
    })
  })

  // --- isInstructorForCourse ---

  describe('isInstructorForCourse', () => {
    it('returns true when assignment exists', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', instructor: 'user-123', course: 'course-456' }],
        }),
      }

      const result = await isInstructorForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe(true)
      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'course-instructors',
          where: {
            and: [{ instructor: { equals: 'user-123' } }, { course: { equals: 'course-456' } }],
          },
        }),
      )
    })

    it('returns false when assignment does not exist', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }

      const result = await isInstructorForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe(false)
    })
  })

  // --- canInstructorGrade ---

  describe('canInstructorGrade', () => {
    it('returns true when canGrade is true in assignment', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', canGrade: true, canMessageStudents: true }],
        }),
      }

      const result = await canInstructorGrade(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe(true)
    })

    it('returns false when canGrade is false in assignment', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', canGrade: false, canMessageStudents: true }],
        }),
      }

      const result = await canInstructorGrade(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe(false)
    })

    it('returns false when no assignment exists', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }

      const result = await canInstructorGrade(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe(false)
    })

    it('returns false when userId is empty', async () => {
      const mockPayload = {
        find: vi.fn(),
      }

      const result = await canInstructorGrade(mockPayload as any, '', 'course-456')

      expect(result).toBe(false)
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('returns false when courseId is empty', async () => {
      const mockPayload = {
        find: vi.fn(),
      }

      const result = await canInstructorGrade(mockPayload as any, 'user-123', '')

      expect(result).toBe(false)
      expect(mockPayload.find).not.toHaveBeenCalled()
    })
  })

  // --- canInstructorMessageStudents ---

  describe('canInstructorMessageStudents', () => {
    it('returns true when canMessageStudents is true in assignment', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', canGrade: true, canMessageStudents: true }],
        }),
      }

      const result = await canInstructorMessageStudents(
        mockPayload as any,
        'user-123',
        'course-456',
      )

      expect(result).toBe(true)
    })

    it('returns false when canMessageStudents is false in assignment', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', canGrade: true, canMessageStudents: false }],
        }),
      }

      const result = await canInstructorMessageStudents(
        mockPayload as any,
        'user-123',
        'course-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when no assignment exists', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }

      const result = await canInstructorMessageStudents(
        mockPayload as any,
        'user-123',
        'course-456',
      )

      expect(result).toBe(false)
    })
  })

  // --- getInstructorCourseIds ---

  describe('getInstructorCourseIds', () => {
    it('returns course IDs for assigned courses', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ course: 'course-1' }, { course: 'course-2' }, { course: 'course-3' }],
        }),
      }

      const result = await getInstructorCourseIds(mockPayload as any, 'user-123')

      expect(result).toEqual(['course-1', 'course-2', 'course-3'])
    })

    it('returns empty array when no assignments exist', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }

      const result = await getInstructorCourseIds(mockPayload as any, 'user-123')

      expect(result).toEqual([])
    })
  })

  // --- getInstructorRoleForCourse ---

  describe('getInstructorRoleForCourse', () => {
    it('returns "primary" for primary instructor', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', role: 'primary' }],
        }),
      }

      const result = await getInstructorRoleForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe('primary')
    })

    it('returns "ta" for teaching assistant', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', role: 'ta' }],
        }),
      }

      const result = await getInstructorRoleForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe('ta')
    })

    it('returns "guest" for guest lecturer', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'assignment-1', role: 'guest' }],
        }),
      }

      const result = await getInstructorRoleForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBe('guest')
    })

    it('returns null when no assignment exists', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }

      const result = await getInstructorRoleForCourse(mockPayload as any, 'user-123', 'course-456')

      expect(result).toBeNull()
    })
  })
})
