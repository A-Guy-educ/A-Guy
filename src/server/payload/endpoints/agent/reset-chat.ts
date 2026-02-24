/**
 * POST /api/agent/reset-chat
 * Reset a conversation by archiving the current one and creating a new one
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, context-scoped, guest-session
 * @ai-summary Reset endpoint for context-scoped conversations with guest support
 *
 * Access: Authenticated users OR guest sessions
 *
 * Request body:
 * - contextKey: The context key (e.g., "exercises:abc123")
 *
 * Response:
 * - success: boolean
 * - conversationId: ID of the new conversation
 * - isGuestMode: boolean
 */
import { ConversationService } from '@/server/services/conversation-service'
import { logger } from '@/infra/utils/logger'
import { PayloadRequest } from 'payload'
import { z } from 'zod'
import {
  buildGuestSessionCookieHeader,
  createGuestSession,
  getGuestSessionByToken,
  getGuestSessionCookie,
  hashIP,
  hashUserAgent,
} from '@/server/services/guest-session'

const requestSchema = z.object({
  contextKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^(courses|chapters|lessons|exercises):[^:]+$/),
})

export async function agentResetChat(req: PayloadRequest & { json?: () => Promise<unknown> }) {
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
      const { session, token } = await createGuestSession(req.payload, {
        ipHash,
        userAgentHash,
      })
      guestSession = session
      isGuestMode = true

      guestCookieHeader = await buildGuestSessionCookieHeader(token)
    } else {
      isGuestMode = true
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

    const body = await req.json()
    const validated = requestSchema.parse(body)

    reqLogger.info(
      { userId: user?.id, guestSessionId: guestSession?.id, contextKey: validated.contextKey },
      'Processing reset chat request',
    )

    // 3) Initialize ConversationService
    const conversationService = new ConversationService(req.payload)

    // 4) Reset conversation (archive current, create new)
    let newConversation
    if (isGuestMode && guestSession) {
      newConversation = await conversationService.resetGuestConversation(
        guestSession.id,
        validated.contextKey,
      )
    } else if (user) {
      newConversation = await conversationService.resetConversation(user.id, validated.contextKey)
    } else {
      return Response.json(
        { error: 'User or guest session required', isGuestMode: false },
        { status: 401 },
      )
    }

    reqLogger.info(
      {
        userId: user?.id,
        guestSessionId: guestSession?.id,
        contextKey: validated.contextKey,
        newConversationId: newConversation.id,
      },
      'Chat reset successful',
    )

    const headers: HeadersInit = {}
    if (guestCookieHeader) {
      headers['Set-Cookie'] = guestCookieHeader
    }
    return Response.json(
      {
        success: true,
        conversationId: newConversation.id,
        contextKey: validated.contextKey,
        isGuestMode,
      },
      { headers },
    )
  } catch (error) {
    reqLogger.error({ err: error }, 'Reset chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
