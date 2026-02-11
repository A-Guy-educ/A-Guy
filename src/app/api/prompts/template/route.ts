import '@/infra/config/server-init'

import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ success: false, error: 'Missing key parameter' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const result = await payload.find({
      collection: 'prompts',
      where: {
        and: [{ key: { equals: key } }, { status: { equals: 'published' } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return NextResponse.json({ success: false })
    }

    return NextResponse.json({ success: true, template: result.docs[0].template })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
