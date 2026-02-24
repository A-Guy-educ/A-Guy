/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pipeline-api
 * @ai-summary API route to fetch pipeline status for a task
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/ui/cody/auth'
import {
  findTaskBranch,
  getStatusFromBranch,
  getStatusFromArtifact,
  fetchWorkflowRuns,
} from '@/ui/cody/github-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  // Check auth
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { taskId } = await params

    // Try branch status first (for running tasks)
    const branch = await findTaskBranch(taskId)
    if (branch) {
      const status = await getStatusFromBranch(taskId, branch)
      if (status) {
        return NextResponse.json({
          status,
          source: 'branch',
        })
      }
    }

    // Try artifact status (for completed tasks)
    const workflowRuns = await fetchWorkflowRuns({ perPage: 10 })
    const run = workflowRuns.find((r) => r.html_url.includes(taskId))

    if (run) {
      const status = await getStatusFromArtifact(taskId, run.id.toString())
      if (status) {
        return NextResponse.json({
          status,
          source: 'artifact',
        })
      }
    }

    // No status found
    return NextResponse.json({
      status: null,
      source: null,
    })
  } catch (error: any) {
    console.error('[Cody] Error fetching pipeline:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
