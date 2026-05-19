/**
 * GET /api/lessons/:id/export
 *
 * Exports a lesson and all its ordered exercises as a JSON file in canonical format.
 *
 * Access: admin only (401 unauthenticated, 403 non-admin).
 *
 * Response: Content-Type: application/json, Content-Disposition: attachment; filename="<slug>.json"
 *
 * Canonical JSON shape:
 * {
 *   class: "<grade level from course>",
 *   lesson_number: "<lesson.order>",
 *   topic: "<lesson.title>",
 *   exercises: [
 *     {
 *       exercise_number: "<1-indexed position>",
 *       level: "1",
 *       exercise_content: {
 *         data: { text, table, PNG, svg },
 *         sections: [
 *           {
 *             section_data: { text, table, PNG, svg },
 *             question_number: "א/ב/ג/...",
 *             question: { text, table, PNG, svg },
 *             hint: { text, table, PNG, svg },
 *             solution: { text, table, PNG, svg },
 *             full_solution: { text, table, PNG, svg },
 *             correct_option: { text, table, PNG, svg },
 *             wrong_options: [{ text, table, PNG, svg }, ...]
 *           }
 *         ]
 *       }
 *     }
 *   ]
 * }
 *
 * No internal fields (id, _id, __v, slug, origin, createdBy, tenant, locale,
 * chapter, course, pipelineVersion, etc.) appear in the output.
 *
 * @fileType api-route
 * @domain lessons
 * @pattern lesson-export
 * @ai-summary Exports a lesson and its ordered exercises as canonical JSON for admin review or sharing.
 */
import type { PayloadRequest } from 'payload'

import { buildCanonicalLessonExport } from '@/server/services/lesson-export/to-canonical-format'

type BlockEntry = { id: string; blockType: string; exercise?: string; contentPage?: string }

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

/**
 * Fetch the grade/class label (courseLabel) for a lesson by traversing:
 * lesson -> chapter -> course
 */
async function fetchClassLabel(
  req: PayloadRequest,
  lesson: Record<string, unknown>,
): Promise<string> {
  // Try to get chapter from lesson
  const chapterRel = lesson.chapter
  let chapterId: string | null = null

  if (chapterRel) {
    if (typeof chapterRel === 'string') {
      chapterId = chapterRel
    } else if (typeof chapterRel === 'object' && chapterRel !== null) {
      chapterId = (chapterRel as { id?: string }).id || null
    }
  }

  if (!chapterId) return ''

  // Fetch chapter to get course
  try {
    const chapter = (await req.payload.findByID({
      collection: 'chapters',
      id: chapterId,
      depth: 0,
      select: { course: true },
      overrideAccess: true,
      req,
    })) as { course?: string | { id?: string } } | null

    if (!chapter?.course) return ''

    let courseId: string | null = null
    const courseRel = chapter.course
    if (typeof courseRel === 'string') {
      courseId = courseRel
    } else if (typeof courseRel === 'object' && courseRel !== null) {
      courseId = (courseRel as { id?: string }).id || null
    }

    if (!courseId) return ''

    // Fetch course to get courseLabel
    const course = (await req.payload.findByID({
      collection: 'courses',
      id: courseId,
      depth: 0,
      select: { courseLabel: true },
      overrideAccess: true,
      req,
    })) as { courseLabel?: string } | null

    return course?.courseLabel || ''
  } catch {
    return ''
  }
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

  for (const block of blocks) {
    if (block.blockType === 'exerciseRef' && block.exercise) {
      exerciseIds.push(block.exercise)
    }
  }

  // 5) Fetch exercises in order
  const exerciseDocs: Record<string, unknown>[] = []
  for (const exId of exerciseIds) {
    try {
      const ex = (await req.payload.findByID({
        collection: 'exercises',
        id: exId,
        depth: 0,
        overrideAccess: true,
        req,
      })) as unknown as Record<string, unknown>
      exerciseDocs.push(ex)
    } catch {
      // Skip missing exercises
    }
  }

  // 6) Fetch class label (courseLabel) from chapter -> course hierarchy
  const classLabel = await fetchClassLabel(req, lesson)

  // 7) Build canonical export format
  const canonicalExport = buildCanonicalLessonExport(lesson, exerciseDocs, classLabel)

  const slug = (lesson.slug as string) || lessonId
  const filename = `${slug}.json`

  return new Response(JSON.stringify(canonicalExport, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
