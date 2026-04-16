/**
 * POST /api/exercises/import-latex-unified
 * Unified LaTeX import with script-first, AI-fallback behavior.
 *
 * Order of attempts:
 *  1. Script parser (deterministic) — always tried first.
 *  2. AI parser — tried only if script produced zero exercises AND fallback is enabled.
 *
 * Partial success on the script side (≥1 exercise) short-circuits: no AI fallback.
 *
 * Access: Authenticated users only
 */
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { parseLatexToExercises } from '@/lib/latex-parser'
import { logger } from '@/infra/utils/logger'
import { getConfigValueByKey } from '@/infra/config/runtime'
import { ConfigDomain } from '@/infra/config/config-constants'

const ImportLatexSchema = z.object({
  latex: z.string().min(1).max(500_000),
  lessonId: z.string().min(1),
})

type ImportMethod = 'script' | 'ai_fallback'

export async function importExerciseFromLatexUnified(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const body = (req as PayloadRequest & { json?: unknown }).json
  const parsed = ImportLatexSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.message }, { status: 400 })
  }

  const { latex, lessonId } = parsed.data
  const reqLogger = logger.child({
    requestId: crypto.randomUUID(),
    feature: 'latex_import_unified',
  })

  // Verify lesson exists up-front so AI fallback doesn't need to repeat it.
  try {
    await req.payload.findByID({ collection: 'lessons', id: lessonId })
  } catch {
    return Response.json({ success: false, error: 'Lesson not found' }, { status: 404 })
  }

  const scriptResult = parseLatexToExercises(latex)
  const scriptExerciseCount = scriptResult.exercises.length
  const scriptHasErrors = scriptResult.errors.length > 0

  reqLogger.info(
    {
      scriptExerciseCount,
      scriptErrorCount: scriptResult.errors.length,
      scriptWarningCount: scriptResult.warnings.length,
    },
    'Script parser attempt complete',
  )

  // Script succeeded with at least one exercise → persist and return.
  if (scriptExerciseCount > 0 && !scriptHasErrors) {
    return createExercisesAndRespond({
      req,
      latex,
      lessonId,
      groups: scriptResult.exercises,
      warnings: scriptResult.warnings,
      method: 'script',
      logger: reqLogger,
    })
  }

  // Script failed. Check fallback toggle.
  const fallbackEnabled = await isFallbackEnabled(req)
  if (!fallbackEnabled) {
    reqLogger.warn(
      { scriptErrors: scriptResult.errors },
      'Script import failed and fallback disabled',
    )
    return Response.json(
      {
        success: false,
        method: 'script' as ImportMethod,
        errors: scriptResult.errors,
        error:
          scriptExerciseCount === 0 ? 'No parseable content found' : 'Script import had errors',
      },
      { status: 422 },
    )
  }

  // Fallback to AI. Delegate via internal fetch so we reuse the existing AI route end-to-end.
  reqLogger.info({ scriptErrors: scriptResult.errors.length }, 'Falling back to AI import')
  emitFallbackAnalytics(req, {
    lessonId,
    scriptErrors: scriptResult.errors.length,
  })

  const aiResponse = await callAiImport(req, { latex, lessonId })
  if (!aiResponse.ok) {
    const errBody = await aiResponse.text()
    reqLogger.error(
      { status: aiResponse.status, body: errBody.slice(0, 500) },
      'AI fallback failed',
    )
    return Response.json(
      {
        success: false,
        method: 'ai_fallback' as ImportMethod,
        error: 'AI fallback failed',
      },
      { status: aiResponse.status },
    )
  }

  const aiData = (await aiResponse.json()) as {
    success: boolean
    data?: { exerciseIds: string[]; exerciseCount: number; warnings?: unknown[] }
    error?: string
  }

  return Response.json({
    success: aiData.success,
    method: 'ai_fallback' as ImportMethod,
    data: aiData.data,
    aiSucceeded: aiData.success,
  })
}

interface CreateExercisesArgs {
  req: PayloadRequest
  latex: string
  lessonId: string
  groups: Array<{ title: string; blocks: unknown[] }>
  warnings: unknown[]
  method: ImportMethod
  logger: typeof logger
}

async function createExercisesAndRespond(args: CreateExercisesArgs): Promise<Response> {
  const { req, latex, lessonId, groups, warnings, method, logger: reqLogger } = args
  try {
    const existing = await req.payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      limit: 0,
    })
    const startOrder = existing.totalDocs
    const createdIds: string[] = []

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const exercise = await req.payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: group.title || undefined,
          content: { blocks: group.blocks as never },
          origin: 'import',
          order: startOrder + i,
          sourceLatex: latex,
        },
        draft: true,
      })
      createdIds.push(exercise.id)
    }

    reqLogger.info({ lessonId, count: createdIds.length, method }, 'Exercises created')

    return Response.json({
      success: true,
      method,
      data: {
        exerciseIds: createdIds,
        exerciseCount: createdIds.length,
        warnings,
      },
    })
  } catch (err) {
    reqLogger.error({ err }, 'Failed to save exercises')
    const message = err instanceof Error ? err.message : 'Failed to save exercises'
    return Response.json({ success: false, method, error: message }, { status: 422 })
  }
}

async function isFallbackEnabled(_req: PayloadRequest): Promise<boolean> {
  try {
    const value = await getConfigValueByKey<boolean | string | undefined>(
      ConfigDomain.LatexConversion,
      'fallback_enabled',
      { defaultValue: true, throwIfNotFound: false },
    )
    // Support both boolean and string config storage; explicit 'false' / false disables.
    if (value === false || value === 'false') return false
    return true
  } catch {
    // Fail open: fallback defaults to enabled even if config lookup breaks.
    return true
  }
}

async function callAiImport(
  req: PayloadRequest,
  { latex, lessonId }: { latex: string; lessonId: string },
): Promise<globalThis.Response> {
  const origin = deriveOrigin(req)
  const cookie = req.headers.get('cookie') || ''
  return fetch(`${origin}/api/exercises/import-latex-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify({ latex, lessonId }),
  })
}

function deriveOrigin(req: PayloadRequest): string {
  try {
    if (req.url) {
      const u = new URL(req.url)
      return `${u.protocol}//${u.host}`
    }
  } catch {
    // fall through
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

function emitFallbackAnalytics(
  req: PayloadRequest,
  props: { lessonId: string; scriptErrors: number },
): void {
  // Server-side: emit as a structured log entry with a stable event marker so
  // the analytics pipeline (Pino → log processor) can aggregate fallback rates.
  // Client-side @/infra/analytics/core/tracker is not importable from this path.
  logger.info(
    {
      event: 'latex_import_fallback',
      lessonId: props.lessonId,
      scriptErrors: props.scriptErrors,
      userId: req.user?.id,
    },
    'latex_import_fallback',
  )
}
