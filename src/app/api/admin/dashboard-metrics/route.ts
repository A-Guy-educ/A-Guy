/**
 * Admin Dashboard Metrics API
 *
 * GET /api/admin/dashboard-metrics?period=week|month|year
 * Returns user statistics, content counts, and engagement metrics.
 * Admin-only — returns 403 for non-admin users.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export type Period = 'week' | 'month' | 'year'

/**
 * Extract a course ID from various possible formats:
 * - String ID (e.g., "abc123")
 * - Plain object with id property (e.g., { id: "abc123" })
 * - MongoDB ObjectId instance (has toString() but no .id property)
 *
 * Returns null if the course cannot be extracted or is falsy.
 */
export function extractCourseId(course: unknown): string | null {
  if (course === undefined || course === null) return null

  // String ID
  if (typeof course === 'string') return course

  // Plain object with id property (e.g., { id: "abc123" })
  if (typeof course === 'object' && 'id' in course) {
    const obj = course as { id: unknown }
    if (typeof obj.id === 'string') return obj.id
    // Handle case where id might be a number or other serializable value
    return String(obj.id) || null
  }

  // MongoDB ObjectId instance (has toString() but no .id property)
  if (
    typeof course === 'object' &&
    typeof (course as { toString?: () => string }).toString === 'function'
  ) {
    const result = String(course)
    // ObjectId.toString() returns something like "ObjectId('abc123')"
    // We need to extract just the ID part
    const match = result.match(/ObjectId\(['"]?([^'")]+)['"]?\)/)
    if (match) return match[1]
    // Fallback: if toString doesn't match ObjectId pattern, use it directly
    if (result && result !== '[object Object]') return result
  }

  // Fallback: try to stringify
  const str = String(course)
  return str && str !== '[object Object]' ? str : null
}

interface UserMetrics {
  activeUsersToday: number
  activeUsersYesterday: number
  registeredYesterday: number
  registeredThisWeek: number
  registeredLastWeek: number
  registeredThisMonth: number
  registeredLastMonth: number
  totalUsers: number
  totalGuestSessions: number
  guestToRegisteredCount: number
  returningUsers: number
  returningUsersTotal: number
}

interface CourseEnrollment {
  courseTitle: string
  count: number
}

interface EngagementMetrics {
  avgTimeSpentMinutes: number
  courseEnrollments: CourseEnrollment[]
  featureUsage: {
    questionsAsked: number
    conversationsStarted: number
    lessonsCompleted: number
    exercisesAttempted: number
    exercisesCompleted: number
  }
  lessonTypeUsage: {
    learning: number
    practice: number
    exam: number
  }
}

interface ContentCounts {
  courses: number
  lessons: number
  exercises: number
  formulaSheets: number
  prompts: number
}

