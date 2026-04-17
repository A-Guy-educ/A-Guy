/**
 * Instructor Access Control Hooks
 *
 * @fileType hook
 * @domain auth
 * @pattern rbac, instructor-permissions
 * @ai-summary Helper functions for checking instructor role and per-course permissions
 */

import type { Payload } from 'payload'

import { AccountRole } from '@/infra/auth/roles'

/**
 * Type representing a User from the users collection
 */
export interface InstructorUser {
  id: string
  role: AccountRole
  collection: 'users'
}

/**
 * Check if a user has the instructor role
 */
export function isInstructor(user: InstructorUser | null | undefined): boolean {
  return user?.role === AccountRole.Instructor
}

/**
 * Check if a user has the admin role
 */
export function isAdminUser(user: InstructorUser | null | undefined): boolean {
  return user?.role === AccountRole.Admin
}

/**
 * Check if a user is an instructor for a specific course
 */
export async function isInstructorForCourse(
  payload: Payload,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const assignment = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: userId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  return assignment.docs.length > 0
}

/**
 * Check if a user can grade for a specific course
 */
export async function canInstructorGrade(
  payload: Payload,
  userId: string,
  courseId: string,
): Promise<boolean> {
  if (!userId || !courseId) return false

  const assignment = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: userId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (assignment.docs.length === 0) return false
  return assignment.docs[0].canGrade ?? false
}

/**
 * Check if a user can message students in a specific course
 */
export async function canInstructorMessageStudents(
  payload: Payload,
  userId: string,
  courseId: string,
): Promise<boolean> {
  if (!userId || !courseId) return false

  const assignment = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: userId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (assignment.docs.length === 0) return false
  return assignment.docs[0].canMessageStudents ?? false
}

/**
 * Get all course IDs where a user is an instructor
 */
export async function getInstructorCourseIds(payload: Payload, userId: string): Promise<string[]> {
  const assignments = await payload.find({
    collection: 'course-instructors',
    where: {
      instructor: { equals: userId },
    },
    limit: 100,
    overrideAccess: true,
  })
  return assignments.docs.map((doc) => doc.course as string)
}

/**
 * Get the instructor role for a user in a specific course
 */
export async function getInstructorRoleForCourse(
  payload: Payload,
  userId: string,
  courseId: string,
): Promise<'primary' | 'ta' | 'guest' | null> {
  const assignment = await payload.find({
    collection: 'course-instructors',
    where: {
      and: [{ instructor: { equals: userId } }, { course: { equals: courseId } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (assignment.docs.length === 0) return null
  return (assignment.docs[0].role as 'primary' | 'ta' | 'guest') ?? null
}
