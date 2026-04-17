/**
 * Instructor Gradebook API
 *
 * @fileType api-route
 * @domain lms
 * @pattern instructor-gradebook
 * @ai-summary API for instructors to view student grades for their assigned courses
 */

import type { Payload, User } from 'payload'

import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { AccountRole } from '@/infra/auth/roles'
import {
  canInstructorGrade,
  isInstructorForCourse,
} from '@/server/payload/hooks/auth/instructorAccess'

/**
 * Check if user is admin
 */
function isAdmin(user: User | null | undefined): boolean {
  return user?.role === AccountRole.Admin
}

// --- GET /api/instructor/gradebook/[courseId] ---

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    const { courseId } = await params
    const courseIdStr = String(courseId)

    if (!user || user.collection !== 'users') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const typedUser = user as User
    const userIdStr = String(typedUser.id)

    // Admins can view any course's gradebook
    if (isAdmin(typedUser)) {
      const gradebookData = await fetchGradebookData(payload, courseIdStr)
      return NextResponse.json({ success: true, data: gradebookData })
    }

    // Instructors must be assigned to the course to view grades
    const isAssigned = await isInstructorForCourse(payload, userIdStr, courseIdStr)
    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not an instructor for this course' },
        { status: 403 },
      )
    }

    // Check if instructor can grade
    const canGradePermission = await canInstructorGrade(payload, userIdStr, courseIdStr)
    if (!canGradePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to view grades for this course' },
        { status: 403 },
      )
    }

    const gradebookData = await fetchGradebookData(payload, courseIdStr)
    return NextResponse.json({ success: true, data: gradebookData })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/instructor/gradebook/[courseId] GET' })
  }
}

interface GradebookData {
  courseId: string
  students: Array<{
    userId: string
    name: string
    email: string
    progressRecords: Array<{
      recordType: string
      recordId: string
      completionPercentage: number
      status: string
      score?: number
    }>
  }>
  summary: {
    totalStudents: number
    averageCompletion: number
    averageScore: number
  }
}

async function fetchGradebookData(payload: Payload, courseId: string): Promise<GradebookData> {
  // Get all users enrolled in this course via courseEntitlements
  const enrolledUsers = await payload.find({
    collection: 'users',
    where: {
      'courseEntitlements.course': {
        equals: courseId,
      },
    },
    limit: 100,
    overrideAccess: true,
  })

  // Get user progress for these users
  const userProgress = await payload.find({
    collection: 'user-progress',
    where: {
      and: [
        {
          user: {
            in: enrolledUsers.docs.map((u) => u.id),
          },
        },
      ],
    },
    limit: 100,
    overrideAccess: true,
  })

  // Build progress map: userId -> progressRecords
  const progressMap = new Map<string, typeof userProgress.docs[0]['progressRecords']>()
  for (const progress of userProgress.docs) {
    if (progress.user && typeof progress.user === 'object') {
      const userObj = progress.user as { id?: string }
      const userId = userObj.id || (progress.user as unknown as string)
      progressMap.set(userId, progress.progressRecords || [])
    }
  }

  const students = enrolledUsers.docs.map((user) => {
    const records = progressMap.get(user.id) || []
    return {
      userId: user.id,
      name: user.name || 'Unknown',
      email: user.email || '',
      progressRecords: records.map((r) => ({
        recordType: r.recordType || 'lesson',
        recordId: r.recordId || '',
        completionPercentage: r.completionPercentage ?? 0,
        status: r.status || 'not_started',
        score: r.score ?? undefined,
      })),
    }
  })

  // Calculate summary statistics
  let totalCompletion = 0
  let totalScore = 0
  let completionCount = 0
  let scoreCount = 0

  for (const student of students) {
    for (const record of student.progressRecords) {
      totalCompletion += record.completionPercentage
      completionCount++
      if (record.score !== undefined && record.score !== null) {
        totalScore += record.score
        scoreCount++
      }
    }
  }

  return {
    courseId,
    students,
    summary: {
      totalStudents: students.length,
      averageCompletion: completionCount > 0 ? Math.round(totalCompletion / completionCount) : 0,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
    },
  }
}