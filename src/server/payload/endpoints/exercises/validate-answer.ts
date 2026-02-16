/**
 * POST /api/exercises/validate-answer
 * Two-tier answer validation: DB normalization → LLM semantic fallback
 * Server-side only — no LLM logic exposed to client
 */
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { matchAnswer } from '@/lib/validation/answer-normalization'
import { validateWithLLM } from '@/infra/llm/services/answer-validation-service'
import { logger } from '@/infra/utils/logger'

const ValidateAnswerSchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  studentAnswer: z.string(),
})

export async function validateAnswer(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = req.json ? await req.json() : null
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = ValidateAnswerSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json(
      { success: false, error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 400 },
    )
  }

  const input = parseResult.data
  const startTime = Date.now()

  // Step 1: DB-based normalization
  const dbMatch = matchAnswer(input.studentAnswer, input.acceptedAnswers)

  if (dbMatch.matched) {
    reqLogger.info(
      {
        questionId: input.questionId,
        matchType: dbMatch.matchType,
        durationMs: Date.now() - startTime,
      },
      '[Answer Validation] DB match found',
    )
    return Response.json({
      success: true,
      data: { isCorrect: true, matchType: dbMatch.matchType },
    })
  }

  // Step 2: LLM-based semantic validation
  reqLogger.info({ questionId: input.questionId }, '[Answer Validation] No DB match, trying LLM')

  const llmResult = await validateWithLLM(
    {
      questionText: input.questionText,
      acceptedAnswers: input.acceptedAnswers,
      studentAnswer: input.studentAnswer,
    },
    req.payload,
  )

  const durationMs = Date.now() - startTime

  if (!llmResult.success) {
    reqLogger.error(
      { questionId: input.questionId, error: llmResult.error, durationMs },
      '[Answer Validation] LLM failed',
    )
    return Response.json({
      success: false,
      isLLMError: true,
      error: 'Unable to validate answer. Please try again.',
    })
  }

  reqLogger.info(
    { questionId: input.questionId, isCorrect: llmResult.data?.isCorrect, durationMs },
    '[Answer Validation] LLM result',
  )

  return Response.json({
    success: true,
    data: {
      isCorrect: llmResult.data?.isCorrect ?? false,
      matchType: 'semantic' as const,
      reasoning: llmResult.data?.reasoning,
    },
  })
}
