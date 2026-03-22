/**
 * Stats Track Activity API
 *
 * POST /api/stats/track-activity
 * Records user activities (lesson completed, exercise completed, etc.)
 * and updates UserProgress records accordingly.
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import { logActivity } from '@/server/payload/hooks/stats/logActivity'

const trackActivitySchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('lesson_completed'),
    lessonId: z.string().min(1),
    lessonTitle: z.string().optional(),
  }),
  z.object({
    eventType: z.literal('exercise_completed'),
    exerciseId: z.string().min(1),
    exerciseTitle: z.string().optional(),
    lessonId: z.string().optional(),
    score: z.number().min(0).max(100),
    totalQuestions: z.number().min(1),
    correctCount: z.number().min(0),
  }),
  z.object({
    eventType: z.literal('exercise_attempted'),
    exerciseId: z.string().min(1),
    exerciseTitle: z.string().optional(),
    lessonId: z.string().optional(),
  }),
])

export async function POST(req: Request) {
  const payload = await getPayload({ config })

  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = trackActivitySchema.safeParse(body)
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid request', details: validation.error.flatten() },
      { status: 400 },
    )
  }

  const data = validation.data

  try {
    if (data.eventType === 'lesson_completed') {
      // Update UserProgress - mark lesson as completed
      await upsertProgressRecord(payload, userId, {
        recordType: 'lesson',
        recordId: data.lessonId,
        status: 'completed',
        completionPercentage: 100,
      })

      // Log activity
      await logActivity({
        payload,
        userId,
        actionType: 'lesson_completed',
        label: data.lessonTitle || `Lesson ${data.lessonId}`,
        targetId: data.lessonId,
        targetCollection: 'lessons',
      })
    } else if (data.eventType === 'exercise_completed') {
      const score = Math.round((data.correctCount / data.totalQuestions) * 100)

      // Update UserProgress - save exercise score
      await upsertProgressRecord(payload, userId, {
        recordType: 'exercise',
        recordId: data.exerciseId,
        status: 'completed',
        completionPercentage: 100,
        score,
      })

      // Log activity
      await logActivity({
        payload,
        userId,
        actionType: 'exercise_completed',
        label: data.exerciseTitle || `Exercise (${score}%)`,
        targetId: data.exerciseId,
        targetCollection: 'exercises',
      })
    } else if (data.eventType === 'exercise_attempted') {
      // Update UserProgress - mark as in progress
      await upsertProgressRecord(payload, userId, {
        recordType: 'exercise',
        recordId: data.exerciseId,
        status: 'in_progress',
        completionPercentage: 0,
      })

      // Log activity
      await logActivity({
        payload,
        userId,
        actionType: 'exercise_attempted',
        label: data.exerciseTitle || `Exercise ${data.exerciseId}`,
        targetId: data.exerciseId,
        targetCollection: 'exercises',
      })
    }

    return Response.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: 'Failed to track activity', details: message }, { status: 500 })
  }
}

/**
 * Upsert a progress record in UserProgress.
 * If the record already exists (matching recordType + recordId), update it.
 * If not, append it.
 */
async function upsertProgressRecord(
  payload: Awaited<ReturnType<typeof getPayload>>,
  userId: string,
  record: {
    recordType: string
    recordId: string
    status: string
    completionPercentage: number
    score?: number
  },
) {
  const userProgressResult = await payload.find({
    collection: 'user-progress',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  const now = new Date().toISOString()

  if (userProgressResult.docs.length > 0) {
    const doc = userProgressResult.docs[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
    const existingRecords = (doc as any).progressRecords || []

    // Find existing record
    const existingIndex = existingRecords.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic record shape
      (r: any) => r.recordType === record.recordType && r.recordId === record.recordId,
    )

    let updatedRecords
    if (existingIndex >= 0) {
      // Update existing - don't downgrade completed status
      const existing = existingRecords[existingIndex]
      const shouldUpdate = existing.status !== 'completed' || record.status === 'completed'

      if (shouldUpdate) {
        updatedRecords = [...existingRecords]
        updatedRecords[existingIndex] = {
          ...existing,
          ...record,
          // Use the new score (allows correction on re-attempts)
          score: record.score !== undefined ? record.score : existing.score,
          lastAccessedAt: now,
        }
      } else {
        // Just update lastAccessedAt
        updatedRecords = [...existingRecords]
        updatedRecords[existingIndex] = {
          ...existing,
          lastAccessedAt: now,
        }
      }
    } else {
      // Append new record
      updatedRecords = [
        ...existingRecords,
        {
          ...record,
          lastAccessedAt: now,
        },
      ]
    }

    await payload.update({
      collection: 'user-progress',
      id: doc.id,
      data: {
        progressRecords: updatedRecords,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
      } as any,
      overrideAccess: true,
    })
  } else {
    // Create new UserProgress document
    await payload.create({
      collection: 'user-progress',
      data: {
        user: userId,
        progressRecords: [
          {
            ...record,
            lastAccessedAt: now,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload dynamic field not in generated types
      } as any,
      overrideAccess: true,
    })
  }
}
