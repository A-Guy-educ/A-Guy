/**
 * User Learning Context Service
 *
 * Aggregates user learning data for injection into the agent's system prompt.
 * Fetches progress, activity, and study plans to personalize agent responses.
 */

import type { Payload } from 'payload'

import { logger } from '@/infra/utils/logger'

/**
 * Active course with progress
 */
export interface ActiveCourseProgress {
  courseId: string
  courseTitle: string
  progressPercentage: number
}

/**
 * Recent activity entry
 */
export interface RecentActivity {
  type: string
  label: string
  timestamp: string
}

/**
 * Study plan snapshot
 */
interface StudyPlanSnapshot {
  courseId: string
  examDate: string
  generatedAt: string
  topics: Array<{
    topicId: string
    topicLabel: string
    mastery: 'weak' | 'medium' | 'strong'
  }>
  days: Array<{
    dayId: string
    date: string
    activityType: string
    topicIds: string[]
    status: 'planned' | 'completed'
    estimatedDurationMinutes: number
  }>
}

/**
 * User learning context for agent prompt injection
 */
export interface UserLearningContext {
  activeCourses: ActiveCourseProgress[]
  completedLessons: number
  completedChapters: number
  totalExercisesCompleted: number
  averageScore: number | null
  recentActivity: RecentActivity[]
  currentStreak: number
  studyPlan: StudyPlanSnapshot | null
}

/**
 * UserProgress record type
 */
interface ProgressRecord {
  recordType: string
  recordId: string
  completionPercentage?: number | null
  status?: string
  score?: number | null
  lastAccessedAt?: string | null
}

/**
 * UserProgress document
 */
interface UserProgressDoc {
  id: string
  user: string
  gradeLevel: string
  progressRecords?: ProgressRecord[]
  studyPlans?: StudyPlanSnapshot[]
}

/**
 * Fetch user learning context for prompt injection
 */
export async function fetchUserLearningContext(
  payload: Payload,
  userId: string,
  gradeLevel: string,
): Promise<UserLearningContext> {
  const log = logger.child({ module: 'UserLearningContext', userId })

  try {
    // Fetch user progress document
    const progressResult = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'user-progress' as any,
      where: {
        and: [{ user: { equals: userId } }, { gradeLevel: { equals: gradeLevel } }],
      },
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })

    const progressDoc = progressResult.docs[0] as UserProgressDoc | undefined

    if (!progressDoc || !progressDoc.progressRecords) {
      log.debug('No progress records found for user')
      return {
        activeCourses: [],
        completedLessons: 0,
        completedChapters: 0,
        totalExercisesCompleted: 0,
        averageScore: null,
        recentActivity: [],
        currentStreak: 0,
        studyPlan: null,
      }
    }

    const records = progressDoc.progressRecords || []
    const studyPlans = progressDoc.studyPlans || []

    // Calculate completed counts
    const completedLessons = records.filter(
      (r) => r.recordType === 'lesson' && r.status === 'completed',
    ).length
    const completedChapters = records.filter(
      (r) => r.recordType === 'chapter' && r.status === 'completed',
    ).length
    const totalExercisesCompleted = records.filter(
      (r) => r.recordType === 'exercise' && r.status === 'completed',
    ).length

    // Calculate average score
    const scoredRecords = records.filter((r) => r.score != null)
    const averageScore =
      scoredRecords.length > 0
        ? scoredRecords.reduce((sum, r) => sum + (r.score || 0), 0) / scoredRecords.length
        : null

    // Fetch active courses from progress records
    const activeCourses = await fetchActiveCoursesFromProgress(payload, records, log)

    // Get recent activity (last 10 items accessed)
    const recentActivity = records
      .filter((r) => r.lastAccessedAt)
      .sort((a, b) => {
        const dateA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0
        const dateB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 10)
      .map((r) => ({
        type: r.recordType,
        label: r.recordId,
        timestamp: r.lastAccessedAt || '',
      }))

    // Calculate learning streak (consecutive days with activity)
    const currentStreak = calculateStreak(records)

    // Get most recent study plan
    const studyPlan = studyPlans.length > 0 ? studyPlans[0] : null

    return {
      activeCourses,
      completedLessons,
      completedChapters,
      totalExercisesCompleted,
      averageScore: averageScore !== null ? Math.round(averageScore) : null,
      recentActivity,
      currentStreak,
      studyPlan,
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch user learning context')
    // Return empty context on error - agent will work without personalization
    return {
      activeCourses: [],
      completedLessons: 0,
      completedChapters: 0,
      totalExercisesCompleted: 0,
      averageScore: null,
      recentActivity: [],
      currentStreak: 0,
      studyPlan: null,
    }
  }
}

/**
 * Fetch active courses from progress records
 */
