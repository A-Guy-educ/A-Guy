/**
 * POST /api/agent/message/persist
 * Persist an assistant message directly to a conversation (no AI call).
 * Used for CMS-authored help content (hints, solutions) that should survive page refresh.
 */
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { getGuestSessionByToken, getGuestSessionCookie } from '@/server/services/guest-session'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z.string().min(1),
  content: z.string().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  try {
    const body = await request.json()
    const validated = requestSchema.parse(body)

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Support both authenticated users and guest sessions
    let guestSessionId: string | null = null
    if (!user) {
      const guestToken = getGuestSessionCookie(request.headers)
      if (guestToken) {
        const guestSession = await getGuestSessionByToken(guestToken)
        if (guestSession) {
          guestSessionId = guestSession.id
        }
      }
    }

    if (!user && !guestSessionId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const ownerId = user?.id ?? guestSessionId!

    // Find active conversation for this context
    const whereClause: Where = guestSessionId
      ? {
          and: [
            { guestSession: { equals: guestSessionId } },
            { contextKey: { equals: validated.contextKey } },
            { archivedAt: { exists: false } },
          ],
        }
      : {
          and: [
            { user: { equals: ownerId } },
            { contextKey: { equals: validated.contextKey } },
            { archivedAt: { exists: false } },
          ],
        }

    const result = await payload.find({
      collection: 'conversations',
      where: whereClause,
      limit: 1,
      sort: '-lastMessageAt',
      user: guestSessionId ? undefined : (user ?? undefined),
      overrideAccess: !!guestSessionId,
    })

    if (result.docs.length === 0) {
      reqLogger.warn(
        { ownerId, contextKey: validated.contextKey },
        'No conversation found for message persist',
      )
      return NextResponse.json({ error: 'No active conversation found' }, { status: 404 })
    }

    const conversation = result.docs[0]
    const existingMessages = conversation.messages ?? []

    const assistantMessage = {
      role: 'assistant' as const,
      content: validated.content,
      timestamp: new Date().toISOString(),
      hidden: false,
    }

    await payload.update({
      collection: 'conversations',
      id: conversation.id,
      data: {
        messages: [...existingMessages, assistantMessage],
        lastMessageAt: new Date().toISOString(),
      },
      user: user ?? undefined,
      overrideAccess: !!guestSessionId,
    })

    reqLogger.info(
      { conversationId: conversation.id, contextKey: validated.contextKey },
      'Assistant message persisted',
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    reqLogger.error({ err: error, requestId }, 'Message persist endpoint error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
