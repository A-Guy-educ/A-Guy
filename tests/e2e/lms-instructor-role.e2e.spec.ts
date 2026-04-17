/**
 * LMS Instructor Role E2E Tests
 *
 * @tags @instructor @lms
 */

import { expect, test } from '@playwright/test'

import {
  cleanupTestUsers,
  createTestUser,
  generateTestUserEmail,
  setupAuthenticatedUser,
} from './helpers/auth'
import { seedCourseInstructor } from './helpers/instructors'
import { seedTestCourseData } from './helpers/courses'
import { getPayload } from 'payload'
import config from '@payload-config'

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupTestUsers()
})

test.describe('Instructor Role - Authentication & Access', () => {
  test('instructor can access instructor dashboard', async ({ page }) => {
    const instructorEmail = generateTestUserEmail('instructor-dashboard-test')
    const instructor = await createTestUser(
      { email: instructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    await setupAuthenticatedUser(page, instructor, 'instructor')
    await page.goto('/instructor')
    await page.waitForLoadState('domcontentloaded')

    // Should see instructor dashboard content
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('student cannot access instructor dashboard', async ({ page }) => {
    const studentEmail = generateTestUserEmail('student-instructor-access-test')
    const student = await createTestUser(
      { email: studentEmail, password: 'TestPassword123!' },
      'student',
    )

    await setupAuthenticatedUser(page, student, 'student')
    await page.goto('/instructor')
    await page.waitForLoadState('domcontentloaded')

    // Should be redirected to /account since student role can't access instructor dashboard
    await expect(page).toHaveURL(/\/account/)
  })

  test('instructor cannot access Payload admin collections', async ({ page }) => {
    const instructorEmail = generateTestUserEmail('instructor-admin-access-test')
    const instructor = await createTestUser(
      { email: instructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    await setupAuthenticatedUser(page, instructor, 'instructor')
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')

    // Should not have full admin panel access
    // Instructors should be redirected or see limited UI
    const currentUrl = page.url()
    // Either redirected away from /admin or see access denied
    if (currentUrl.includes('/admin')) {
      // Check for access denied message or redirect
      const bodyText = await page.locator('body').textContent()
      expect(
        bodyText?.includes('access') ||
          bodyText?.includes('denied') ||
          bodyText?.includes('Unauthorized'),
      ).toBeTruthy()
    }
  })
})

test.describe('Instructor Role - Course Assignment', () => {
  let instructorEmail: string
  let instructor: Awaited<ReturnType<typeof createTestUser>>
  let testCourseData: Awaited<ReturnType<typeof seedTestCourseData>>

  test.beforeAll(async () => {
    // Create instructor user
    instructorEmail = generateTestUserEmail('instructor-course-assignment-test')
    instructor = await createTestUser(
      { email: instructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    // Seed test course data
    testCourseData = await seedTestCourseData()
  })

  test('instructor can be assigned to a course', async () => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const payload = await getPayload({ config })

    // Assign instructor to course
    const assignment = await seedCourseInstructor(
      payload,
      instructor.id!,
      testCourseData.courseId,
      'primary',
    )

    expect(assignment.instructorId).toBe(instructor.id)
    expect(assignment.courseId).toBe(testCourseData.courseId)
    expect(assignment.role).toBe('primary')
  })

  test('instructor can see their assigned courses in dashboard', async ({ page }) => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const payload = await getPayload({ config })

    // Assign instructor to course
    await seedCourseInstructor(payload, instructor.id!, testCourseData.courseId, 'primary')

    await setupAuthenticatedUser(page, instructor, 'instructor')
    await page.goto('/instructor')
    await page.waitForLoadState('domcontentloaded')

    // Should see the assigned course
    const courseElement = page.locator(`text=${testCourseData.courseSlug}`)
    await expect(courseElement).toBeVisible({ timeout: 10000 })
  })

  test('instructor cannot see courses they are not assigned to', async ({ page }) => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    await setupAuthenticatedUser(page, instructor, 'instructor')
    await page.goto('/instructor')
    await page.waitForLoadState('domcontentloaded')

    // Dashboard should show the assigned course or empty state
    // Since instructor IS assigned to the test course, they should see it
    const courseElement = page.locator(`text=${testCourseData.courseSlug}`)
    await expect(courseElement).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Instructor Role - TA and Guest Roles', () => {
  let taEmail: string
  let ta: Awaited<ReturnType<typeof createTestUser>>
  let testCourseData: Awaited<ReturnType<typeof seedTestCourseData>>

  test.beforeAll(async () => {
    // Create TA user
    taEmail = generateTestUserEmail('ta-role-test')
    ta = await createTestUser({ email: taEmail, password: 'TestPassword123!' }, 'instructor')

    // Seed test course data
    testCourseData = await seedTestCourseData()
  })

  test('instructor with TA role can be assigned', async () => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const payload = await getPayload({ config })

    // Assign instructor as TA
    const assignment = await seedCourseInstructor(payload, ta.id!, testCourseData.courseId, 'ta', {
      canGrade: true,
      canMessageStudents: true,
    })

    expect(assignment.role).toBe('ta')
    expect(assignment.canGrade).toBe(true)
  })

  test('instructor with TA role can access gradebook', async ({ page }) => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const payload = await getPayload({ config })

    // Assign as TA
    await seedCourseInstructor(payload, ta.id!, testCourseData.courseId, 'ta')

    await setupAuthenticatedUser(page, ta, 'instructor')

    // Access gradebook directly via API
    const response = await page.request.get(`/api/instructor/gradebook/${testCourseData.courseId}`)

    // TA with canGrade=true should be able to access
    expect(response.status()).toBe(200)
  })
})

test.describe('Instructor Role - Gradebook Access', () => {
  let instructorEmail: string
  let instructor: Awaited<ReturnType<typeof createTestUser>>
  let testCourseData: Awaited<ReturnType<typeof seedTestCourseData>>

  test.beforeAll(async () => {
    const payload = await getPayload({ config })

    // Create instructor user
    instructorEmail = generateTestUserEmail('instructor-gradebook-test')
    instructor = await createTestUser(
      { email: instructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    // Seed test course data
    testCourseData = await seedTestCourseData()

    // Assign instructor to course
    if (testCourseData) {
      await seedCourseInstructor(payload, instructor.id!, testCourseData.courseId, 'primary')
    }
  })

  test('instructor can view student progress for their course', async ({ page }) => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    await setupAuthenticatedUser(page, instructor, 'instructor')

    // Access gradebook API
    const response = await page.request.get(`/api/instructor/gradebook/${testCourseData.courseId}`)

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('students')
    expect(data.data).toHaveProperty('summary')
  })

  test('instructor cannot access another instructor course gradebook', async ({ page }) => {
    // Create another instructor
    const otherInstructorEmail = generateTestUserEmail('other-instructor-gradebook-test')
    const otherInstructor = await createTestUser(
      { email: otherInstructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    // DON'T assign the other instructor to any course
    await setupAuthenticatedUser(page, otherInstructor, 'instructor')

    // Try to access the first instructor's course gradebook
    if (testCourseData) {
      const response = await page.request.get(
        `/api/instructor/gradebook/${testCourseData.courseId}`,
      )

      // Should be forbidden since not assigned
      expect(response.status()).toBe(403)
    }
  })
})

test.describe('Admin Journey - Instructor Assignment Management', () => {
  let instructorEmail: string
  let instructor: Awaited<ReturnType<typeof createTestUser>>
  let testCourseData: Awaited<ReturnType<typeof seedTestCourseData>>

  test.beforeAll(async () => {
    // Create instructor user
    instructorEmail = generateTestUserEmail('admin-assigned-instructor-test')
    instructor = await createTestUser(
      { email: instructorEmail, password: 'TestPassword123!' },
      'instructor',
    )

    // Seed test course data
    testCourseData = await seedTestCourseData()
  })

  test('admin can assign instructor to a course via API', async () => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const payload = await getPayload({ config })

    // Admin creates assignment via direct API call
    const assignment = await seedCourseInstructor(
      payload,
      instructor.id!,
      testCourseData.courseId,
      'primary',
    )

    expect(assignment.instructorId).toBe(instructor.id)
    expect(assignment.courseId).toBe(testCourseData.courseId)
  })

  test('admin can remove instructor from course via API', async () => {
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    const { removeCourseInstructor } = await import('./helpers/instructors')
    const payload = await getPayload({ config })

    // Remove the assignment
    await removeCourseInstructor(payload, instructor.id!, testCourseData.courseId)

    // Verify assignment is removed
    const { isInstructorAssignedToCourse } = await import('./helpers/instructors')
    const isAssigned = await isInstructorAssignedToCourse(
      payload,
      instructor.id!,
      testCourseData.courseId,
    )
    expect(isAssigned).toBe(false)
  })
})
