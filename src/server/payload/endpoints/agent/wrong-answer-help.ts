/**
 * Wrong Answer Help Endpoint
 * Calls Gemini directly to help students who answered incorrectly.
 * Bypasses the chat pipeline — no conversation persistence, no user message.
 */
import { getGenkitInstance } from '@/infra/llm/genkit/genkit-instance'
import { resolveGenkitConfig } from '@/infra/llm/genkit/config-resolver'
import { logger } from '@/infra/utils/logger'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  questionJson: z.string().min(1),
  studentAnswer: z.string().min(1),
})

const SYSTEM_PROMPT = `You are a supportive and encouraging tutor helping a student who answered a question incorrectly.
Your goal is to help them understand why their answer is wrong and guide them toward the correct solution.
Do NOT give the answer directly. Instead, explain the concept, point out the mistake, and encourage them to try again.
Be warm, patient, and brief (2-3 sentences max).`

export async function wrongAnswerHelp(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json?.()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { questionJson, studentAnswer } = parsed.data

    reqLogger.info({ userId: req.user.id }, 'Processing wrong-answer help request')

    const tenantId = await getDefaultTenantId(req.payload)
    const ai = await getGenkitInstance(req.payload, tenantId)
    const config = await resolveGenkitConfig('EXERCISE_CHAT', tenantId, req.payload)

    const userPrompt = `Question data: ${questionJson}\n\nStudent's answer: "${studentAnswer}"`

    const result = await ai.generate({
      model: config.model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    })

    reqLogger.info({ responseLength: result.text.length }, 'Wrong-answer help generated')

    return Response.json({ success: true, response: result.text })
  } catch (error) {
    reqLogger.error({ err: error }, 'Wrong-answer help failed')
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
