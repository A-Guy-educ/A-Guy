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
  timeSpentSeconds?: number
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

  // Build a set of relevant lesson/exercise IDs
  let relevantLessonIds: Set<string> | null = null
  let relevantExerciseIds: Set<string> | null = null
  // lesson type mapping: lessonId → type
  const lessonTypeMap: Map<string, string> = new Map()
  // lesson title mapping: lessonId → title
  const lessonTitleMap: Map<string, string> = new Map()
  // exercise → lesson mapping
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
      lessonTypeMap.set(lesson.id, (lesson as Record<string, any>).type || 'learning')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
      lessonTitleMap.set(lesson.id, ((lesson as Record<string, any>).title as string) || '')
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
  const allExerciseRecords = filteredRecords.filter(
    (r: ProgressRecord) => r.recordType === 'exercise',
  )

  // Time Spent (from UserStats)
  const timeSpent = userStats.totalTimeSpentSeconds || 0

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

  // Exams: average exercise scores for exercises belonging to exam-type lessons
  const examExerciseRecords = allExerciseRecords.filter((r: ProgressRecord) => {
    const parentLessonId = exerciseToLesson.get(r.recordId)
    if (!parentLessonId) return false
    return lessonTypeMap.get(parentLessonId) === 'exam'
  })
  const examRecordsWithScores = examExerciseRecords.filter(
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

  // Count exams practiced (unique exam-type lessons that have exercise records)
  const practicedExamLessonIds = new Set<string>()
  for (const r of examExerciseRecords) {
    const parentLessonId = exerciseToLesson.get(r.recordId)
    if (parentLessonId) practicedExamLessonIds.add(parentLessonId)
  }

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
    limit: 500,
    overrideAccess: true,
  })

  const askConversationsCount = conversationsResult.totalDocs

  // Count actual user messages across all conversations
  interface ConvMessage {
    role: string
    hidden?: boolean
  }
  let askQuestionsCount = 0

  // Build per-lesson chat question counts from conversations
  // contextKey format: "lessons:<lessonId>" or "exercises:<exerciseId>"
  const lessonChatCounts: Map<string, number> = new Map()

  for (const conv of conversationsResult.docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
    const messages = ((conv as any).messages as ConvMessage[]) || []
    const userMsgCount = messages.filter((m: ConvMessage) => m.role === 'user' && !m.hidden).length
    askQuestionsCount += userMsgCount

    // Map conversation to lesson for per-lesson chat counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field
    const contextKey = (conv as any).contextKey as string | undefined
    if (contextKey && userMsgCount > 0) {
      let lessonId: string | undefined

      if (contextKey.startsWith('lessons:')) {
        lessonId = contextKey.replace('lessons:', '')
      } else if (contextKey.startsWith('exercises:')) {
        const exerciseId = contextKey.replace('exercises:', '')
        lessonId = exerciseToLesson.get(exerciseId)
      }

      if (lessonId) {
        lessonChatCounts.set(lessonId, (lessonChatCounts.get(lessonId) || 0) + userMsgCount)
      }
    }
  }

  // Build practiced lessons list (only lessons with progress records)
  // Collect per-lesson time from lesson records
  const lessonTimeMap: Map<string, number> = new Map()
  const practicedLessonIds = new Set<string>()

  // Add lessons that have direct lesson records (with time)
  for (const r of lessonRecords) {
    practicedLessonIds.add(r.recordId)
    if (r.timeSpentSeconds) {
      lessonTimeMap.set(r.recordId, (lessonTimeMap.get(r.recordId) || 0) + r.timeSpentSeconds)
    }
  }
  // Add lessons that have exercise records
  for (const r of allExerciseRecords) {
    const parentLessonId = exerciseToLesson.get(r.recordId)
    if (parentLessonId) practicedLessonIds.add(parentLessonId)
  }

  // Split into practiced lessons (learning type) and practiced exams
  const practicedLessons: Array<{
    lessonId: string
    title: string
    timeSpentSeconds: number
    chatQuestions: number
  }> = []

  const practicedExams: Array<{
    lessonId: string
    title: string
    timeSpentSeconds: number
    chatQuestions: number
  }> = []

  for (const lessonId of practicedLessonIds) {
    const title = lessonTitleMap.get(lessonId)
    if (!title) continue // lesson not found in current scope

    const type = lessonTypeMap.get(lessonId) || 'learning'
    const chatQuestions = lessonChatCounts.get(lessonId) || 0
    const timeSpentSeconds = lessonTimeMap.get(lessonId) || 0

    const item = { lessonId, title, timeSpentSeconds, chatQuestions }

    if (type === 'exam') {
      practicedExams.push(item)
    } else {
      practicedLessons.push(item)
    }
  }

  // Sort by title
  practicedLessons.sort((a, b) => a.title.localeCompare(b.title))
  practicedExams.sort((a, b) => a.title.localeCompare(b.title))

  return Response.json({
    summary: {
      timeSpent,
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
        practiced: practicedExamLessonIds.size,
      },
      ask: {
        questionsAsked: askQuestionsCount,
        conversations: askConversationsCount,
      },
    },
    practicedLessons,
    practicedExams,
  })
}
