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
import { extractSingle } from '@/server/services/exercise-conversion/v3/extract-single'

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

    // Extract single exercise
    const result = await extractSingle(payload, {
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

    // Return preview data
    return NextResponse.json({
      success: true,
      data: {
        title: result.preview!.title,
        content: result.preview!.content,
        draft: result.preview!.draft,
        metadata: result.preview!.metadata,
        extractionLogId: result.extractionLogId,
      },
    })
  },
)
