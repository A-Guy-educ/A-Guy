/**
 * Wrong Answer Help Endpoint
 * Calls Gemini directly to help students who answered incorrectly.
 * Bypasses the chat pipeline for the instruction (no user message persisted),
 * but persists the AI response in the conversation so it sticks in history.
 */
import { getGenkitInstance } from '@/infra/llm/genkit/genkit-instance'
import { resolveGenkitConfig } from '@/infra/llm/genkit/config-resolver'
import { logger } from '@/infra/utils/logger'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import { ConversationService } from '@/server/services/conversation-service'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  questionJson: z.string().min(1),
  studentAnswer: z.string().min(1),
  // Context params for conversation persistence
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
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

    const { questionJson, studentAnswer, exerciseId, lessonId, chapterId, courseId } = parsed.data

    reqLogger.info({ userId: req.user.id }, 'Processing wrong-answer help request')

    // Generate AI response via Genkit (bypasses chat pipeline)
    const tenantId = await getDefaultTenantId(req.payload)
    const ai = await getGenkitInstance(req.payload, tenantId)
    const config = await resolveGenkitConfig('EXERCISE_CHAT', tenantId, req.payload)

    const userPrompt = `Question data: ${questionJson}\n\nStudent's answer: "${studentAnswer}"`

    const result = await ai.generate({
      model: config.model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    })

    const responseText = result.text
    reqLogger.info({ responseLength: responseText.length }, 'Wrong-answer help generated')

    // Persist the assistant response in the conversation (if context provided)
    const hasContext = exerciseId || lessonId || chapterId || courseId
    let conversationId: string | undefined
    let contextKey: string | undefined

    if (hasContext) {
      try {
        const conversationService = new ConversationService(req.payload)
        const context = await conversationService.resolveContext({
          exerciseId,
          lessonId,
          chapterId,
          courseId,
        })

        contextKey = context.contextKey
        const conversation = await conversationService.getOrCreateActiveConversation(req.user.id, {
          relationTo: context.relationTo as 'courses' | 'chapters' | 'lessons' | 'exercises',
          value: context.value,
        })

        conversationId = conversation.id

        // Persist ONLY the assistant message (no user instruction)
        const existingMessages = conversation.messages || []
        const assistantMessage = {
          role: 'assistant' as const,
          content: responseText,
          timestamp: new Date().toISOString(),
        }

        await req.payload.update({
          collection: 'conversations',
          id: conversationId,
          data: {
            messages: [...existingMessages, assistantMessage],
            lastMessageAt: new Date().toISOString(),
          },
          user: req.user,
          overrideAccess: true,
        })

        reqLogger.info(
          { conversationId, contextKey },
          'Persisted assistant message to conversation',
        )
      } catch (persistError) {
        // Log but don't fail — the AI response was already generated
        reqLogger.error(
          { err: persistError },
          'Failed to persist wrong-answer help to conversation',
        )
      }
    }

    return Response.json({
      success: true,
      response: responseText,
      conversationId,
      contextKey,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Wrong-answer help failed')
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
