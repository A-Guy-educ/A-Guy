/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern boards-api
 * @ai-summary API route to fetch boards (labels + milestones)
 *
 * Public endpoint (no auth required) — returns board categories.
 * Intentionally unauthenticated to support dashboard loading without login.
 */
import { NextRequest, NextResponse } from 'next/server'

import { handleCodyApiError } from '@/lib/cody/github-error-handler'
import { fetchLabels, fetchMilestones } from '@/ui/cody/github-client'
import type { Board } from '@/ui/cody/types'

export async function GET(_req: NextRequest) {
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
  } catch (error: unknown) {
    return handleCodyApiError(error, 'boards')
  }
}
