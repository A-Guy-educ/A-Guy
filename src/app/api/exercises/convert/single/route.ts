/**
 * V3 Extract Single Exercise API Endpoint
 *
 * POST /api/exercises/convert/single
 *
 * Extracts a single exercise from a document (PDF or image).
 * Returns preview data for admin review.
 *
 * @fileType api-route
 * @domain conversion
 * @pattern endpoint
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { withApiHandler } from '@/server/api/with-api-handler'
import { extractAndCreate } from '@/server/services/exercise-conversion/v3/extract-single'

// Request schema
const extractRequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  promptId: z.string().optional(),
})

type ExtractRequest = z.infer<typeof extractRequestSchema>

// POST handler
export const POST = withApiHandler<ExtractRequest, unknown>(
  {
    auth: 'admin',
    bodySchema: extractRequestSchema,
  },
  async ({ body, payload }) => {
    const { lessonId, mediaId, promptId } = body

    // Extract and create exercise in one step
    const result = await extractAndCreate(payload, {
      lessonId,
      mediaId,
      promptId,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          extractionLogId: result.extractionLogId,
        },
        { status: 500 },
      )
    }

    // Return success with exercise data
    return NextResponse.json(
      {
        success: true,
        data: {
          exerciseId: result.exerciseId,
          adminUrl: result.adminUrl,
        },
      },
      { status: 201 },
    )
  },
)
