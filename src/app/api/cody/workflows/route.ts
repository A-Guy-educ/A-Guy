/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern workflows-api
 * @ai-summary API route to fetch workflow runs
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/cody/auth'
import { fetchWorkflowRuns } from '@/lib/cody/github-client'

export async function GET(req: NextRequest) {
  // Check auth
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as 'queued' | 'in_progress' | 'completed' | null

    const runs = await fetchWorkflowRuns({
      status: status || undefined,
      perPage: 20,
    })

    return NextResponse.json({ runs })
  } catch (error: any) {
    console.error('[Cody] Error fetching workflows:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
