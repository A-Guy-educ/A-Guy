/**
 * DELETE /api/cascade-delete?collection=<slug>&id=<id>
 *
 * Cascade-deletes a course, chapter, or lesson and all its descendants.
 *
 * - Lesson:  delete all exercises → delete the lesson
 * - Chapter: cascade-delete all lessons → delete the chapter
 * - Lesson with no exercises: normal delete
 *
 * Access: Admin only
 */
import type { PayloadRequest } from 'payload'

type CollectionSlug = 'courses' | 'chapters' | 'lessons'

interface DeleteResult {
  collection: string
  id: string
  deleted: boolean
  children: DeleteResult[]
}

/**
 * Cascade-delete a single lesson: delete its exercises, then the lesson itself.
 */
async function cascadeDeleteLesson(req: PayloadRequest, lessonId: string): Promise<DeleteResult> {
  const children: DeleteResult[] = []

  // Find all exercises belonging to this lesson
  const exercises = await req.payload.find({
    collection: 'exercises',
    where: { lesson: { equals: lessonId } },
    limit: 0, // all
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Delete each exercise
  for (const exercise of exercises.docs) {
    await req.payload.delete({
      collection: 'exercises',
      id: exercise.id,
      overrideAccess: true,
      req,
    })
    children.push({
      collection: 'exercises',
      id: exercise.id,
      deleted: true,
      children: [],
    })
  }

  // Delete the lesson itself
  await req.payload.delete({
    collection: 'lessons',
    id: lessonId,
    overrideAccess: true,
    req,
  })

  return {
    collection: 'lessons',
    id: lessonId,
    deleted: true,
    children,
  }
}

/**
 * Cascade-delete a single chapter: cascade-delete its lessons, then the chapter itself.
 */
async function cascadeDeleteChapter(req: PayloadRequest, chapterId: string): Promise<DeleteResult> {
  const children: DeleteResult[] = []

  // Find all lessons belonging to this chapter
  const lessons = await req.payload.find({
    collection: 'lessons',
    where: { chapter: { equals: chapterId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Cascade-delete each lesson
  for (const lesson of lessons.docs) {
    const result = await cascadeDeleteLesson(req, lesson.id)
    children.push(result)
  }

  // Delete the chapter itself
  await req.payload.delete({
    collection: 'chapters',
    id: chapterId,
    overrideAccess: true,
    req,
  })

  return {
    collection: 'chapters',
    id: chapterId,
    deleted: true,
    children,
  }
}

/**
 * Cascade-delete a single course: cascade-delete its chapters, then the course itself.
 */
async function cascadeDeleteCourse(req: PayloadRequest, courseId: string): Promise<DeleteResult> {
  const children: DeleteResult[] = []

  // Find all chapters belonging to this course
  const chapters = await req.payload.find({
    collection: 'chapters',
    where: { course: { equals: courseId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Cascade-delete each chapter
  for (const chapter of chapters.docs) {
    const result = await cascadeDeleteChapter(req, chapter.id)
    children.push(result)
  }

  // Delete the course itself
  await req.payload.delete({
    collection: 'courses',
    id: courseId,
    overrideAccess: true,
    req,
  })

  return {
    collection: 'courses',
    id: courseId,
    deleted: true,
    children,
  }
}

/** Count total deleted items recursively */
function countDeleted(result: DeleteResult): number {
  return 1 + result.children.reduce((sum, child) => sum + countDeleted(child), 0)
}

const ALLOWED_COLLECTIONS: CollectionSlug[] = ['courses', 'chapters', 'lessons']

export async function cascadeDeleteEndpoint(req: PayloadRequest): Promise<Response> {
  // 1) Auth — admin only
  const user = req.user
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!('role' in user) || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  // 2) Parse params
  const url = new URL(req.url || 'http://localhost')
  const collection = url.searchParams.get('collection') as CollectionSlug | null
  const id = url.searchParams.get('id')

  if (!collection || !id) {
    return Response.json(
      { error: 'Both "collection" and "id" query parameters are required' },
      { status: 400 },
    )
  }

  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return Response.json(
      { error: `Invalid collection. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  // 3) Verify the document exists
  try {
    await req.payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return Response.json(
      { error: `${collection} document with id "${id}" not found` },
      { status: 404 },
    )
  }

  // 4) Cascade delete
  try {
    let result: DeleteResult

    switch (collection) {
      case 'lessons':
        result = await cascadeDeleteLesson(req, id)
        break
      case 'chapters':
        result = await cascadeDeleteChapter(req, id)
        break
      case 'courses':
        result = await cascadeDeleteCourse(req, id)
        break
    }

    const totalDeleted = countDeleted(result)

    return Response.json({
      success: true,
      message: `Cascade deleted ${collection} "${id}" and ${totalDeleted - 1} descendant(s)`,
      totalDeleted,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Cascade delete failed: ${message}` }, { status: 500 })
  }
}
