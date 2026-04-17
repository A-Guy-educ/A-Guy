/**
 * Test helpers for instructor and course-instructor assignment management
 */
import type { Payload } from 'payload'

import { logger } from '@/infra/utils/logger'

export interface TestCourseInstructor {
  instructorId: string
  courseId: string
  role: 'primary' | 'ta' | 'guest'
  canGrade: boolean
  canMessageStudents: boolean
}

/**
 * Create a course-instructor assignment
 */
export async function seedCourseInstructor(
  payload: Payload,
  instructorId: string,
  courseId: string,
  role: 'primary' | 'ta' | 'guest' = 'primary',
  options: { canGrade?: boolean; canMessageStudents?: boolean } = {},
): Promise<TestCourseInstructor> {
  const { canGrade = true, canMessageStudents = true } = options

  // Check if assignment already exists
  const existing = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: instructorId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    return {
      instructorId,
      courseId,
      role: existing.docs[0].role as 'primary' | 'ta' | 'guest',
      canGrade: existing.docs[0].canGrade ?? canGrade,
      canMessageStudents: existing.docs[0].canMessageStudents ?? canMessageStudents,
    }
  }

  // Create new assignment
  const created = await payload.create({
    collection: 'course-instructors',
    data: {
      instructor: instructorId,
      course: courseId,
      role,
      canGrade,
      canMessageStudents,
    },
    overrideAccess: true,
  })

  logger.info(`Created course-instructor assignment: ${instructorId} -> ${courseId}`)

  return {
    instructorId,
    courseId,
    role: created.role as 'primary' | 'ta' | 'guest',
    canGrade: created.canGrade ?? canGrade,
    canMessageStudents: created.canMessageStudents ?? canMessageStudents,
  }
}

/**
 * Remove a course-instructor assignment
 */
export async function removeCourseInstructor(
  payload: Payload,
  instructorId: string,
  courseId: string,
): Promise<void> {
  const assignments = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: instructorId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (assignments.docs.length > 0) {
    await payload.delete({
      collection: 'course-instructors',
      id: assignments.docs[0].id,
      overrideAccess: true,
    })
    logger.info(`Removed course-instructor assignment: ${instructorId} -> ${courseId}`)
  }
}

/**
 * Get all course-instructor assignments for an instructor
 */
export async function getInstructorAssignments(
  payload: Payload,
  instructorId: string,
): Promise<Array<{ courseId: string; role: string }>> {
  const assignments = await payload.find({
    collection: 'course-instructors',
    where: {
      instructor: { equals: instructorId },
    },
    limit: 100,
    overrideAccess: true,
  })

  return assignments.docs.map((doc) => ({
    courseId: doc.course as string,
    role: doc.role as string,
  }))
}

/**
 * Check if instructor is assigned to a course
 */
export async function isInstructorAssignedToCourse(
  payload: Payload,
  instructorId: string,
  courseId: string,
): Promise<boolean> {
  const assignments = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: instructorId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  return assignments.docs.length > 0
}
