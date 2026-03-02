/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pr-ci-status
 * @ai-summary Fetch CI status and mergeability for a PR
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/ui/cody/auth'
import { fetchPRCIStatus } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const prNumber = searchParams.get('prNumber')

    if (!prNumber) {
      return NextResponse.json({ error: 'prNumber required' }, { status: 400 })
    }

    const status = await fetchPRCIStatus(Number(prNumber))

    return NextResponse.json(status)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cody] Error fetching PR CI status:', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
