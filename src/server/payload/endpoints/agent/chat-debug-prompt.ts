/**
 * Debug endpoint — returns the exact composed system prompt and structured
 * messages that would be sent to the LLM for a given chat request, WITHOUT
 * actually calling the model. Lets us audit what reaches Gemini for a
 * lesson/exercise without burning a model call or fishing in Vercel logs.
 *
 * @fileType endpoint
 * @domain chat
 * @pattern admin-only, debug
 *
 * Auth: admin role required (composed prompts may include teacher-profile
 * templates, lesson exercises with hint/solution data, and other content that
 * shouldn't leak to students or guests).
 */
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { ConversationService } from '@/server/services/conversation-service'
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import {
  composeFullSystemInstructions,
  fetchLessonContextForContext,
  parseRequestBody,
  resolveContext,
  type ResolvedContext,
} from './chat/index'
import { extractContextCandidate } from './chat/request-validation'

export async function agentChatDebugPrompt(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId, route: 'debug-prompt' })

  // 1) Auth — admin only
  let user = req.user
  if (!user) {
    const authResult = await req.payload.auth({ headers: req.headers })
    user = authResult.user
  }
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userRole = isUsersCollectionUser(user)
    ? ((user as unknown as { role: AccountRole }).role as AccountRole)
    : AccountRole.Student
  if (userRole !== AccountRole.Admin) {
    return Response.json({ error: 'Admin role required for debug endpoint' }, { status: 403 })
  }

  // 2) Parse body — accept the same chat request shape, plus an optional
  //    debugHistory array so admins can simulate multi-turn without
  //    persisting a real conversation.
  if (!req.json) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  const rawBody = (await req.json()) as Record<string, unknown>
  const debugHistoryRaw = Array.isArray(rawBody.debugHistory) ? rawBody.debugHistory : []
  // Re-validate the rest via the chat schema (strip debug-only fields)
  const parseResult = await parseRequestBody(async () => {
    const { debugHistory, ...rest } = rawBody as { debugHistory?: unknown }
    void debugHistory
    return rest
  })
  if (!parseResult.success) {
    return Response.json(
      { error: 'Invalid request', details: parseResult.error.issues },
      { status: 400 },
    )
  }
  const validated = parseResult.data

  // 3) Resolve context
  const candidate = extractContextCandidate(validated)
  if (!candidate) {
    return Response.json(
      {
        error:
          'Missing context ID (requires exerciseId, lessonId, chapterId, courseId, or categoryId)',
      },
      { status: 400 },
    )
  }
  const conversationService = new ConversationService(req.payload)
  const context: ResolvedContext = await resolveContext(conversationService, validated)

  // 4) Fetch lesson context (lesson title, chapter, course, exercises[], lessonContextText, lessonContextBlock)
  const ownerId = user.id as string
  const lessonContext = await fetchLessonContextForContext(
    req.payload,
    context,
    { id: ownerId },
    reqLogger as Logger,
    validated.courseId,
  )

  // 5) Compose the full system instructions exactly as the chat pipeline does
  const hasImageAttached =
    (validated.mediaIds?.length ?? 0) > 0 || (validated.chatAssetIds?.length ?? 0) > 0
  const composed = await composeFullSystemInstructions(
    req.payload,
    lessonContext.lessonPrompt,
    reqLogger as Logger,
    lessonContext.coursePrompt,
    lessonContext.courseContextText,
    user.id as string,
    lessonContext.lessonContextBlock,
    lessonContext.lessonContextText,
    lessonContext.exercises,
    hasImageAttached,
  )

  // 6) Build the recent-window + composed messages exactly the way the
  //    pipeline does, so we can show what would land in `messages[]`.
  // Note: we intentionally do NOT touch the conversations collection here.
  // We synthesize the messages from the request and any provided history
  // so the endpoint is side-effect-free.
  const synthHistory: Message[] = debugHistoryRaw.map((m: unknown) => {
    const msg = m as { role?: string; content?: string; timestamp?: string }
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content ?? '',
      timestamp: msg.timestamp ?? new Date().toISOString(),
    }
  })
  const allMessages: Message[] = [
    ...synthHistory,
    {
      role: 'user',
      content: validated.message,
      timestamp: new Date().toISOString(),
    },
  ]
  const recentMessages = getRecentWindow(allMessages)
  const composedPrompt = composePrompt(composed.instructions, {
    systemMessage: composed.instructions,
    summary: undefined,
    memoryItems: [],
    recentMessages,
  })

  // 7) Build the Genkit-shaped messages array that the adapter would emit.
  //    Mirrors src/infra/llm/genkit/adapters/unified-adapter.ts buildGenkitMessages.
  const genkitMessages = [
    { role: 'system' as const, content: [{ text: composed.instructions }] },
    ...recentMessages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      content: [{ text: m.content }],
    })),
  ]

  return Response.json({
    requestId,
    context: {
      relationTo: context.relationTo,
      value: context.value,
      contextKey: context.contextKey,
    },
    hasImageAttached,
    promptResolution: composed.promptResolution,
    teacherProfile: {
      slug: composed.teacherProfileSlug,
      resolvedFrom: composed.teacherProfileResolvedFrom,
    },
    lessonContext: {
      lessonPromptId:
        lessonContext.lessonPrompt && typeof lessonContext.lessonPrompt === 'object'
          ? (lessonContext.lessonPrompt as { id?: string }).id
          : null,
      coursePromptId:
        lessonContext.coursePrompt && typeof lessonContext.coursePrompt === 'object'
          ? (lessonContext.coursePrompt as { id?: string }).id
          : null,
      courseContextText: lessonContext.courseContextText,
      lessonContextText: lessonContext.lessonContextText,
      lessonContextBlock: lessonContext.lessonContextBlock,
      exerciseCount: Array.isArray(lessonContext.exercises) ? lessonContext.exercises.length : 0,
      exercises: Array.isArray(lessonContext.exercises)
        ? lessonContext.exercises.map((e) => ({ id: e.id, title: e.title }))
        : [],
    },
    composedSystemMessageLength: composed.instructions.length,
    composedSystemMessage: composed.instructions,
    composedPrompt: {
      messageCount: composedPrompt.messages.length,
      messages: composedPrompt.messages,
      metadata: composedPrompt.metadata,
    },
    genkitMessages,
  })
}
