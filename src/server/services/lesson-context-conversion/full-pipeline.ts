/**
 * Full conversion pipelines for lesson media and LaTeX attachments.
 *
 * Each pipeline runs Stage 1 + Stage 2 + Stage 3 in sequence so admins
 * can click one button and end up with typed exercise blocks attached
 * to the lesson playlist:
 *
 *   - runFullMediaPipeline: PDF/image → Gemini schema-mode extraction →
 *     create exercises → convert each LaTeX block to typed blocks.
 *
 *   - runFullLatexPipeline: .tex file → write the file content directly
 *     into ContextExtractions.text → split into exercises via the
 *     deterministic context-exercise parser → convert each LaTeX block
 *     to typed blocks. No Gemini call for splitting; the per-exercise
 *     LaTeX conversion still uses the existing AI fallback when the
 *     deterministic parser can't handle a block.
 */
import type { Payload, PayloadRequest, User } from 'payload'
import { fetchBuffer } from '@/infra/utils/http'
import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { logger } from '@/infra/utils/logger'
import type { Lesson, Media } from '@/payload-types'
import { convertLatexBlockOnExercise } from '@/server/payload/endpoints/exercises/convert-latex-block'
import { getPdfBufferFromBlob, normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import { extractLessonContext } from './extract-context'
import { createExercisesFromExtraction } from './create-exercises-from-extraction'

export interface FullPipelineResult {
  success: boolean
  exerciseCount: number
  exerciseIds: string[]
  /** Number of exercises whose LaTeX block was successfully converted to typed blocks. */
  latexBlocksConverted: number
  /** Number of exercises where the LaTeX-block conversion was attempted but produced no structured output. */
  latexBlocksFailed: number
  warnings: string[]
  error?: string
}

/**
 * Stage 3 invocation per exercise. Reuses the existing endpoint handler
 * (which already has retry/fallback logic) by synthesizing a minimal
 * PayloadRequest. Failures are surfaced as warnings rather than aborting
 * the pipeline — the exercise still exists with its raw LaTeX block.
 */
async function convertLatexBlocksOnExercises(
  payload: Payload,
  user: User,
  exerciseIds: string[],
  warnings: string[],
): Promise<{ converted: number; failed: number }> {
  let converted = 0
  let failed = 0

  for (const exerciseId of exerciseIds) {
    try {
      const fakeReq = {
        payload,
        user,
        url: 'http://internal/full-pipeline',
        headers: new Headers(),
        routeParams: {},
        context: {},
      } as unknown as PayloadRequest

      const response = await convertLatexBlockOnExercise(fakeReq, exerciseId)
      const data = (await response.json()) as { success?: boolean; error?: string }

      if (data.success) {
        converted++
      } else {
        failed++
        warnings.push(
          `Exercise ${exerciseId}: LaTeX block conversion did not succeed${data.error ? ' — ' + data.error : ''}`,
        )
      }
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : 'Unknown error'
      warnings.push(`Exercise ${exerciseId}: LaTeX block conversion threw — ${message}`)
      logger.error({ err, exerciseId }, '[full-pipeline] convertLatexBlock failed')
    }
  }

  return { converted, failed }
}

export interface RunFullMediaInput {
  payload: Payload
  user: User
  lessonId: string
  mediaId: string
  promptId: string
}

export async function runFullMediaPipeline(input: RunFullMediaInput): Promise<FullPipelineResult> {
  const { payload, user, lessonId, mediaId, promptId } = input
  const warnings: string[] = []

  // Stage 1 — schema-mode Gemini extraction.
  const stage1 = await extractLessonContext(payload, user, {
    lessonId,
    promptId,
    mediaId,
    mode: 'replace',
  })

  if (!stage1.success) {
    if (stage1.warnings) warnings.push(...stage1.warnings)
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: stage1.error || 'Stage 1 (extraction) failed',
    }
  }
  if (stage1.warnings) warnings.push(...stage1.warnings)

  // Stage 2 — create exercises from the extraction.
  const stage2 = await createExercisesFromExtraction({ payload, user, lessonId })
  if ('error' in stage2) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: stage2.error.message,
    }
  }
  warnings.push(...stage2.warnings)

  // Stage 3 — convert LaTeX block on each created exercise.
  const stage3 = await convertLatexBlocksOnExercises(payload, user, stage2.exerciseIds, warnings)

  return {
    success: true,
    exerciseCount: stage2.exerciseCount,
    exerciseIds: stage2.exerciseIds,
    latexBlocksConverted: stage3.converted,
    latexBlocksFailed: stage3.failed,
    warnings,
  }
}

