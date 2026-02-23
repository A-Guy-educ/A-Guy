/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern collaborators-api
 * @ai-summary API route to fetch repository collaborators for assignee picker
 */
import { NextRequest, NextResponse } from 'next/server'

import { fetchCollaborators } from '@/ui/cody/github-client'

export async function GET(_req: NextRequest) {
  // Skip auth check for now - open access for testing
  try {
    const collaborators = await fetchCollaborators()
    return NextResponse.json({ collaborators })
  } catch (error) {
    console.error('[Cody] Error fetching collaborators:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch collaborators', details: message },
      { status: 500 },
    )
  }
}