async function fetchActiveCoursesFromProgress(
  payload: Payload,
  records: ProgressRecord[],
  log: typeof logger,
): Promise<ActiveCourseProgress[]> {
  try {
    // Get unique course IDs from chapter progress
    const chapterRecords = records.filter((r) => r.recordType === 'chapter')

    if (chapterRecords.length === 0) {
      return []
    }

    // Fetch chapters to get course relationships
    const chapterIds = chapterRecords.map((r) => r.recordId)
    const chaptersResult = await payload.find({
      collection: 'chapters',
      where: { id: { in: chapterIds } },
      depth: 1,
      limit: 100,
      overrideAccess: true,
    })

    // Get unique courses
    const courseMap = new Map<string, { title: string; progressSum: number; count: number }>()
    for (const chapter of chaptersResult.docs) {
      const chapterDoc = chapter as { id: string; course?: string | { id: string; title?: string } }
      if (!chapterDoc.course) continue

      const courseId =
        typeof chapterDoc.course === 'string' ? chapterDoc.course : chapterDoc.course.id
      const courseTitle =
        typeof chapterDoc.course === 'object' && chapterDoc.course?.title
          ? chapterDoc.course.title
          : 'Unknown Course'

      const chapterProgress = chapterRecords.find((r) => r.recordId === chapterDoc.id)
      const progress = chapterProgress?.completionPercentage || 0

      const existing = courseMap.get(courseId)
      if (existing) {
        existing.progressSum += progress
        existing.count += 1
      } else {
        courseMap.set(courseId, { title: courseTitle, progressSum: progress, count: 1 })
      }
    }

    // Calculate average progress per course
    const activeCourses: ActiveCourseProgress[] = []
    for (const [courseId, data] of courseMap) {
      const avgProgress = Math.round(data.progressSum / data.count)
      activeCourses.push({
        courseId,
        courseTitle: data.title,
        progressPercentage: avgProgress,
      })
    }

    return activeCourses
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch active courses')
    return []
  }
}

/**
 * Calculate learning streak from progress records
 * Returns number of consecutive days with activity ending today/yesterday
 */
function calculateStreak(records: ProgressRecord[]): number {
  // Get all unique days with activity
  const daysWithActivity = new Set<string>()

  for (const record of records) {
    if (record.lastAccessedAt) {
      const date = new Date(record.lastAccessedAt)
      const dayKey = date.toISOString().split('T')[0] // YYYY-MM-DD
      daysWithActivity.add(dayKey)
    }
  }

  if (daysWithActivity.size === 0) {
    return 0
  }

  // Sort days in descending order
  const sortedDays = Array.from(daysWithActivity).sort((a, b) => b.localeCompare(a))

  // Check if most recent activity is today or yesterday
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
    // Streak is broken - no activity today or yesterday
    return 0
  }

  // Count consecutive days
  let streak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const current = new Date(sortedDays[i - 1])
    const previous = new Date(sortedDays[i])
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000)

    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Build user context block for system prompt injection
 */
export function buildUserContextBlock(context: UserLearningContext): string {
  const lines: string[] = []

  lines.push('## Your Learning Progress')

  if (context.activeCourses.length > 0) {
    lines.push('')
    lines.push('### Active Courses')
    for (const course of context.activeCourses) {
      lines.push(`- ${course.courseTitle}: ${course.progressPercentage}% complete`)
    }
  }

  if (
    context.completedLessons > 0 ||
    context.completedChapters > 0 ||
    context.totalExercisesCompleted > 0
  ) {
    lines.push('')
    lines.push('### Completion Stats')
    lines.push(`- ${context.completedLessons} lessons completed`)
    lines.push(`- ${context.completedChapters} chapters completed`)
    lines.push(`- ${context.totalExercisesCompleted} exercises completed`)
  }

  if (context.averageScore !== null) {
    lines.push(`- Average score: ${context.averageScore}%`)
  }

  if (context.currentStreak > 0) {
    lines.push('')
    lines.push('### Learning Streak')
    lines.push(`- You're on a ${context.currentStreak}-day learning streak! Keep it up!`)
  }

  if (context.studyPlan) {
    lines.push('')
    lines.push('### Your Study Plan')
    const plan = context.studyPlan
    if (plan.examDate) {
      lines.push(`- Exam date: ${plan.examDate}`)
    }
    if (plan.topics.length > 0) {
      lines.push('- Topics to study:')
      for (const topic of plan.topics.slice(0, 5)) {
        lines.push(`  - ${topic.topicLabel} (${topic.mastery})`)
      }
    }
  }

  if (context.recentActivity.length > 0) {
    lines.push('')
    lines.push('### Recent Activity')
    for (const activity of context.recentActivity.slice(0, 5)) {
      const date = activity.timestamp
        ? new Date(activity.timestamp).toLocaleDateString()
        : 'Unknown'
      lines.push(`- ${activity.type}: ${activity.label} (${date})`)
    }
  }

  if (lines.length === 1) {
    // Only the header, no data
    lines.push('')
    lines.push('No learning data available yet. Start exploring courses to build your profile!')
  }

  return lines.join('\n')
}
