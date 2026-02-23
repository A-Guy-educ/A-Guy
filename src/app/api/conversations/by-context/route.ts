import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { logger } from '@/infra/utils/logger/logger'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const contextKey = searchParams.get('contextKey')
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 100)

    if (!contextKey) {
      return NextResponse.json({ error: 'contextKey is required' }, { status: 400 })
    }

    const result = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { user: { equals: user.id } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      sort: '-lastMessageAt',
      limit,
      pagination: false,
      depth: 0,
    })

    const conversations = result.docs.map((doc) => {
      // title field was added after types were generated — access via unknown cast
      const docTitle = (doc as unknown as { title?: string }).title
      return {
        id: doc.id,
        title: docTitle ?? getPreviewTitle(doc.messages ?? undefined),
        lastMessageAt: doc.lastMessageAt,
        messageCount: doc.messages?.filter((m) => !m.hidden).length ?? 0,
      }
    })

    return NextResponse.json({ conversations, total: result.totalDocs })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch conversations by context')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await payload.update({
      collection: 'conversations',
      id,
      data: { archivedAt: new Date().toISOString() } as Record<string, unknown>,
      overrideAccess: true,
      context: { allowArchive: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete conversation')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getPreviewTitle(
  messages?: Array<{ role: string; content: string; hidden?: boolean | null }>,
) {
  const firstUserMsg = messages?.find((m) => m.role === 'user' && !m.hidden)
  if (!firstUserMsg) return ''
  return firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
}
