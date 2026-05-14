/**
 * GET /api/lessons/:id/export
 *
 * Exports a lesson and all its ordered exercises as a JSON file.
 *
 * Access: admin only (401 unauthenticated, 403 non-admin).
 *
 * Response: Content-Type: application/json, Content-Disposition: attachment; filename="<slug>.json"
 *
 * JSON shape:
 * {
 *   lesson: { id, title, slug, description, type, status, order, accessType, visibleRenderers, ... },
 *   exercises: [ { id, title, slug, content, origin, ... }, ... ],  // ordered by blocks array
 *   meta: {
 *     exerciseCount: number,
 *     missingExerciseRefs: string[],      // IDs in blocks but not in DB
 *     skippedNonExerciseBlocks: number,  // contentPageRef etc.
 *   }
 * }
 *
 * Excluded from exercise payload: createdAt, updatedAt, internal _id, __v
 *
 * @fileType api-route
 * @domain lessons
 * @pattern lesson-export
 * @ai-summary Exports a lesson and its ordered exercises as a JSON file for backup or offline review.
 */
import type { PayloadRequest } from 'payload'

type BlockEntry = { id: string; blockType: string; exercise?: string; contentPage?: string }

/** Strip Payload-managed fields from a doc */
function stripManagedFields<T extends Record<string, unknown>>(
  doc: T,
): Omit<T, 'id' | 'createdAt' | 'updatedAt'> {
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = doc as T & {
    id?: unknown
    createdAt?: unknown
    updatedAt?: unknown
  }
  void _id
  void _c
  void _u
  return rest
}

/** Parse blocks from JSON string or array */
function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      // ignore parse errors
    }
  }
  return []
}

export async function exportLessonEndpoint(req: PayloadRequest): Promise<Response> {
  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  // 2) Extract lesson ID from path: /lessons/:id/export
  const url = new URL(req.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/export/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return Response.json({ error: 'Lesson id missing from path' }, { status: 400 })
  }

  // 3) Fetch lesson with depth:0
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
    return Response.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // 4) Parse blocks, extract ordered exercise IDs (exerciseRef only)
  const blocks = parseBlocks(lesson.blocks)
  const exerciseIds: string[] = []
  let skippedNonExerciseBlocks = 0
  const missingIds: string[] = []

  for (const block of blocks) {
    if (block.blockType === 'exerciseRef' && block.exercise) {
      exerciseIds.push(block.exercise)
    } else {
      skippedNonExerciseBlocks++
    }
  }

  // 5) Fetch exercises in order, track missing ones
  const exercises: unknown[] = []
  for (const exId of exerciseIds) {
    try {
      const ex = (await req.payload.findByID({
        collection: 'exercises',
        id: exId,
        depth: 0,
        overrideAccess: true,
        req,
      })) as unknown as Record<string, unknown>
      exercises.push(stripManagedFields(ex))
    } catch {
      missingIds.push(exId)
    }
  }

  // 6) Build response — strip managed fields from lesson (keep id)
  const { createdAt: _lca, updatedAt: _lua, blocks: _lb, ...lessonData } = lesson
  void _lca
  void _lua
  void _lb

  const responseBody = {
    lesson: lessonData,
    exercises,
    meta: {
      exerciseCount: exercises.length,
      missingExerciseRefs: missingIds,
      skippedNonExerciseBlocks,
    },
  }

  const slug = (lesson.slug as string) || lessonId
  const filename = `${slug}.json`

  return new Response(JSON.stringify(responseBody, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
