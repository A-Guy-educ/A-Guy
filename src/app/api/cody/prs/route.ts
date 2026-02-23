/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern prs-api
 * @ai-summary API route to fetch PRs
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/ui/cody/auth'
import { findAssociatedPR } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  // Check auth
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    const pr = await findAssociatedPR(taskId)

    return NextResponse.json({ pr })
  } catch (error: any) {
    console.error('[Cody] Error fetching PR:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
