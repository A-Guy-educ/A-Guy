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

import { logger } from '@/infra/utils/logger'
import {
  DUPLICATION_LEVELS,
  DUPLICATION_SUBJECTS,
  type DuplicationLevel,
  type DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'

/**
 * Resolve the public origin for fire-and-forget callbacks (run-immediate ping).
 * Behind Vercel's proxy `req.url` is often the internal URL, not the public
 * one — so prefer explicit env vars, fall back to req.url, and last resort
 * localhost (dev). If all three are wrong, the fire-and-forget POST goes to
 * the void and the admin has to manually trigger the job from the jobs page.
 */
function resolvePublicOrigin(req: PayloadRequest): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  try {
    const url = new URL(req.url || 'http://localhost:3000')
    return `${url.protocol}//${url.host}`
  } catch {
    return 'http://localhost:3000'
  }
}

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

  // 8) For light/medium/deep, enqueue the orchestrator job AND trigger it.
  //    Payload's job queue is just a DB insert — nothing executes pending jobs
  //    on Vercel unless we explicitly ping /api/jobs/run-immediate. Without
  //    this two-step, records sat in `pending` forever and the entire AI
  //    pipeline was unreachable.
  let queuedJobId: string | number | null = null
  try {
    const queued = await req.payload.jobs.queue({
      task: 'lesson_duplication',
      input: { duplicationId: record.id },
      req,
    })
    queuedJobId = (queued as { id?: string | number }).id ?? null
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
      { error: `Failed to enqueue duplication job: ${message}`, id: record.id },
      { status: 500 },
    )
  }

  // Fire-and-forget the run-immediate ping. We do NOT await — the user shouldn't
  // wait for AI generation in the HTTP response. The runner endpoint is best-
  // effort: if it can't reach the job before the platform kills this function,
  // an admin can re-trigger via the jobs admin page.
  if (queuedJobId !== null) {
    const origin = resolvePublicOrigin(req)
    const cookieHeader = req.headers.get('cookie')
    void fetch(`${origin}/api/jobs/run-immediate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ jobId: String(queuedJobId) }),
      keepalive: true,
    }).catch((err) => {
      // Fire-and-forget — log so we can spot mis-routed runners in production.
      // The job is still queued and an admin can re-trigger from the jobs UI.
      logger.warn(
        { err, origin, jobId: queuedJobId, duplicationId: record.id },
        'Run-immediate ping failed; job remains queued',
      )
    })
  }

  return Response.json({ id: record.id, status: 'pending', jobId: queuedJobId })
}
