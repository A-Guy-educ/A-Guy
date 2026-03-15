/**
 * Entitlement check service
 *
 * @fileType service
 * @domain entitlements
 * @ai-summary Checks if a user has access to paid courses/lessons
 */

import type { Payload, Where } from 'payload'

interface CheckEntitlementParams {
  payload: Payload
  userId: string
  courseId?: string
  lessonId?: string
}

/**
 * Check if a user has an entitlement for a course or lesson.
 * - Course entitlement covers all lessons in that course.
 * - Lesson entitlement covers only that specific lesson.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
  lessonId,
}: CheckEntitlementParams): Promise<boolean> {
  const now = new Date().toISOString()
  const conditions: Where[] = []

  if (courseId) {
    conditions.push({
      and: [
        { user: { equals: userId } },
        { contentType: { equals: 'course' } },
        { course: { equals: courseId } },
      ],
    })
  }

  if (lessonId) {
    conditions.push({
      and: [
        { user: { equals: userId } },
        { contentType: { equals: 'lesson' } },
        { lesson: { equals: lessonId } },
      ],
    })
  }

  if (conditions.length === 0) return false

  const result = await payload.find({
    collection: 'user-entitlements',
    where: {
      and: [
        { or: conditions },
        {
          or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: now } }],
        },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.totalDocs > 0
}