export interface RunFullLatexInput {
  payload: Payload
  user: User
  lessonId: string
  mediaId: string
}

/**
 * Pull the file bytes for the attached .tex media. The Media collection
 * stores files in Vercel Blob in production; locally it falls through to
 * a normalized URL fetch.
 */
async function readLatexFileContent(
  payload: Payload,
  user: User,
  mediaId: string,
): Promise<string> {
  const media = (await payload.findByID({
    collection: 'media',
    id: mediaId,
    depth: 0,
    user,
    overrideAccess: false,
  })) as unknown as Media

  if (!media?.url) {
    throw new Error('Media file has no URL')
  }

  let fetchUrl = media.url
  if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
    fetchUrl = await normalizeToAbsoluteUrl(fetchUrl)
  }

  let buffer: Buffer
  if (isVercelBlobUrl(fetchUrl)) {
    const { getPdfBufferFromUrl } = await import('@/infra/blob/vercel-blob-adapter')
    buffer = await getPdfBufferFromUrl(fetchUrl)
  } else {
    try {
      buffer = await getPdfBufferFromBlob(mediaId, payload)
    } catch {
      buffer = await fetchBuffer(fetchUrl, 30000)
    }
  }

  return buffer.toString('utf-8')
}

export async function runFullLatexPipeline(input: RunFullLatexInput): Promise<FullPipelineResult> {
  const { payload, user, lessonId, mediaId } = input
  const warnings: string[] = []

  // Read the .tex file content.
  let latexContent: string
  try {
    latexContent = await readLatexFileContent(payload, user, mediaId)
  } catch (err) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: `Failed to read .tex file: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  if (!latexContent.trim()) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: 'The .tex file is empty.',
    }
  }

  // Validate the lesson + media association upfront so we don't write a
  // ContextExtraction for a lesson that wouldn't otherwise allow it.
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    user,
    overrideAccess: false,
  })) as unknown as Lesson

  if (!lesson) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: 'Lesson not found',
    }
  }

  const contentFileIds = (lesson.contentFiles || []).map((cf) =>
    typeof cf === 'string' ? cf : (cf as unknown as { id: string }).id,
  )
  if (!contentFileIds.includes(mediaId)) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: 'Media file is not attached to this lesson',
    }
  }

  // Upsert ContextExtraction with the raw LaTeX. exercises is null so
  // Stage 2 falls back to the deterministic parseContextText path.
  const existing = await payload.find({
    collection: 'context-extractions',
    where: {
      lesson: { equals: lessonId },
      sourceMedia: { equals: mediaId },
    },
    limit: 1,
    depth: 0,
  })

  const data = { text: latexContent, exercises: null } as Record<string, unknown>

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'context-extractions',
      id: existing.docs[0].id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      user,
      overrideAccess: false,
    })
  } else {
    await payload.create({
      collection: 'context-extractions',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { lesson: lessonId, sourceMedia: mediaId, ...data } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: user as any,
      overrideAccess: false,
    })
  }

  // Stage 2 — split text into exercises via the deterministic parser.
  const stage2 = await createExercisesFromExtraction({ payload, user, lessonId })
  if ('error' in stage2) {
    return {
      success: false,
      exerciseCount: 0,
      exerciseIds: [],
      latexBlocksConverted: 0,
      latexBlocksFailed: 0,
      warnings,
      error: stage2.error.message,
    }
  }
  warnings.push(...stage2.warnings)

  // Stage 3 — convert LaTeX block on each created exercise.
  const stage3 = await convertLatexBlocksOnExercises(payload, user, stage2.exerciseIds, warnings)

  return {
    success: true,
    exerciseCount: stage2.exerciseCount,
    exerciseIds: stage2.exerciseIds,
    latexBlocksConverted: stage3.converted,
    latexBlocksFailed: stage3.failed,
    warnings,
  }
}
