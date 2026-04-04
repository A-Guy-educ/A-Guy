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
import { AccountRole } from '@/server/payload/collections/Users/roles'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Authenticate — admin only
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || (user as { role?: string }).role !== AccountRole.Admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (body.orderedIds && body.courseId) {
      // Bulk reorder mode: update all chapters to match the provided order
      const { courseId, orderedIds } = body as { courseId: string; orderedIds: string[] }

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return NextResponse.json({ error: 'orderedIds must be a non-empty array' }, { status: 400 })
      }

      await Promise.all(
        orderedIds.map((chapterId, index) =>
          payload.update({
            collection: 'chapters',
            id: chapterId,
            data: { order: index + 1 },
            overrideAccess: false,
            user,
          }),
        ),
      )

      return NextResponse.json({ success: true, courseId, count: orderedIds.length })
    }

    if (body.id && body.direction) {
      // Single move mode: swap with the adjacent chapter (up or down)
      const { id, direction } = body as { id: string; direction: 'up' | 'down' }

      if (direction !== 'up' && direction !== 'down') {
        return NextResponse.json(
          { error: 'direction must be "up" or "down"' },
          { status: 400 },
        )
      }

      // Fetch the target chapter
      const chapter = await payload.findByID({
        collection: 'chapters',
        id,
        overrideAccess: false,
        user,
      })

      const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id

      // Fetch all chapters in the same course sorted by order
      const result = await payload.find({
        collection: 'chapters',
        where: { course: { equals: courseId } },
        sort: 'order',
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        user,
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

      // Rebalance: build the new order by swapping the two chapters
      const reordered = [...chapters]
      const temp = reordered[currentIndex]
      reordered[currentIndex] = reordered[swapIndex]
      reordered[swapIndex] = temp

      // Update all chapters with sequential order values
      await Promise.all(
        reordered.map((c, index) =>
          payload.update({
            collection: 'chapters',
            id: c.id,
            data: { order: index + 1 },
            overrideAccess: false,
            user,
          }),
        ),
      )

      return NextResponse.json({ success: true, courseId, count: reordered.length })
    }

    return NextResponse.json(
      {
        error:
          'Provide either { id, direction } for single move or { courseId, orderedIds } for bulk reorder',
      },
      { status: 400 },
    )
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chapters/reorder' })
  }
}
