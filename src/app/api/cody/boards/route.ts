/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern boards-api
 * @ai-summary API route to fetch boards (labels + milestones)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/cody/auth'
import { fetchLabels, fetchMilestones } from '@/lib/cody/github-client'
import type { Board } from '@/lib/cody/types'

export async function GET(req: NextRequest) {
  // Check auth
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    // Fetch labels and milestones in parallel
    const [labels, milestones] = await Promise.all([fetchLabels(), fetchMilestones()])

    // Build board list
    const boards: Board[] = [
      { id: 'all', name: 'All', type: 'all' },
      ...labels.map((label) => ({
        id: `label:${label.name}`,
        name: label.name,
        type: 'label' as const,
      })),
      ...milestones.map((milestone) => ({
        id: `milestone:${milestone.number}`,
        name: milestone.title,
        type: 'milestone' as const,
      })),
    ]

    return NextResponse.json({ boards })
  } catch (error: any) {
    console.error('[Cody] Error fetching boards:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
