/**
 * PATCH /api/exercises/[id]/blocks/[blockId]
 *
 * Server-side block patch endpoint with:
 * - Authentication required
 * - Authorization (admin or owner)
 * - Structure invariance validation
 * - Prototype pollution protection
 * - Optimistic concurrency support
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import config from '@payload-config'
import {
  sanitizePrototypePollution,
  validateStructuralInvariance,
} from '@/utils/structure-validator'
import { ContentBlockSchema } from '@/server/payload/collections/Exercises/schemas'

// Extended user type with roles
interface AuthenticatedUser {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roles?: any[]
}

// Extended exercise type with owner
interface ExerciseWithOwner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt?: any
  owner?: string
}

// Zod schema for request validation
const BlockPatchRequestSchema = z.object({
  block: z.unknown(), // Will be validated against ContentBlockSchema
  updatedAt: z.string().optional(), // For optimistic concurrency
})

type BlockPatchRequest = z.infer<typeof BlockPatchRequestSchema>

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
): Promise<NextResponse> {
  try {
    const { id: exerciseId, blockId } = await params

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

    // 2. Parse and validate request body
    const body: unknown = await request.json()
    const parseResult = BlockPatchRequestSchema.safeParse(body)

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

    const { block: submittedBlock, updatedAt } = parseResult.data as BlockPatchRequest

    // 3. Sanitize prototype pollution
    const sanitizedBlock = sanitizePrototypePollution(submittedBlock)

    // 4. Fetch exercise with user context for access control
    const exercise = (await payload.findByID({
      collection: 'exercises',
      id: exerciseId,
      depth: 0,
      overrideAccess: false, // Enforce access control
      req: { payload, user } as never,
    })) as ExerciseWithOwner | null

    if (!exercise) {
      return NextResponse.json({ success: false, error: 'Exercise not found' }, { status: 404 })
    }

    // 5. Authorization: check admin or owner
    const isAdmin = user.roles?.includes('admin')
    const isOwner = exercise.owner === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this exercise' },
        { status: 403 },
      )
    }

    // 6. Optimistic concurrency check
    if (updatedAt && exercise.updatedAt) {
      const documentUpdatedAt = new Date(exercise.updatedAt as string).toISOString()
      if (documentUpdatedAt !== updatedAt) {
        return NextResponse.json(
          {
            success: false,
            error: 'Document has been modified by another user',
            currentUpdatedAt: documentUpdatedAt,
          },
          { status: 409 }, // Conflict
        )
      }
    }

    // 7. Find existing block by ID
    const content = exercise.content as { blocks?: unknown[] } | undefined
    const blocks = content?.blocks || []
    const existingBlockIndex = blocks.findIndex(
      (b: unknown) => (b as { id?: string })?.id === blockId,
    )

    if (existingBlockIndex === -1) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 })
    }

    const existingBlock = blocks[existingBlockIndex]

    // 8. Structure invariance validation
    const structureResult = validateStructuralInvariance(existingBlock, sanitizedBlock)
    if (!structureResult.valid) {
      const firstError = structureResult.errors[0]
      return NextResponse.json(
        {
          success: false,
          error: 'Structure change not allowed',
          details: {
            path: firstError?.path || 'root',
            message: firstError?.message || 'Unknown structure violation',
            type: firstError?.type,
          },
        },
        { status: 400 },
      )
    }

    // 9. Validate against ContentBlockSchema
    const schemaResult = ContentBlockSchema.safeParse(sanitizedBlock)
    if (!schemaResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid block data',
          details: schemaResult.error.issues,
        },
        { status: 400 },
      )
    }

    // 10. Replace only the targeted block
    const updatedBlocks = [...blocks]
    updatedBlocks[existingBlockIndex] = sanitizedBlock

    // 11. Update the document
    const updatedExercise = (await payload.update({
      collection: 'exercises',
      id: exerciseId,
      data: {
        content: {
          blocks: updatedBlocks,
        },
      },
      req: { payload, user } as never,
    })) as ExerciseWithOwner

    // 12. Log successful edit (audit)
    console.info('[exercise-block-patch] Block updated', {
      userId: user.id,
      exerciseId,
      blockId,
      blockType: (sanitizedBlock as { type?: string })?.type,
      timestamp: new Date().toISOString(),
    })

    // 13. Return updated block
    const updatedContent = updatedExercise.content as { blocks?: unknown[] } | undefined
    const updatedBlock = updatedContent?.blocks?.find(
      (b: unknown) => (b as { id?: string })?.id === blockId,
    )

    return NextResponse.json({
      success: true,
      data: updatedBlock,
    })
  } catch (error) {
    console.error('[exercise-block-patch] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