export interface DashboardMetricsResponse {
  period: Period
  userMetrics: UserMetrics
  contentCounts: ContentCounts
  engagement: EngagementMetrics
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Fetch every matching doc via pagination — used for queries that need to
 * process all results in-process (e.g. for aggregation). Returns a flat array
 * of docs across all pages.
 */
async function findAll<T>(
  fetchPage: (page: number) => Promise<{ docs: T[]; hasNextPage: boolean; totalPages: number }>,
): Promise<T[]> {
  const results: T[] = []
  let page = 1
  // Cap at 20 pages (e.g. 20 * 500 = 10,000 docs) as a safety net against runaway loops.
  const maxPages = 20
  while (page <= maxPages) {
    const res = await fetchPage(page)
    results.push(...res.docs)
    if (!res.hasNextPage) break
    page++
  }
  return results
}

function getPeriodStart(now: Date, period: Period): Date {
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const period = (url.searchParams.get('period') || 'month') as Period
  if (!['week', 'month', 'year'].includes(period)) {
    return Response.json({ error: 'Invalid period' }, { status: 400 })
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const todayStart = startOfDay(now)
  const yesterdayStart = startOfDay(yesterday)

  const thisWeekStart = startOfWeek(now)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = new Date(thisMonthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)

  const periodStart = getPeriodStart(now, period)

  const [
    activeToday,
    activeYesterday,
    registeredYesterday,
    registeredThisWeek,
    registeredLastWeek,
    registeredThisMonth,
    registeredLastMonth,
    totalUsersResult,
    totalGuestsResult,
    guestClaimedResult,
    coursesCount,
    lessonsCount,
    exercisesCount,
    formulaSheetsCount,
    promptsCount,
    allUserStats,
    coursesWithTitles,
    usersWithEntitlements,
    learningLessons,
    practiceLessons,
    examLessons,
    returningUsersResult,
    totalUsersInPeriod,
  ] = await Promise.all([
    // Active users today/yesterday
    payload.find({
      collection: 'user-stats',
      where: { lastActiveDate: { equals: todayStr } },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'user-stats',
      where: { lastActiveDate: { equals: yesterdayStr } },
      limit: 0,
      overrideAccess: true,
    }),
    // Registration counts
    payload.find({
      collection: 'users',
      where: {
        createdAt: {
          greater_than_equal: yesterdayStart.toISOString(),
          less_than: todayStart.toISOString(),
        },
      },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'users',
      where: { createdAt: { greater_than_equal: thisWeekStart.toISOString() } },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'users',
      where: {
        createdAt: {
          greater_than_equal: lastWeekStart.toISOString(),
          less_than: thisWeekStart.toISOString(),
        },
      },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'users',
      where: { createdAt: { greater_than_equal: thisMonthStart.toISOString() } },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'users',
      where: {
        createdAt: {
          greater_than_equal: lastMonthStart.toISOString(),
          less_than: thisMonthStart.toISOString(),
        },
      },
      limit: 0,
      overrideAccess: true,
    }),
    // Total users
    payload.find({ collection: 'users', limit: 0, overrideAccess: true }),
    // Total guest sessions
    payload.find({ collection: 'guest-sessions', limit: 0, overrideAccess: true }),
    // Guests that converted
    payload.find({
      collection: 'guest-sessions',
      where: { claimedByUser: { exists: true } },
      limit: 0,
      overrideAccess: true,
    }),
    // Content counts
    payload.find({ collection: 'courses', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'lessons', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'exercises', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'formula-sheets', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'prompts', limit: 0, overrideAccess: true }),
    // Engagement: user-stats with time data — paginated to avoid truncation
    findAll<{ totalTimeSpentSeconds?: number; activityLog?: Array<{ actionType?: string }> }>(
      (page) =>
        payload.find({
          collection: 'user-stats',
          where: { totalTimeSpentSeconds: { greater_than: 0 } },
          limit: 500,
          page,
          overrideAccess: true,
          select: { totalTimeSpentSeconds: true, activityLog: true },
        }) as Promise<{
          docs: { totalTimeSpentSeconds?: number; activityLog?: Array<{ actionType?: string }> }[]
          hasNextPage: boolean
          totalPages: number
        }>,
    ),
    // Courses with titles (fetch all fields so we get id + title)
    payload.find({
      collection: 'courses',
      limit: 100,
      overrideAccess: true,
    }),
    // Users with course entitlements — paginated to avoid truncation
    findAll<{ courseEntitlements?: Array<{ course?: string | { id?: string } }> }>(
      (page) =>
        payload.find({
          collection: 'users',
          where: { 'courseEntitlements.course': { exists: true } },
          limit: 500,
          page,
          overrideAccess: true,
        }) as Promise<{
          docs: { courseEntitlements?: Array<{ course?: string | { id?: string } }> }[]
          hasNextPage: boolean
          totalPages: number
        }>,
    ),
    // Lesson type counts
    payload.find({
      collection: 'lessons',
      where: { type: { equals: 'learning' } },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'lessons',
      where: { type: { equals: 'practice' } },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'lessons',
      where: { type: { equals: 'exam' } },
      limit: 0,
      overrideAccess: true,
    }),
    // Returning users: users who were active in the selected period
    // (have a lastActiveDate >= periodStart)
    payload.find({
      collection: 'user-stats',
      where: {
        lastActiveDate: { greater_than_equal: periodStart.toISOString().split('T')[0] },
      },
      limit: 0,
      overrideAccess: true,
    }),
    // Users who registered before the period (existing users)
    payload.find({
      collection: 'users',
      where: { createdAt: { less_than: periodStart.toISOString() } },
      limit: 0,
      overrideAccess: true,
    }),
  ])

  // Calculate avg time spent (allUserStats is already a flat array from findAll)
  const statsWithTime = allUserStats
  const totalSeconds = statsWithTime.reduce((sum, s) => sum + (s.totalTimeSpentSeconds || 0), 0)
  const avgTimeMinutes =
    statsWithTime.length > 0 ? Math.round(totalSeconds / statsWithTime.length / 60) : 0

  // Aggregate feature usage from activityLog
  const featureUsage = {
    questionsAsked: 0,
    conversationsStarted: 0,
    lessonsCompleted: 0,
    exercisesAttempted: 0,
    exercisesCompleted: 0,
  }
  for (const stat of statsWithTime) {
    for (const entry of stat.activityLog || []) {
      switch (entry.actionType) {
        case 'question_asked':
          featureUsage.questionsAsked++
          break
        case 'conversation_started':
          featureUsage.conversationsStarted++
          break
        case 'lesson_completed':
          featureUsage.lessonsCompleted++
          break
        case 'exercise_attempted':
          featureUsage.exercisesAttempted++
          break
        case 'exercise_completed':
          featureUsage.exercisesCompleted++
          break
      }
    }
  }

  // Count enrollments per course ID (from entitlements)
  // usersWithEntitlements is already a flat array from findAll
  const enrollmentCounts = new Map<string, number>()
  for (const u of usersWithEntitlements) {
    for (const ent of u.courseEntitlements || []) {
      const courseId = extractCourseId(ent.course)
      if (!courseId) continue
      enrollmentCounts.set(courseId, (enrollmentCounts.get(courseId) || 0) + 1)
    }
  }

  // Explicitly fetch courses by the collected IDs to get their titles
  const uniqueCourseIds = Array.from(enrollmentCounts.keys())
  const courseIdToTitle = new Map<string, string>()
  const resolveTitle = (c: {
    id: string
    title?: string
    courseLabel?: string
    slug?: string
  }): string => {
    return c.title || c.courseLabel || c.slug || `Course ${String(c.id).slice(-6)}`
  }
  if (uniqueCourseIds.length > 0) {
    const enrolledCourses = await payload.find({
      collection: 'courses',
      where: { id: { in: uniqueCourseIds } },
      limit: uniqueCourseIds.length,
      overrideAccess: true,
    })
    for (const course of enrolledCourses.docs) {
      const c = course as unknown as {
        id: string
        title?: string
        courseLabel?: string
        slug?: string
      }
      courseIdToTitle.set(String(c.id), resolveTitle(c))
    }
  }
  // Populate map from the all-courses query for any IDs missed by the targeted query
  for (const course of coursesWithTitles.docs) {
    const c = course as unknown as {
      id: string
      title?: string
      courseLabel?: string
      slug?: string
    }
    const id = String(c.id)
    if (!courseIdToTitle.has(id)) {
      courseIdToTitle.set(id, resolveTitle(c))
    }
  }

  const courseEnrollments: CourseEnrollment[] = Array.from(enrollmentCounts.entries())
    .map(([id, count]) => ({
      // Client localizes "Deleted course" via the __DELETED__ marker
      courseTitle: courseIdToTitle.get(id) || `__DELETED__:${id.slice(-6)}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const response: DashboardMetricsResponse = {
    period,
    userMetrics: {
      activeUsersToday: activeToday.totalDocs,
      activeUsersYesterday: activeYesterday.totalDocs,
      registeredYesterday: registeredYesterday.totalDocs,
      registeredThisWeek: registeredThisWeek.totalDocs,
      registeredLastWeek: registeredLastWeek.totalDocs,
      registeredThisMonth: registeredThisMonth.totalDocs,
      registeredLastMonth: registeredLastMonth.totalDocs,
      totalUsers: totalUsersResult.totalDocs,
      totalGuestSessions: totalGuestsResult.totalDocs,
      guestToRegisteredCount: guestClaimedResult.totalDocs,
      returningUsers: returningUsersResult.totalDocs,
      returningUsersTotal: totalUsersInPeriod.totalDocs,
    },
    contentCounts: {
      courses: coursesCount.totalDocs,
      lessons: lessonsCount.totalDocs,
      exercises: exercisesCount.totalDocs,
      formulaSheets: formulaSheetsCount.totalDocs,
      prompts: promptsCount.totalDocs,
    },
    engagement: {
      avgTimeSpentMinutes: avgTimeMinutes,
      courseEnrollments,
      featureUsage,
      lessonTypeUsage: {
        learning: learningLessons.totalDocs,
        practice: practiceLessons.totalDocs,
        exam: examLessons.totalDocs,
      },
    },
  }

  return Response.json(response)
}
