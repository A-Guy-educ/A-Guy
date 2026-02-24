/**
 * Streaming Chat Endpoint Handler
 * Handles SSE-based streaming for context-scoped chat
 *
 * @fileType endpoint
 * @domain chat
 * @pattern streaming, sse, server-sent-events
 *
 * Features:
 * - SSE delivery with chunk/done/error events
 * - Persistence after stream completion
 * - Background tasks after stream completes
 * - Partial text persistence on error/disconnect
 */
import { streamChatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import type { Logger } from 'pino'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { scheduleMemoryExtraction, scheduleSummaryMaintenance } from './chat/background-tasks'
import type { ResolvedContext } from './chat/context-resolution'
import { chatRequestSchema, parseRequestBody } from './chat/index'
import {
  extractPipelineContextCandidate,
  persistAssistantMessage,
  runChatPipeline,
} from './chat/pipeline'
import {
  createSSEHeaders,
  formatChunkEvent,
  formatDoneEvent,
  formatErrorEvent,
} from './chat/sse-helpers'
import { checkRateLimit } from '@/server/services/rate-limit'
import {
  buildGuestSessionCookieHeader,
  checkAndIncrementGuestMessageCount,
  createGuestSession,
  getGuestSessionByToken,
  getGuestSessionCookie,
  hashIP,
  hashUserAgent,
} from '@/server/services/guest-session'

/**
 * Handle streaming chat for context-scoped conversations
 * Uses SSE to stream tokens as they're generated
 */
export async function agentChatStream(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  let guestSession: Awaited<ReturnType<typeof getGuestSessionByToken>> | null = null
  let isGuestMode = false
  let guestCookieHeader: string | undefined

  // 1) Auth - check for authenticated user OR guest session
  // req.user is set by Payload middleware for real HTTP requests.
  // Fall back to payload.auth() for cases where middleware hasn't run.
  let user = req.user
  if (!user) {
    const authResult = await req.payload.auth({ headers: req.headers })
    user = authResult.user
  }

  if (!user) {
    // Check for guest session
    const guestToken = getGuestSessionCookie(req.headers as unknown as Headers)
    if (guestToken) {
      guestSession = await getGuestSessionByToken(req.payload, guestToken)
    }

    if (!guestSession) {
      // Create new guest session
      const ipHash = hashIP(req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip'))
      const userAgentHash = hashUserAgent(req.headers?.get('user-agent'))

      // Check rate limit for new guests
      const rateLimitResult = await checkRateLimit(ipHash, userAgentHash)
      if (!rateLimitResult.allowed) {
        return Response.json(
          {
            error: 'Too many requests. Please try again later.',
            isGuestMode: true,
            retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            },
          },
        )
      }

      const { session, token } = await createGuestSession(req.payload, {
        ipHash,
        userAgentHash,
      })
      guestSession = session
      isGuestMode = true

      guestCookieHeader = await buildGuestSessionCookieHeader(token)
    } else {
      isGuestMode = true

      const messageLimit = await checkAndIncrementGuestMessageCount(req.payload, guestSession.id)
      if (!messageLimit.allowed) {
        return Response.json(
          {
            error: 'Guest message limit reached. Sign up for unlimited access.',
            isGuestMode: true,
            retryAfter: null,
          },
          {
            status: 429,
            headers: {
              'X-Guest-Message-Limit': 'true',
            },
          },
        )
      }
    }
  }

  // No auth at all - reject
  if (!user && !guestSession) {
    return Response.json(
      { error: 'Authentication or guest session required', isGuestMode: false },
      { status: 401 },
    )
  }

  try {
    // 2) Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parseResult = await parseRequestBody(req.json.bind(req))
    if (!parseResult.success) {
      return Response.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const validated: z.infer<typeof chatRequestSchema> = parseResult.data

    // 3) Check if admin mode - streaming doesn't support admin mode
    // Reject adminMode regardless of user role (streaming doesn't support it)
    if (validated.adminMode === true) {
      return Response.json(
        { error: 'Admin mode is not supported in streaming mode' },
        { status: 400 },
      )
    }

    // 4) Check for media attachments - streaming doesn't support multimodal
    if (validated.mediaIds && validated.mediaIds.length > 0) {
      return Response.json(
        { error: 'Media attachments are not supported in streaming mode' },
        { status: 400 },
      )
    }

    // 5) Extract context candidate
    const contextCandidate = extractPipelineContextCandidate(validated)
    if (!contextCandidate) {
      return Response.json(
        { error: 'Missing context ID (requires exerciseId, lessonId, chapterId, or courseId)' },
        { status: 400 },
      )
    }

    // 6) Run shared pipeline
    const pipelineResult = await runChatPipeline(
      req,
      requestId,
      validated,
      contextCandidate,
      reqLogger,
      guestSession?.id,
    )

    if ('response' in pipelineResult) {
      return pipelineResult.response
    }

    const { result: pipelineData } = pipelineResult
    const { conversationId, context, allMessages, composedPrompt } = pipelineData

    reqLogger.info({ conversationId, contextKey: context.contextKey }, 'Starting streaming chat')

    // 7) Call streaming LLM
    let streamingResult
    try {
      streamingResult = await streamChatWithExerciseHelper(
        {
          message: validated.message,
          acknowledgment: validated.acknowledgment || '',
          composedPrompt: composedPrompt,
          req: {
            headers: {
              authorization:
                (req.headers && typeof req.headers.get === 'function'
                  ? req.headers.get('authorization')
                  : undefined) || undefined,
              cookie:
                (req.headers && typeof req.headers.get === 'function'
                  ? req.headers.get('cookie')
                  : undefined) || undefined,
            },
          },
        },
        req.payload,
      )
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
      reqLogger.error({ err: streamError }, 'Streaming chat failed')
      return Response.json(
        { error: errorMessage || 'Failed to start streaming chat' },
        { status: 500 },
      )
    }

    const { stream } = streamingResult

    // 8) Create SSE ReadableStream
    const sseStream = new ReadableStream({
      async start(controller) {
        let fullText = ''

        try {
          // Iterate over stream chunks
          for await (const chunk of stream) {
            fullText += chunk.text
            // Enqueue SSE chunk event
            controller.enqueue(formatChunkEvent(chunk.text))
          }

          reqLogger.info({ conversationId, textLength: fullText.length }, 'Stream completed')

          // Stream completed normally - persist assistant message
          try {
            await persistAssistantMessage(
              req.payload,
              conversationId,
              allMessages,
              fullText,
              req.user,
            )
            reqLogger.info({ conversationId }, 'Assistant message persisted')
          } catch (persistError) {
            reqLogger.warn(
              { err: persistError, conversationId },
              'Failed to persist assistant message',
            )
          }

          // Schedule background tasks
          try {
            scheduleSummaryMaintenance(req.payload, conversationId, reqLogger as Logger)
            // Schedule memory extraction for both users and guests
            const memoryOwnerId = req.user?.id ?? guestSession?.id
            if (memoryOwnerId) {
              scheduleMemoryExtraction(
                req.payload,
                conversationId,
                memoryOwnerId,
                context as ResolvedContext,
                { id: memoryOwnerId },
                reqLogger as Logger,
              )
            }
          } catch (bgError) {
            reqLogger.warn({ err: bgError, conversationId }, 'Failed to schedule background tasks')
          }

          // Enqueue done event with guest mode status
          controller.enqueue(
            formatDoneEvent({ conversationId, contextKey: context.contextKey, isGuestMode }),
          )
          controller.close()
        } catch (error) {
          reqLogger.error({ err: error, conversationId }, 'Error during streaming')

          // Persist partial text if any
          if (fullText.length > 0) {
            try {
              await persistAssistantMessage(
                req.payload,
                conversationId,
                allMessages,
                fullText,
                req.user,
              )
              reqLogger.info(
                { conversationId, textLength: fullText.length },
                'Partial assistant message persisted after error',
              )
            } catch (persistError) {
              reqLogger.warn(
                { err: persistError, conversationId },
                'Failed to persist partial assistant message',
              )
            }
          }

          // Enqueue error event
          const errorMessage = error instanceof Error ? error.message : 'Stream error'
          controller.enqueue(formatErrorEvent(errorMessage, 'STREAM_ERROR'))
          controller.error(error)
        }
      },
    })

    const responseHeaders = new Headers(createSSEHeaders())
    if (guestCookieHeader) {
      responseHeaders.set('Set-Cookie', guestCookieHeader)
    }
    return new Response(sseStream, {
      headers: responseHeaders,
    })
  } catch (error) {
    // Handle connection reset errors gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
    ) {
      reqLogger.debug({ err: error }, 'Client disconnected during streaming chat request')
      return Response.json({ error: 'Request cancelled' }, { status: 499 })
    }

    reqLogger.error({ err: error }, 'Streaming chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
