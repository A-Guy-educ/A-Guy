/**
 * POST /api/lessons/:id/generate-exercises
 *
 * @fileType api-route
 * @domain lessons
 * @pattern exercise-generation
 * @ai-summary Generates 10 AI-powered exercises for a lesson from a dynamic content-manager prompt.
 *
 * Body: { prompt: string }
 *
 * Fetches the lesson, injects its title + lessonContextText into the LLM prompt,
 * generates 10 exercises via the LLM service, creates each as a Payload exercise
 * record (auto-syncing to lesson blocks via existing afterChange hook), and
 * returns the list of created exercise IDs.
 *
 * Access: admin only.
 */
import { z } from 'zod'
import type { PayloadRequest } from 'payload'
import {
  generateLessonExercises,
  GeneratedExercisesSchema,
} from '@/infra/llm/services/lesson-exercise-generation-service'
import { generateId } from '@/server/payload/collections/Exercises/defaults'
import type { ExerciseContent } from '@/server/payload/collections/Exercises/schemas'

const GenerateExercisesBodySchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(5000),
})

export async function generateExercisesEndpoint(req: PayloadRequest): Promise<Response> {
  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  // 2) Lesson id from path: /lessons/:id/generate-exercises
  const rawUrl = req.url || ''
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl}`
  const url = new URL(baseUrl)
  const match = url.pathname.match(/\/lessons\/([^/]+)\/generate-exercises/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return Response.json({ success: false, error: 'Lesson id missing from path' }, { status: 400 })
  }

  // 3) Parse + validate body
  let body: unknown = {}
  try {
    if (req.json) {
      body = await req.json()
    }
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = GenerateExercisesBodySchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json(
      {
        success: false,
        error: parseResult.error.issues[0]?.message ?? 'Invalid prompt',
      },
      { status: 400 },
    )
  }
  const { prompt } = parseResult.data

  // 4) Fetch lesson
  let lesson: Record<string, unknown>
  try {
    lesson = (await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Record<string, unknown>
  } catch {
    return Response.json(
      { success: false, error: `Lesson "${lessonId}" not found` },
      { status: 404 },
    )
  }

  const lessonTitle = (lesson.title as string) ?? 'Untitled Lesson'
  const lessonContextText = lesson.lessonContextText as string | null | undefined

  // 5) Call LLM service
  const result = await generateLessonExercises(
    {
      lessonTitle,
      lessonContextText,
      userPrompt: prompt,
    },
    req.payload,
  )

  if (!result.success || !result.data) {
    return Response.json(
      { success: false, error: result.error ?? 'Exercise generation failed' },
      { status: 500 },
    )
  }

  // 6) Validate LLM output (defensive)
  const validationResult = GeneratedExercisesSchema.safeParse(result.data)
  if (!validationResult.success) {
    return Response.json(
      { success: false, error: 'LLM returned malformed exercise data' },
      { status: 500 },
    )
  }

  // 7) Create exercise records
  const created: string[] = []
  const errors: string[] = []

  for (const ex of validationResult.data.exercises) {
    try {
      // Ensure each block has a valid id (regenerate if needed)
      const blocksWithIds = ex.content.blocks.map((block) => ({
        ...block,
        id: block.id || generateId(),
      }))

      const createdExercise = await req.payload.create({
        collection: 'exercises',
        data: {
          title: ex.title,
          lesson: lessonId,
          content: { blocks: blocksWithIds } as unknown as ExerciseContent,
        } as never,
        overrideAccess: true,
        req,
        draft: false,
      })
      created.push(
        typeof createdExercise.id === 'string' ? createdExercise.id : String(createdExercise.id),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Exercise "${ex.title}": ${msg}`)
    }
  }

  if (created.length === 0) {
    return Response.json(
      {
        success: false,
        error: 'Failed to create any exercises. All creation attempts failed.',
        errors,
      },
      { status: 500 },
    )
  }

  return Response.json({
    success: true,
    data: {
      createdExerciseIds: created,
      totalCreated: created.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
