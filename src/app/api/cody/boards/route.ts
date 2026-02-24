/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern boards-api
 * @ai-summary API route to fetch boards (labels + milestones)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { fetchLabels, fetchMilestones } from '@/ui/cody/github-client'
import type { Board } from '@/ui/cody/types'

export async function GET(_req: NextRequest) {
  // Skip auth check for now - open access for testing
  // Auth can be added later

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

    // ALWAYS return mock data on error so the dashboard continues to work locally
    return NextResponse.json({
      boards: [
        { id: 'all', name: 'All', type: 'all' },
        { id: 'label:frontend', name: 'frontend', type: 'label' },
        { id: 'label:backend', name: 'backend', type: 'label' },
        { id: 'label:bug', name: 'bug', type: 'label' },
        { id: 'label:feature', name: 'feature', type: 'label' },
      ],
    })
  }
}
