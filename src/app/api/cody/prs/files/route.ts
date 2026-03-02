/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pr-files-api
 * @ai-summary API route to fetch file changes for a PR
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/ui/cody/auth'
import { fetchPRFileChanges } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const prNumber = searchParams.get('prNumber')

    if (!prNumber) {
      return NextResponse.json({ error: 'prNumber required' }, { status: 400 })
    }

    const files = await fetchPRFileChanges(parseInt(prNumber, 10))

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('[Cody] Error fetching PR files:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
