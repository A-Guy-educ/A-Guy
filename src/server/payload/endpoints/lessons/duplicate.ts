/**
 * POST /api/lessons/:id/duplicate
 *
 * @fileType api-route
 * @domain lessons
 * @pattern duplication-job
 * @ai-summary Creates a LessonDuplications record. For level=none, deep-clones the lesson + exercises inline.
 *
 * Body: { level: 'none' | 'light' | 'medium' | 'deep' }
 *
 * - level=none: clone source lesson (and all its exercises) synchronously,
 *   set outputLesson + status=succeeded, return { id, outputLessonId }.
 * - level=light|medium|deep: create a pending record and return { id }.
 *   The actual variation work is handled by later tasks (orchestrator job).
 *
 * Access: admin only.
 */
import type { PayloadRequest } from 'payload'

import {
  DUPLICATION_LEVELS,
  type DuplicationLevel,
} from '@/server/payload/collections/LessonDuplications'

interface DuplicateBody {
  level?: unknown
}

const isLevel = (v: unknown): v is DuplicationLevel =>
  typeof v === 'string' && (DUPLICATION_LEVELS as readonly string[]).includes(v)

/** Strip Payload-managed fields from a doc so it can be passed to `create`. */
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

/**
 * Deep-clone a lesson and all of its exercises into a new lesson.
 * Returns the new lesson id.
 */
async function deepCloneLesson(req: PayloadRequest, sourceLessonId: string): Promise<string> {
  const source = await req.payload.findByID({
    collection: 'lessons',
    id: sourceLessonId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Build new lesson data — same fields, but force a copy-suffixed title and
  // let the Lessons beforeChange hook regenerate a unique slug.
  const sourceData = stripManagedFields(source as unknown as Record<string, unknown>)
  const baseTitle = typeof sourceData.title === 'string' ? sourceData.title : 'Untitled'
  const newLessonData = {
    ...sourceData,
    title: `${baseTitle} - Copy`,
    slug: undefined, // force re-generation by hook
    status: 'draft', // never publish a duplicate by default
  }

  const newLesson = await req.payload.create({
    collection: 'lessons',
    data: newLessonData as never,
    overrideAccess: true,
    req,
  })

  // Clone all exercises that point at the source lesson.
  const exercises = await req.payload.find({
    collection: 'exercises',
    where: { lesson: { equals: sourceLessonId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const exercise of exercises.docs) {
    const exData = stripManagedFields(exercise as unknown as Record<string, unknown>)
    await req.payload.create({
      collection: 'exercises',
      data: { ...exData, lesson: newLesson.id } as never,
      overrideAccess: true,
      req,
    })
  }

  return newLesson.id
}

export async function duplicateLessonEndpoint(req: PayloadRequest): Promise<Response> {
  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  // 2) Lesson id from path: /lessons/:id/duplicate
  const url = new URL(req.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/duplicate/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return Response.json({ error: 'Lesson id missing from path' }, { status: 400 })
  }

  // 3) Parse + validate body
  let body: DuplicateBody = {}
  try {
    if (req.json) {
      body = (await req.json()) as DuplicateBody
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isLevel(body.level)) {
    return Response.json(
      { error: `level must be one of: ${DUPLICATION_LEVELS.join(', ')}` },
      { status: 400 },
    )
  }
  const level: DuplicationLevel = body.level

  // 4) Verify source lesson exists
  try {
    await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return Response.json({ error: `Lesson "${lessonId}" not found` }, { status: 404 })
  }

  // 5) Create the duplication record
  const record = await req.payload.create({
    collection: 'lesson-duplications',
    data: {
      sourceLesson: lessonId,
      level,
      status: 'pending',
    } as never,
    overrideAccess: true,
    req,
  })

  // 6) For level=none, deep-clone immediately
  if (level === 'none') {
    try {
      const outputLessonId = await deepCloneLesson(req, lessonId)
      const updated = await req.payload.update({
        collection: 'lesson-duplications',
        id: record.id,
        data: { outputLesson: outputLessonId, status: 'succeeded' } as never,
        overrideAccess: true,
        req,
      })
      return Response.json({ id: updated.id, outputLessonId, status: 'succeeded' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await req.payload.update({
        collection: 'lesson-duplications',
        id: record.id,
        data: { status: 'failed' } as never,
        overrideAccess: true,
        req,
      })
      return Response.json(
        { error: `Deep clone failed: ${message}`, id: record.id },
        { status: 500 },
      )
    }
  }

  // 7) For light/medium/deep, leave pending — return immediately
  return Response.json({ id: record.id, status: 'pending' })
}
