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
  DUPLICATION_SUBJECTS,
  type DuplicationLevel,
  type DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'

interface DuplicateBody {
  level?: unknown
  subject?: unknown
}

const isLevel = (v: unknown): v is DuplicationLevel =>
  typeof v === 'string' && (DUPLICATION_LEVELS as readonly string[]).includes(v)

const isSubject = (v: unknown): v is DuplicationSubject =>
  typeof v === 'string' && (DUPLICATION_SUBJECTS as readonly string[]).includes(v)

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

  // Build new lesson data. We spread every non-managed source field so the
  // variation inherits accessType / visibleRenderers / contentStatus / etc.
  // but explicitly drop fields that should NOT carry over:
  //  - slug: regenerated from the new title by formatSlugAsync hook.
  //  - blocks: references source exercise IDs by string. The exercise
  //    auto-add hook rebuilds it as new exercises are cloned.
  //  - translatedFrom: this duplicate is a fresh lesson, not a translation
  //    of whatever the source was translated from.
  //  - createdBy: set to the duplicating admin via createdByField hook on
  //    insert. Inheriting the source's createdBy is wrong.
  const sourceData = stripManagedFields(source as unknown as Record<string, unknown>)
  const baseTitle = typeof sourceData.title === 'string' ? sourceData.title : 'Untitled'
  const {
    slug: _ignoreSlug,
    blocks: _ignoreBlocks,
    translatedFrom: _ignoreTranslatedFrom,
    createdBy: _ignoreCreatedBy,
    ...restSource
  } = sourceData as Record<string, unknown>
  void _ignoreSlug
  void _ignoreBlocks
  void _ignoreTranslatedFrom
  void _ignoreCreatedBy
  const newLessonData = {
    ...restSource,
    title: `${baseTitle} - Copy`,
    status: 'draft', // never publish a duplicate by default
  }

  const newLesson = await req.payload.create({
    collection: 'lessons',
    data: newLessonData as never,
    overrideAccess: true,
    req,
  })

  // Clone all exercises that belong to the source lesson. We prefer
  // `lesson.blocks[].exercise` ids (authoritative) and fall back to the FK
  // reverse query. The previous FK-only path silently cloned 0 exercises for
  // lessons whose blocks reference exercises owned by a different lesson.
  const { getSourceExercisesForLesson } =
    await import('@/server/services/lesson-duplication/source-exercises')
  const exerciseDocs = await getSourceExercisesForLesson(req.payload, sourceLessonId)

  // Per-exercise isolation: if any single exercise fails create (e.g. Zod
  // strict mode trips on a legacy field like `labelSize` no longer in the
  // block schema), don't kill the whole copy. Log it, count it, move on.
  // Without this guard, a 44-exercise lesson with one bad exercise produces
  // zero cloned exercises and a top-level 'Content > Content' error.
  const cloneFailures: Array<{ id: string; reason: string }> = []
  for (const exercise of exerciseDocs) {
    try {
      const exData = stripManagedFields(exercise as unknown as Record<string, unknown>)
      await req.payload.create({
        collection: 'exercises',
        data: { ...exData, lesson: newLesson.id } as never,
        overrideAccess: true,
        req,
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown'
      cloneFailures.push({ id: exercise.id, reason })
      req.payload.logger.warn(
        `[deepCloneLesson] skipped exercise ${exercise.id} during deep clone: ${reason}`,
      )
    }
  }
  if (cloneFailures.length > 0) {
    req.payload.logger.warn(
      `[deepCloneLesson] ${cloneFailures.length} of ${exerciseDocs.length} exercises failed to clone for lesson ${sourceLessonId}`,
    )
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

  // 2) Lesson id from path: /lessons/:id/duplicate-variation
  // Path was renamed from /duplicate to /duplicate-variation because Payload's
  // built-in collection duplicate handler also registers /lessons/:id/duplicate
  // and shadowed our custom endpoint, silently routing requests to its dumb
  // field-copy instead.
  const url = new URL(req.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/duplicate(?:-variation)?/)
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

  // 4) Validate subject (required for level != none)
  let subject: DuplicationSubject | undefined
  if (level !== 'none') {
    if (!isSubject(body.subject)) {
      return Response.json(
        { error: `subject must be one of: ${DUPLICATION_SUBJECTS.join(', ')}` },
        { status: 400 },
      )
    }
    subject = body.subject
  }

  // 5) Verify source lesson exists
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
      subject,
      status: 'pending',
    } as never,
    overrideAccess: true,
    req,
  })

  // 7) For level=none, deep-clone immediately
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

  // 8) For light/medium/deep, just leave the record in `pending`. The
  //    cron worker at /api/cron/process-duplications polls every minute and
  //    runs the orchestrator with a wall-clock budget. The orchestrator is
  //    resumable: each completed exercise is streamed to the record, so a
  //    Vercel function timeout mid-run leaves clean partial state and the
  //    next cron tick continues. No fire-and-forget HTTP, no Payload
  //    job-queue indirection — the cron is the single trigger path.
  return Response.json({ id: record.id, status: 'pending' })
}
