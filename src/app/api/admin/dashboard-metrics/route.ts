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
    // Engagement: user-stats with time data
    payload.find({
      collection: 'user-stats',
      where: { totalTimeSpentSeconds: { greater_than: 0 } },
      limit: 500,
      overrideAccess: true,
      select: { totalTimeSpentSeconds: true, activityLog: true },
    }),
    // Courses with titles (fetch all fields so we get id + title)
    payload.find({
      collection: 'courses',
      limit: 100,
      overrideAccess: true,
    }),
    // Users with course entitlements (populate course relationship)
    payload.find({
      collection: 'users',
      where: { 'courseEntitlements.course': { exists: true } },
      limit: 500,
      overrideAccess: true,
      depth: 1,
    }),
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

  // Calculate avg time spent
  const statsWithTime = allUserStats.docs as Array<{
    totalTimeSpentSeconds?: number
    activityLog?: Array<{ actionType?: string }>
  }>
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

  // Course enrollment distribution — build ID→title map
  const courseIdToTitle = new Map<string, string>()
  for (const course of coursesWithTitles.docs) {
    const c = course as unknown as { id: string; title?: string; courseLabel?: string }
    const id = String(c.id)
    const title = c.title || c.courseLabel || 'Untitled'
    courseIdToTitle.set(id, title)
  }

  // Count enrollments — with depth:1, course is populated as object with title
  const enrollmentCounts = new Map<string, number>()
  const enrollmentTitles = new Map<string, string>()
  for (const user of usersWithEntitlements.docs) {
    const u = user as unknown as {
      courseEntitlements?: Array<{
        course?: string | { id: string; title?: string; courseLabel?: string }
      }>
    }
    for (const ent of u.courseEntitlements || []) {
      if (!ent.course) continue
      let courseId: string
      let courseTitle: string | undefined
      if (typeof ent.course === 'object') {
        courseId = String(ent.course.id)
        courseTitle = ent.course.title || ent.course.courseLabel
      } else {
        courseId = String(ent.course)
      }
      if (!courseId) continue
      enrollmentCounts.set(courseId, (enrollmentCounts.get(courseId) || 0) + 1)
      if (courseTitle) enrollmentTitles.set(courseId, courseTitle)
    }
  }

  const courseEnrollments: CourseEnrollment[] = Array.from(enrollmentCounts.entries())
    .map(([id, count]) => ({
      courseTitle: enrollmentTitles.get(id) || courseIdToTitle.get(id) || 'Unknown',
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
