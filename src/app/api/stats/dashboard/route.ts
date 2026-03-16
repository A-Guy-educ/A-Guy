/**
 * Stats Dashboard API
 *
 * GET /api/stats/dashboard
 * Returns aggregated dashboard data with course and timeframe filters
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const dashboardQuerySchema = z.object({
  courseId: z.string().optional(),
  timeframe: z.enum(['week', 'month', 'overall']).optional().default('overall'),
})

function getDateCutoff(timeframe: 'week' | 'month' | 'overall'): Date | null {
  if (timeframe === 'overall') return null

  const now = new Date()
  const days = timeframe === 'week' ? 7 : 30
  now.setDate(now.getDate() - days)
  return now
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Parse query params
  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId') || undefined
  const timeframe = (url.searchParams.get('timeframe') as 'week' | 'month' | 'overall') || 'overall'

  const validation = dashboardQuerySchema.safeParse({ courseId, timeframe })
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid query params', details: validation.error.flatten() },
      { status: 400 },
    )
  }

  const { courseId: filterCourseId, timeframe: filterTimeframe } = validation.data
  const dateCutoff = getDateCutoff(filterTimeframe)

  // Fetch UserStats
  const userStatsResult = await payload.find({
    collection: 'user-stats',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  const userStats = userStatsResult.docs[0] || {
    totalTimeSpentSeconds: 0,
    currentStreak: 0,
    longestStreak: 0,
  }

  // Fetch UserProgress for the user
  const userProgressResult = await payload.find({
    collection: 'user-progress',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  const userProgress = userProgressResult.docs[0]
  const progressRecords = userProgress?.progressRecords || []

  // If courseId is provided, filter to that course's lessons
  let relevantLessonIds: string[] | null = null
  if (filterCourseId) {
    // Get chapters for this course
    const chaptersResult = await payload.find({
      collection: 'chapters',
      where: {
        course: { equals: filterCourseId },
        status: { equals: 'published' },
        isActive: { equals: true },
      },
      limit: 100,
      overrideAccess: true,
    })

    const chapterIds = chaptersResult.docs.map((c) => c.id)

    if (chapterIds.length > 0) {
      // Get lessons for these chapters
      const lessonsResult = await payload.find({
        collection: 'lessons',
        where: {
          chapter: { in: chapterIds },
          status: { equals: 'published' },
          isActive: { equals: true },
        },
        limit: 500,
        overrideAccess: true,
      })

      relevantLessonIds = lessonsResult.docs.map((l) => l.id)
    }
  }

  // Filter progress records by course and timeframe
  let filteredRecords = progressRecords
  if (relevantLessonIds && relevantLessonIds.length > 0) {
    filteredRecords = filteredRecords.filter(
      (r) => r.recordType === 'lesson' && relevantLessonIds!.includes(r.recordId),
    )
  }

  // Filter by timeframe
  if (dateCutoff) {
    filteredRecords = filteredRecords.filter((r) => {
      if (!r.lastAccessedAt) return false
      return new Date(r.lastAccessedAt) >= dateCutoff
    })
  }

  // Calculate summary metrics
  // Total Progress: average completion percentage across lesson records
  const lessonRecords = filteredRecords.filter((r) => r.recordType === 'lesson')
  const totalProgress =
    lessonRecords.length > 0
      ? Math.round(
          lessonRecords.reduce((sum, r) => sum + (r.completionPercentage || 0), 0) /
            lessonRecords.length,
        )
      : 0

  // Time Spent (from UserStats)
  const timeSpent = userStats.totalTimeSpentSeconds || 0

  // Average Score: mean of scores from exercise records
  const exerciseRecords = filteredRecords.filter(
    (r) => r.recordType === 'exercise' && r.score !== null && r.score !== undefined,
  )
  const averageScore =
    exerciseRecords.length > 0
      ? Math.round(
          exerciseRecords.reduce((sum, r) => sum + (r.score || 0), 0) / exerciseRecords.length,
        )
      : 0

  // Daily Streak
  const dailyStreak = userStats.currentStreak || 0

  // Category Progress
  // Learn: completed lessons (filtered by date)
  const learnCount = lessonRecords.filter((r) => r.status === 'completed').length

  // Practice: exercise records
  const practiceAttempted = exerciseRecords.length
  const practiceCompleted = exerciseRecords.filter((r) => r.status === 'completed').length
  const practiceSuccessRate =
    practiceAttempted > 0 ? Math.round((practiceCompleted / practiceAttempted) * 100) : 0

  // Exams: exam lesson records (would need lesson type info - simplified here)
  const examRecords = progressRecords.filter((r) => r.recordType === 'lesson') // Would filter by lesson type='exam' in full impl
  const examAvgScore =
    examRecords.length > 0
      ? Math.round(examRecords.reduce((sum, r) => sum + (r.score || 0), 0) / examRecords.length)
      : 0

  // Ask: count conversations for this user (optionally filtered by course)
  const conversationWhere: Record<string, unknown> = {
    user: { equals: userId },
  }
  if (filterCourseId) {
    conversationWhere['contextRef'] = { equals: filterCourseId }
  }
  const conversationsResult = await payload.find({
    collection: 'conversations',
    where: conversationWhere as never,
    limit: 1000,
    overrideAccess: true,
  })

  const askQuestionsCount = conversationsResult.totalDocs
  const askConversationsCount = conversationsResult.docs.length

  // Topic Mastery - group exercise records by chapter
  // This is simplified - would need to look up lesson->chapter mapping
  const topicMastery: Array<{ chapterId: string; chapterTitle: string; successRate: number }> = []

  // For now, return empty array - full impl would need chapter lookup
  // Topic mastery formula from clarified.md: (correct / attempted) * 100

  return Response.json({
    summary: {
      totalProgress,
      timeSpent,
      averageScore,
      dailyStreak,
    },
    categoryProgress: {
      learn: {
        count: learnCount,
      },
      practice: {
        attempted: practiceAttempted,
        completed: practiceCompleted,
        successRate: practiceSuccessRate,
      },
      exams: {
        averageScore: examAvgScore,
      },
      ask: {
        questionsAsked: askQuestionsCount,
        conversations: askConversationsCount,
      },
    },
    topicMastery,
  })
}
