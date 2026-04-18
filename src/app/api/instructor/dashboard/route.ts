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

    // Admins get a supervisory overview of all courses with instructor assignments
    if (typedUser.role === AccountRole.Admin) {
      // Fetch all courses
      const allCourses = await payload.find({
        collection: 'courses',
        limit: 1000,
        overrideAccess: true,
      })

      // Fetch all course-instructor assignments with populated instructor
      const allAssignments = await payload.find({
        collection: 'course-instructors',
        limit: 1000,
        depth: 1,
        overrideAccess: true,
      })

      // Build a map of courseId -> instructors
      const instructorsByCourse = new Map<
        string,
        Array<{ id: string; name: string; role: 'primary' | 'ta' | 'guest' }>
      >()
      for (const assignment of allAssignments.docs) {
        const courseId = assignment.course as string
        if (!courseId) continue
        const instructorUser = assignment.instructor as { id: string; name?: string } | null
        if (!instructorUser) continue
        const existing = instructorsByCourse.get(courseId) ?? []
        existing.push({
          id: instructorUser.id,
          name: instructorUser.name ?? 'Unknown',
          role: (assignment.role as 'primary' | 'ta' | 'guest') ?? 'guest',
        })
        instructorsByCourse.set(courseId, existing)
      }

      // Fetch total students across all courses
      const enrolledUsers = await payload.find({
        collection: 'users',
        where: {
          'courseEntitlements.course': {
            in: allCourses.docs.map((c) => c.id),
          },
        },
        limit: 1000,
        overrideAccess: true,
      })

      return NextResponse.json({
        success: true,
        data: {
          courses: allCourses.docs.map((course) => ({
            id: course.id,
            title: course.title,
            slug: course.slug,
            courseLabel: course.courseLabel,
            instructors: instructorsByCourse.get(course.id) ?? [],
          })),
          totalStudents: enrolledUsers.totalDocs,
          totalCourses: allCourses.totalDocs,
        },
      })
    }

    // Instructor branch: only their assigned courses
    const courseIds = await getInstructorCourseIds(payload, String(typedUser.id))

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
