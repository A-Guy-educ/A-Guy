import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

interface UserProgressRecord {
  recordType: string
  recordId: string
  completionPercentage?: number | null
  status?: string
  score?: number | null
  lastAccessedAt?: string | null
}

// Study plan types (mirrored from lib/study-plan/types.ts to avoid import issues)
interface StudyPlanTopicInput {
  topicId: string
  topicLabel: string
  mastery: 'weak' | 'medium' | 'strong'
}

interface StudyPlanDay {
  dayId: string
  date: string
  activityType: 'practice' | 'hybrid' | 'full_simulation' | 'reinforcement' | 'warmup'
  topicIds: string[]
  status: 'planned' | 'completed'
  estimatedDurationMinutes: number
}

interface StudyPlanSnapshot {
  courseId: string
  examDate: string
  generatedAt: string
  topics: StudyPlanTopicInput[]
  days: StudyPlanDay[]
}

interface UserProgressDoc {
  id: string
  user: string
  gradeLevel: string
  progressRecords?: UserProgressRecord[]
  studyPlans?: StudyPlanSnapshot[]
}

/**
 * Get user progress by grade level
 */
export const queryUserProgressByGrade = cache(
  async ({ userId, gradeLevel }: { userId: string; gradeLevel: string }) => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'user-progress' as any,
      where: {
        and: [{ user: { equals: userId } }, { gradeLevel: { equals: gradeLevel } }],
      },
      limit: 1,
      pagination: false,
    })

    return (result.docs?.[0] as UserProgressDoc | undefined) || null
  },
)

/**
 * Get progress for specific chapters (returns map: chapterId → percentage)
 */
export const queryChapterProgress = cache(
  async ({
    userId,
    chapterIds,
    gradeLevel,
  }: {
    userId: string
    chapterIds: string[]
    gradeLevel: string
  }) => {
    const progressData = await queryUserProgressByGrade({ userId, gradeLevel })
    if (!progressData) return {}

    const progressMap: Record<string, number> = {}
    progressData.progressRecords?.forEach((record: UserProgressRecord) => {
      if (record.recordType === 'chapter' && chapterIds.includes(record.recordId)) {
        progressMap[record.recordId] = record.completionPercentage || 0
      }
    })

    return progressMap
  },
)

/**
 * Get study plan for a specific course
 */
export const queryStudyPlan = cache(
  async ({
    userId,
    gradeLevel,
    courseId,
  }: {
    userId: string
    gradeLevel: string
    courseId: string
  }) => {
    const doc = await queryUserProgressByGrade({ userId, gradeLevel })
    return (
      (doc?.studyPlans?.find((p) => p.courseId === courseId) as StudyPlanSnapshot | undefined) ||
      null
    )
  },
)
