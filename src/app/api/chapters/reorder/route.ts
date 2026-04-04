/**
 * POST /api/chapters/reorder
 *
 * Reorder chapters within a course by updating the `order` field.
 * Supports two modes:
 *  - Move single chapter up or down: { id, direction }
 *  - Bulk reorder (drag-and-drop): { courseId, orderedIds }
 *
 * @fileType api-route
 * @domain courses
 * @pattern admin-reorder
 * @ai-summary Reorders chapters within a course and rebalances order field values
 */
import '@/infra/config/server-init'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { z } from 'zod'
import type { User } from '@/payload-types'
import { AccountRole } from '@/server/payload/collections/Users/roles'

const bulkReorderSchema = z.object({
  courseId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
})

const singleMoveSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['up', 'down']),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Authenticate — admin only
    const { user } = await payload.auth({ headers: request.headers })
    const typedUser = user as User | null
    if (!typedUser || typedUser.role !== AccountRole.Admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await request.json()

    // ── Bulk reorder mode ──────────────────────────────────────────────────
    if (rawBody.orderedIds !== undefined || rawBody.courseId !== undefined) {
      const parsed = bulkReorderSchema.safeParse(rawBody)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid payload', details: parsed.error.flatten() },
          { status: 400 },
        )
      }
      const { courseId, orderedIds } = parsed.data

      // Verify all orderedIds belong to the specified course and that
      // they form a complete permutation (no additions, no omissions).
      const courseChapters = await payload.find({
        collection: 'chapters',
        where: { course: { equals: courseId } },
        limit: 1000,
        pagination: false,
        depth: 0,
        overrideAccess: false,
        user: typedUser,
      })

      const courseChapterIds = new Set(courseChapters.docs.map((c) => c.id))

      if (orderedIds.length !== courseChapterIds.size) {
        return NextResponse.json(
          { error: 'orderedIds length does not match the number of chapters in the course' },
          { status: 400 },
        )
      }

      for (const id of orderedIds) {
        if (!courseChapterIds.has(id)) {
          return NextResponse.json(
            { error: `Chapter ${id} does not belong to course ${courseId}` },
            { status: 400 },
          )
        }
      }

      await Promise.all(
        orderedIds.map((chapterId, index) =>
          payload.update({
            collection: 'chapters',
            id: chapterId,
            data: { order: index + 1 },
            overrideAccess: false,
            user: typedUser,
          }),
        ),
      )

      return NextResponse.json({ success: true, courseId, count: orderedIds.length })
    }

    // ── Single move mode ───────────────────────────────────────────────────
    const parsed = singleMoveSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Provide either { id, direction } for single move or { courseId, orderedIds } for bulk reorder',
        },
        { status: 400 },
      )
    }
    const { id, direction } = parsed.data

    // Fetch the target chapter
    const chapter = await payload.findByID({
      collection: 'chapters',
      id,
      overrideAccess: false,
      user: typedUser,
    })

    const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id

    // Fetch all chapters in the same course sorted by order
    const result = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      sort: 'order',
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: false,
      user: typedUser,
    })

    const chapters = result.docs
    const currentIndex = chapters.findIndex((c) => c.id === id)

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Chapter not found in course' }, { status: 404 })
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (swapIndex < 0 || swapIndex >= chapters.length) {
      return NextResponse.json(
        { error: 'Chapter is already at the boundary' },
        { status: 400 },
      )
    }

    // Build the new order by swapping the two chapters (immutable)
    const reordered = [...chapters]
    const temp = reordered[currentIndex]!
    reordered[currentIndex] = reordered[swapIndex]!
    reordered[swapIndex] = temp

    // Update all chapters with sequential order values
    await Promise.all(
      reordered.map((c, index) =>
        payload.update({
          collection: 'chapters',
          id: c.id,
          data: { order: index + 1 },
          overrideAccess: false,
          user: typedUser,
        }),
      ),
    )

    // Optimistic concurrency guard: re-read the two affected chapters and
    // confirm their order values match what we wrote.  If another request
    // raced and overwrote them, return a conflict error so the client can retry.
    const [updated1, updated2] = await Promise.all([
      payload.findByID({
        collection: 'chapters',
        id: reordered[currentIndex]!.id,
        depth: 0,
        overrideAccess: false,
        user: typedUser,
      }),
      payload.findByID({
        collection: 'chapters',
        id: reordered[swapIndex]!.id,
        depth: 0,
        overrideAccess: false,
        user: typedUser,
      }),
    ])

    const expectedOrder1 = currentIndex + 1
    const expectedOrder2 = swapIndex + 1

    if (updated1.order !== expectedOrder1 || updated2.order !== expectedOrder2) {
      return NextResponse.json(
        { error: 'Concurrent modification detected — please refresh and try again' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true, courseId, count: reordered.length })
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chapters/reorder' })
  }
}
