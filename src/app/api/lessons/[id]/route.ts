/**
 * PATCH /api/lessons/[id]
 *
 * @fileType api-route
 * @domain lessons
 * @pattern lesson-order-update
 * @ai-summary Update lesson order field via API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import config from '@payload-config'

// Extended user type with roles
interface AuthenticatedUser {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roles?: any[]
}

// Zod schema for order update
const OrderPatchRequestSchema = z.object({
  order: z.number().int().min(0),
})

type OrderPatchRequest = z.infer<typeof OrderPatchRequestSchema>

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: lessonId } = await params

    // 1. Authenticate
    const payload = await getPayload({ config })
    const authResult = await payload.auth({ headers: request.headers })
    const user = authResult.user as AuthenticatedUser | undefined

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    // 2. Admin authorization
    const isAdmin = user.roles?.includes('admin')

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 },
      )
    }

    // 3. Parse and validate request body
    const body: unknown = await request.json()
    const parseResult = OrderPatchRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.issues,
        },
        { status: 400 },
      )
    }

    const { order } = parseResult.data as OrderPatchRequest

    // 4. Fetch existing lesson to verify it exists
    const existingLesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: false,
      req: { payload, user } as never,
    })

    if (!existingLesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 },
      )
    }

    // 5. Update the lesson order
    const updatedLesson = await payload.update({
      collection: 'lessons',
      id: lessonId,
      data: {
        order,
      },
      req: { payload, user } as never,
    })

    return NextResponse.json({
      success: true,
      data: { id: updatedLesson.id, order: updatedLesson.order },
    })
  } catch (error) {
    console.error('[lesson-order-patch] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}