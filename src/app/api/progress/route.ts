/**
 * Progress API
 *
 * POST /api/progress - Save lesson/exercise/chapter progress
 * GET  /api/progress - Fetch progress records for a grade level
 */
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import { queryUserProgressByGrade } from '@/server/repos/queries/userProgress'

// --- Zod schemas ---

const PostBodySchema = z.object({
  recordType: z.enum(['lesson', 'exercise', 'chapter']),
  recordId: z.string().min(1),
  completionPercentage: z.number().min(0).max(100),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  score: z.number().min(0).max(100).optional(),
  gradeLevel: z.string().min(1),
})

// --- GET ---

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const gradeLevel = searchParams.get('gradeLevel')

    if (!gradeLevel) {
      return NextResponse.json({ error: 'gradeLevel is required' }, { status: 400 })
    }

    const recordType = searchParams.get('recordType')
    const recordIdsParam = searchParams.get('recordIds')
    const recordIds = recordIdsParam ? recordIdsParam.split(',').filter(Boolean) : null
    const scope = searchParams.get('scope')

    const userProgress = await queryUserProgressByGrade({
      userId: user.id,
      gradeLevel,
    })

    if (!userProgress?.progressRecords) {
      return NextResponse.json({ success: true, data: {} })
    }

    // Course-level aggregation: average of all lesson completions
    if (scope === 'course') {
      const lessonRecords = userProgress.progressRecords.filter((r) => r.recordType === 'lesson')
      if (lessonRecords.length === 0) {
        return NextResponse.json({ success: true, data: { percentage: 0, totalLessons: 0 } })
      }
      const totalPercentage = lessonRecords.reduce(
        (sum, r) => sum + (r.completionPercentage ?? 0),
        0,
      )
      return NextResponse.json({
        success: true,
        data: {
          percentage: Math.round(totalPercentage / lessonRecords.length),
          totalLessons: lessonRecords.length,
        },
      })
    }

    // Filter records
    let filtered = userProgress.progressRecords
    if (recordType) {
      filtered = filtered.filter((r) => r.recordType === recordType)
    }
    if (recordIds) {
      filtered = filtered.filter((r) => recordIds.includes(r.recordId))
    }

    // Build map: recordId → { completionPercentage, status, score }
    const data: Record<string, { completionPercentage: number; status: string; score?: number }> =
      {}
    for (const record of filtered) {
      data[record.recordId] = {
        completionPercentage: record.completionPercentage ?? 0,
        status: record.status ?? 'not_started',
        ...(record.score != null && { score: record.score }),
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/progress GET' })
  }
}

// --- POST ---

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PostBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error },
        { status: 400 },
      )
    }

    const { recordType, recordId, completionPercentage, status, score, gradeLevel } = parsed.data

    const newRecord = {
      recordType,
      recordId,
      completionPercentage,
      status,
      ...(score != null && { score }),
      lastAccessedAt: new Date().toISOString(),
    }

    // Find existing UserProgress doc
    const userProgress = await queryUserProgressByGrade({
      userId: user.id,
      gradeLevel,
    })

    if (userProgress) {
      // Upsert record in progressRecords array
      const existing = userProgress.progressRecords ?? []
      const idx = existing.findIndex((r) => r.recordType === recordType && r.recordId === recordId)

      const updatedRecords =
        idx >= 0
          ? existing.map((r, i) => (i === idx ? { ...r, ...newRecord } : r))
          : [...existing, newRecord]

      await payload.update({
        collection: 'user-progress',
        id: userProgress.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { progressRecords: updatedRecords as any },
        overrideAccess: false,
        user,
      })

      return NextResponse.json({ success: true, data: newRecord })
    }

    // Create new UserProgress doc
    const tenantId = await getDefaultTenantId(payload)
    await payload.create({
      collection: 'user-progress',
      data: {
        tenant: tenantId,
        user: user.id,
        gradeLevel,
        progressRecords: [newRecord],
      },
      draft: false,
    })

    return NextResponse.json({ success: true, data: newRecord }, { status: 201 })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/progress POST' })
  }
}
