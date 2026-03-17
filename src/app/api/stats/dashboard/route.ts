/**
 * Stats Dashboard API
 *
 * GET /api/stats/dashboard
 * Returns aggregated dashboard data with course and timeframe filters
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

/** Progress record shape from Payload's user-progress collection (dynamic field) */
interface ProgressRecord {
  recordType: string
  recordId: string
  status: string
  completionPercentage?: number
  score?: number | null
  lastAccessedAt?: string
}

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

  // Auth check
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

  // Fetch UserStats + UserProgress in parallel
  const [userStatsResult, userProgressResult] = await Promise.all([
    payload.find({
      collection: 'user-stats',
      where: { user: { equals: userId } },
      limit: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'user-progress',
      where: { user: { equals: userId } },
      limit: 1,
      overrideAccess: true,
    }),
  ])

  const userStats = userStatsResult.docs[0] || {
    totalTimeSpentSeconds: 0,
    currentStreak: 0,
    longestStreak: 0,
  }

  const userProgress = userProgressResult.docs[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
  const progressRecords: ProgressRecord[] = (userProgress as any)?.progressRecords || []

  // Build a set of relevant lesson/exercise IDs and chapter→lesson mapping if course filter is set
  let relevantLessonIds: Set<string> | null = null
  let relevantExerciseIds: Set<string> | null = null
  // chapter data: chapterId → { title, lessonIds }
  const chapterMap: Map<string, { title: string; lessonIds: string[] }> = new Map()
  // lesson → chapter mapping
  const lessonToChapter: Map<string, string> = new Map()
  // lesson type mapping: lessonId → type
  const lessonTypeMap: Map<string, string> = new Map()
  // exercise → lesson mapping for topic mastery
  const exerciseToLesson: Map<string, string> = new Map()

  // Fetch chapters (optionally filtered by course)
  const chaptersWhere: Record<string, unknown> = {
    status: { equals: 'published' },
    isActive: { equals: true },
  }
  if (filterCourseId) {
    chaptersWhere['course'] = { equals: filterCourseId }
  }

  const chaptersResult = await payload.find({
    collection: 'chapters',
    where: chaptersWhere as never,
    limit: 100,
    overrideAccess: true,
  })

  const chapterIds = chaptersResult.docs.map((c) => c.id)
  for (const chapter of chaptersResult.docs) {
    chapterMap.set(chapter.id, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
      title: ((chapter as Record<string, any>).title as string) || '',
      lessonIds: [],
    })
  }

  if (chapterIds.length > 0) {
    // Fetch lessons for these chapters
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

    const lessonIds = lessonsResult.docs.map((l) => l.id)
    relevantLessonIds = new Set(lessonIds)

    for (const lesson of lessonsResult.docs) {
      const chapterId =
        typeof lesson.chapter === 'string'
          ? lesson.chapter
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload relation can be string or object
            (lesson.chapter as Record<string, any>)?.id
      if (chapterId) {
        lessonToChapter.set(lesson.id, chapterId)
        const chapterEntry = chapterMap.get(chapterId)
        if (chapterEntry) {
          chapterEntry.lessonIds.push(lesson.id)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
      lessonTypeMap.set(lesson.id, (lesson as Record<string, any>).type || 'learning')
    }

    // Fetch exercises for these lessons and build exercise→lesson mapping
    if (lessonIds.length > 0) {
      const exercisesResult = await payload.find({
        collection: 'exercises',
        where: {
          lesson: { in: lessonIds },
        },
        limit: 1000,
        overrideAccess: true,
      })
      relevantExerciseIds = new Set(exercisesResult.docs.map((e) => e.id))

      // Build exercise→lesson mapping for topic mastery
      for (const exercise of exercisesResult.docs) {
        const exLessonId =
          typeof exercise.lesson === 'string'
            ? exercise.lesson
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload relation can be string or object
              (exercise.lesson as Record<string, any>)?.id
        if (exLessonId) {
          exerciseToLesson.set(exercise.id, exLessonId)
        }
      }
    }
  }

  // Filter progress records by relevance and timeframe
  let filteredRecords = progressRecords

  // Filter by course (include both lesson and exercise records)
  if (relevantLessonIds || relevantExerciseIds) {
    filteredRecords = filteredRecords.filter((r: ProgressRecord) => {
      if (r.recordType === 'lesson') {
        return !relevantLessonIds || relevantLessonIds.has(r.recordId)
      }
      if (r.recordType === 'exercise') {
        return !relevantExerciseIds || relevantExerciseIds.has(r.recordId)
      }
      return true
    })
  }

  // Filter by timeframe
  if (dateCutoff) {
    filteredRecords = filteredRecords.filter((r: ProgressRecord) => {
      if (!r.lastAccessedAt) return false
      return new Date(r.lastAccessedAt) >= dateCutoff
    })
  }

  // Calculate summary metrics
  const lessonRecords = filteredRecords.filter((r: ProgressRecord) => r.recordType === 'lesson')
  const exerciseRecords = filteredRecords.filter(
    (r: ProgressRecord) => r.recordType === 'exercise' && r.score !== null && r.score !== undefined,
  )

  // Total Progress: average completion percentage across lesson records
  const totalProgress =
    lessonRecords.length > 0
      ? Math.round(
          lessonRecords.reduce(
            (sum: number, r: ProgressRecord) => sum + (r.completionPercentage || 0),
            0,
          ) / lessonRecords.length,
        )
      : 0

  // Time Spent (from UserStats)
  const timeSpent = userStats.totalTimeSpentSeconds || 0

  // Average Score: mean of scores from exercise records
  const averageScore =
    exerciseRecords.length > 0
      ? Math.round(
          exerciseRecords.reduce((sum: number, r: ProgressRecord) => sum + (r.score || 0), 0) /
            exerciseRecords.length,
        )
      : 0

  // Daily Streak
  const dailyStreak = userStats.currentStreak || 0

  // Category Progress
  const learnCount = lessonRecords.filter((r: ProgressRecord) => r.status === 'completed').length
  const totalLessons = relevantLessonIds ? relevantLessonIds.size : 0

  const practiceAttempted = exerciseRecords.length
  const practiceCompleted = exerciseRecords.filter(
    (r: ProgressRecord) => r.status === 'completed',
  ).length
  const practiceSuccessRate =
    practiceAttempted > 0 ? Math.round((practiceCompleted / practiceAttempted) * 100) : 0

  // Exams: filter lesson records that belong to exam-type lessons
  const examLessonRecords = lessonRecords.filter((r: ProgressRecord) => {
    const lessonType = lessonTypeMap.get(r.recordId)
    return lessonType === 'exam'
  })
  // For exams, use the average score of exam-type lesson records
  const examRecordsWithScores = examLessonRecords.filter(
    (r: ProgressRecord) => r.score !== null && r.score !== undefined,
  )
  const examAvgScore =
    examRecordsWithScores.length > 0
      ? Math.round(
          examRecordsWithScores.reduce(
            (sum: number, r: ProgressRecord) => sum + (r.score || 0),
            0,
          ) / examRecordsWithScores.length,
        )
      : 0

  // Ask: count conversations and actual user messages
  const conversationWhere: Record<string, unknown> = {
    user: { equals: userId },
  }
  if (filterCourseId) {
    conversationWhere['contextRef.value'] = { equals: filterCourseId }
  }
  const conversationsResult = await payload.find({
    collection: 'conversations',
    where: conversationWhere as never,
    limit: 100, // Fetch conversations to count messages
    overrideAccess: true,
  })

  const askConversationsCount = conversationsResult.totalDocs

  // Count actual user messages across all conversations
  interface ConvMessage {
    role: string
    hidden?: boolean
  }
  let askQuestionsCount = 0
  for (const conv of conversationsResult.docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
    const messages = ((conv as any).messages as ConvMessage[]) || []
    askQuestionsCount += messages.filter((m: ConvMessage) => m.role === 'user' && !m.hidden).length
  }

  // Topic Mastery: group both lesson and exercise records by chapter
  const chapterExerciseStats = new Map<string, { attempted: number; completed: number }>()

  // Group lesson records by chapter
  for (const record of lessonRecords) {
    const chapterId = lessonToChapter.get(record.recordId)
    if (!chapterId) continue

    const stats = chapterExerciseStats.get(chapterId) || { attempted: 0, completed: 0 }
    stats.attempted++
    if (record.status === 'completed') {
      stats.completed++
    }
    chapterExerciseStats.set(chapterId, stats)
  }

  // Include exercise records - map exercise→lesson→chapter
  const allExerciseRecords = filteredRecords.filter(
    (r: ProgressRecord) => r.recordType === 'exercise',
  )
  for (const record of allExerciseRecords) {
    const lessonId = exerciseToLesson.get(record.recordId)
    if (!lessonId) continue
    const chapterId = lessonToChapter.get(lessonId)
    if (!chapterId) continue

    const stats = chapterExerciseStats.get(chapterId) || { attempted: 0, completed: 0 }
    stats.attempted++
    if (record.status === 'completed') {
      stats.completed++
    }
    chapterExerciseStats.set(chapterId, stats)
  }

  const topicMastery: Array<{ chapterId: string; chapterTitle: string; successRate: number }> = []

  for (const [chapterId, stats] of chapterExerciseStats) {
    const chapterInfo = chapterMap.get(chapterId)
    if (!chapterInfo || stats.attempted === 0) continue

    topicMastery.push({
      chapterId,
      chapterTitle: chapterInfo.title,
      successRate: Math.round((stats.completed / stats.attempted) * 100),
    })
  }

  // Sort by success rate ascending (weakest topics first)
  topicMastery.sort((a, b) => a.successRate - b.successRate)

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
        total: totalLessons,
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
