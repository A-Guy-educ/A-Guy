/**
 * Instructor Dashboard API
 *
 * @fileType api-route
 * @domain lms
 * @pattern instructor-dashboard
 * @ai-summary API for fetching instructor dashboard data
 */

import type { User } from 'payload'

import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { AccountRole } from '@/infra/auth/roles'
import { getInstructorCourseIds } from '@/server/payload/hooks/auth/instructorAccess'

// --- GET /api/instructor/dashboard ---

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || user.collection !== 'users') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const typedUser = user as User

    // Check if user is admin or instructor
    if (typedUser.role !== AccountRole.Instructor && typedUser.role !== AccountRole.Admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let courseIds: string[] = []

    // Admins see all courses (for now, show empty state for admin dashboard expansion later)
    if (typedUser.role === AccountRole.Admin) {
      // Admin dashboard will be expanded in future to show all courses with instructors
      courseIds = []
    } else {
      // Instructors see only their assigned courses
      courseIds = await getInstructorCourseIds(payload, String(typedUser.id))
    }

    if (courseIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          courses: [],
          totalStudents: 0,
          totalCourses: 0,
        },
      })
    }

    // Fetch courses
    const courses = await payload.find({
      collection: 'courses',
      where: {
        id: {
          in: courseIds,
        },
      },
      limit: 100,
      overrideAccess: true,
    })

    // Fetch total students across all courses
    const enrolledUsers = await payload.find({
      collection: 'users',
      where: {
        'courseEntitlements.course': {
          in: courseIds,
        },
      },
      limit: 1000,
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        courses: courses.docs.map((course) => ({
          id: course.id,
          title: course.title,
          slug: course.slug,
          courseLabel: course.courseLabel,
        })),
        totalStudents: enrolledUsers.totalDocs,
        totalCourses: courses.totalDocs,
      },
    })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/instructor/dashboard GET' })
  }
}
