/**
 * Admin Dashboard Metrics API
 *
 * GET /api/admin/dashboard-metrics
 * Returns user statistics, content counts, and engagement metrics for admin dashboard widgets.
 * Admin-only — returns 403 for non-admin users.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

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
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
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
    _lessonsByType,
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
    // Guests that converted (claimed by a user)
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
    // Engagement: avg time (fetch user-stats with time data)
    payload.find({
      collection: 'user-stats',
      where: { totalTimeSpentSeconds: { greater_than: 0 } },
      limit: 500,
      overrideAccess: true,
      select: { totalTimeSpentSeconds: true, activityLog: true },
    }),
    // Courses with titles for enrollment distribution
    payload.find({
      collection: 'courses',
      limit: 100,
      overrideAccess: true,
      select: { title: true },
    }),
    // Users with course entitlements
    payload.find({
      collection: 'users',
      where: { 'courseEntitlements.course': { exists: true } },
      limit: 500,
      overrideAccess: true,
      select: { courseEntitlements: true },
    }),
    // Lessons by type for lesson type usage
    payload.find({
      collection: 'lessons',
      limit: 0,
      overrideAccess: true,
      select: { type: true },
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

  // Course enrollment distribution
  const courseIdToTitle = new Map<string, string>()
  for (const course of coursesWithTitles.docs as Array<{ id: string; title?: string }>) {
    courseIdToTitle.set(course.id, course.title || 'Untitled')
  }

  const enrollmentCounts = new Map<string, number>()
  for (const user of usersWithEntitlements.docs as Array<{
    courseEntitlements?: Array<{ course?: string | { id: string } }>
  }>) {
    for (const ent of user.courseEntitlements || []) {
      const courseId = typeof ent.course === 'string' ? ent.course : ent.course?.id
      if (courseId) {
        enrollmentCounts.set(courseId, (enrollmentCounts.get(courseId) || 0) + 1)
      }
    }
  }

  const courseEnrollments: CourseEnrollment[] = Array.from(enrollmentCounts.entries())
    .map(([id, count]) => ({
      courseTitle: courseIdToTitle.get(id) || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)

  // Lesson type counts (from total lessons, not user progress)
  const lessonTypeCounts = { learning: 0, practice: 0, exam: 0 }
  // lessonsByType has totalDocs but we need per-type counts
  // We'll do separate counts since we already have totalDocs
  const learningLessons = await payload.find({
    collection: 'lessons',
    where: { type: { equals: 'learning' } },
    limit: 0,
    overrideAccess: true,
  })
  const practiceLessons = await payload.find({
    collection: 'lessons',
    where: { type: { equals: 'practice' } },
    limit: 0,
    overrideAccess: true,
  })
  const examLessons = await payload.find({
    collection: 'lessons',
    where: { type: { equals: 'exam' } },
    limit: 0,
    overrideAccess: true,
  })
  lessonTypeCounts.learning = learningLessons.totalDocs
  lessonTypeCounts.practice = practiceLessons.totalDocs
  lessonTypeCounts.exam = examLessons.totalDocs

  const response: DashboardMetricsResponse = {
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
      lessonTypeUsage: lessonTypeCounts,
    },
  }

  return Response.json(response)
}
