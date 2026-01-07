/**
 * POST /api/exercises/import?lessonId=<id>
 * Convert lesson contentFile to exercise using AI
 *
 * Access: Authenticated users only
 */
import { PayloadRequest } from 'payload'
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'
import type { Media } from '@/payload-types'
import { ExerciseBlockDefaults } from '@/collections/Exercises'
import {
  QuestionFreeResponseBlockSchema,
  QuestionSelectBlockSchema,
} from '@/collections/Exercises/schemas'

export async function importExerciseFromLesson(req: PayloadRequest) {
  // 1) Auth - endpoints not authenticated by default
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Get lessonId from query params
  const url = new URL(req.url || 'http://localhost')
  const lessonId = url.searchParams.get('lessonId')

  if (!lessonId) {
    return Response.json({ error: 'lessonId query parameter is required' }, { status: 400 })
  }

  // 3) Fetch lesson with contentFiles
  const lesson = await req.payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
  })

  if (!lesson) {
    return Response.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // 4) Check if contentFiles exists and get the first file
  const contentFiles = lesson.contentFiles as (Media | string)[] | null | undefined
  const firstFile = contentFiles && contentFiles.length > 0 ? contentFiles[0] : null
  const contentFile = (typeof firstFile === 'string' ? null : firstFile) as Media | null

  if (!contentFile || !contentFile.url) {
    return Response.json({ error: 'Lesson has no content file to convert' }, { status: 400 })
  }

  // 5) Fetch image from storage URL as buffer
  let imageBuffer: Buffer
  let mimeType: string

  try {
    // Handle both relative and absolute URLs
    let imageUrl: string
    const isAbsolute = contentFile.url.startsWith('http')

    if (isAbsolute) {
      // Already absolute URL (Vercel Blob, S3, etc.)
      imageUrl = contentFile.url
    } else {
      // Relative URL - build absolute URL from request origin
      const requestUrl = new URL(req.url || 'http://localhost:3000')
      const origin = `${requestUrl.protocol}//${requestUrl.host}`
      imageUrl = `${origin}${contentFile.url}`
    }

    // Fetch from the URL with authentication forwarding for relative URLs
    // For absolute URLs (Vercel Blob, S3), no auth needed
    const fetchOptions: RequestInit = {}
    if (!isAbsolute) {
      // Forward cookies for server-to-server requests to our own API
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        fetchOptions.headers = {
          cookie: cookieHeader,
        }
      }
    }

    const imageResponse = await fetch(imageUrl, fetchOptions)

    if (!imageResponse.ok) {
      return Response.json(
        {
          error: 'Failed to fetch lesson content file from storage',
          details: `HTTP ${imageResponse.status}: ${imageResponse.statusText}`,
          url: contentFile.url,
        },
        { status: 500 },
      )
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    imageBuffer = Buffer.from(arrayBuffer)
    mimeType = contentFile.mimeType || 'image/jpeg'
  } catch (fetchError) {
    return Response.json(
      {
        error: 'Failed to fetch lesson content file from storage',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        url: contentFile.url,
      },
      { status: 500 },
    )
  }

  // 6) Extract data from image
  let result
  try {
    result = await extractFromImage({
      imageBuffer,
      mimeType,
    })
  } catch (aiError) {
    return Response.json(
      {
        error: 'AI extraction failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown AI error',
      },
      { status: 500 },
    )
  }

  if (!result.success) {
    return Response.json({ error: result.error || 'Failed to process image' }, { status: 500 })
  }

  // 7) Create exercise using factory from Exercises.ts, then validate with Zod
  if (result.data) {
    try {
      const hasOptions = result.data.options && result.data.options.length > 0

      let questionBlock

      if (hasOptions) {
        // Get MCQ template from factory
        const draft = ExerciseBlockDefaults.question_mcq() as any

        // Populate with AI-extracted data
        draft.prompt.value = result.data.question
        draft.answer.options = result.data.options.map((opt: string, i: number) => ({
          id: `opt-${i + 1}`,
          content: {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: opt,
            mediaIds: [],
          },
        }))

        // Validate correctAnswer exists
        if (typeof result.data.correctAnswer !== 'number') {
          return Response.json(
            { error: 'AI did not provide correctAnswer for MCQ' },
            { status: 422 },
          )
        }

        draft.answer.correctOptionIds = [`opt-${result.data.correctAnswer + 1}`]

        if (result.data.explanation) {
          draft.solution = {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: result.data.explanation,
            mediaIds: [],
          }
        }

        // Validate with Zod schema (runtime validation)
        questionBlock = QuestionSelectBlockSchema.parse(draft)
      } else {
        // Get free response template from factory
        const draft = ExerciseBlockDefaults.question_free_response() as any

        // Populate with AI-extracted data
        draft.prompt.value = result.data.question
        draft.answer.acceptedAnswers = [result.data.explanation || 'See solution']

        if (result.data.explanation) {
          draft.solution = {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: result.data.explanation,
            mediaIds: [],
          }
        }

        // Validate with Zod schema (runtime validation)
        questionBlock = QuestionFreeResponseBlockSchema.parse(draft)
      }

      const exerciseDoc = await req.payload.create({
        collection: 'exercises',
        data: {
          title: 'AI Generated Exercise',
          order: 0,
          lesson: lessonId,
          content: {
            blocks: [questionBlock],
          },
        },
      })

      return Response.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        exerciseId: exerciseDoc.id,
      })
    } catch (createError) {
      return Response.json(
        {
          error: 'AI conversion succeeded but exercise creation failed',
          details: createError instanceof Error ? createError.message : 'Unknown error',
          // Include Zod issues in response for debugging
          ...(createError && typeof createError === 'object' && 'issues' in createError
            ? { zodIssues: (createError as any).issues }
            : {}),
        },
        { status: 500 },
      )
    }
  }

  return Response.json({
    success: true,
    data: result.data,
    metadata: result.metadata,
  })
}
