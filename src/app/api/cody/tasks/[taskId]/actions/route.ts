/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-actions-api
 * @ai-summary API route for task actions (approve, reject, rerun, abort)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/cody/auth'
import {
  postComment,
  triggerWorkflow,
  cancelWorkflowRun,
  fetchWorkflowRuns,
} from '@/lib/cody/github-client'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'rerun', 'abort']),
  feedback: z.string().optional(),
  fromStage: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  // Check auth
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { taskId } = await params
    const body = await req.json()
    const { action, feedback, fromStage } = actionSchema.parse(body)

    // Get issue number from taskId
    const issueNumber = parseInt(taskId.replace('issue-', ''), 10)
    if (isNaN(issueNumber)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    switch (action) {
      case 'approve': {
        await postComment(issueNumber, '/cody approve')
        return NextResponse.json({ success: true, message: 'Gate approved' })
      }

      case 'reject': {
        await postComment(issueNumber, '/cody reject')
        return NextResponse.json({ success: true, message: 'Gate rejected' })
      }

      case 'rerun': {
        await triggerWorkflow({
          taskId,
          mode: 'rerun',
          fromStage,
          feedback,
        })
        return NextResponse.json({ success: true, message: 'Workflow triggered' })
      }

      case 'abort': {
        const runs = await fetchWorkflowRuns({ perPage: 10 })
        const run = runs.find((r) => r.html_url.includes(taskId))
        if (run) {
          await cancelWorkflowRun(run.id)
          return NextResponse.json({ success: true, message: 'Workflow cancelled' })
        }
        return NextResponse.json({ error: 'No running workflow found' }, { status: 404 })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[Cody] Error processing action:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
