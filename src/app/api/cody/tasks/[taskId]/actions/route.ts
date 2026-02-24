/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-actions-api
 * @ai-summary API route for task actions (approve, reject, rerun, abort, execute)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  postComment,
  triggerWorkflow,
  cancelWorkflowRun,
  fetchWorkflowRuns,
  updateIssue,
  addAssignees,
  removeAssignees,
  addLabels,
  removeLabel,
} from '@/ui/cody/github-client'

const actionSchema = z.object({
  action: z.enum([
    'approve',
    'reject',
    'rerun',
    'execute',
    'abort',
    'close',
    'reopen',
    'add-label',
    'remove-label',
    'assign',
    'unassign',
    'comment',
  ]),
  feedback: z.string().optional(),
  fromStage: z.string().optional(),
  mode: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  label: z.string().optional(),
  comment: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  // Skip auth check for now - open access for testing

  try {
    const { taskId } = await params
    const body = await req.json()
    const { action, feedback, fromStage, mode: _mode } = actionSchema.parse(body)

    // Get issue number from taskId
    const issueNumber = parseInt(taskId.replace('issue-', ''), 10)
    if (isNaN(issueNumber)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const { assignees, label, comment } = actionSchema.parse(body)

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

      case 'execute': {
        // Post /cody command to assign issue to Cody
        await postComment(issueNumber, '/cody')
        return NextResponse.json({ success: true, message: 'Cody execution triggered' })
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

      case 'close': {
        await updateIssue(issueNumber, { state: 'closed' })
        return NextResponse.json({ success: true, message: 'Issue closed' })
      }

      case 'reopen': {
        await updateIssue(issueNumber, { state: 'open' })
        return NextResponse.json({ success: true, message: 'Issue reopened' })
      }

      case 'add-label': {
        if (!label) {
          return NextResponse.json({ error: 'Label is required' }, { status: 400 })
        }
        await addLabels(issueNumber, [label])
        return NextResponse.json({ success: true, message: `Label "${label}" added` })
      }

      case 'remove-label': {
        if (!label) {
          return NextResponse.json({ error: 'Label is required' }, { status: 400 })
        }
        await removeLabel(issueNumber, label)
        return NextResponse.json({ success: true, message: `Label "${label}" removed` })
      }

      case 'assign': {
        if (!assignees || assignees.length === 0) {
          return NextResponse.json({ error: 'Assignees are required' }, { status: 400 })
        }
        await addAssignees(issueNumber, assignees)
        return NextResponse.json({ success: true, message: `Assigned to ${assignees.join(', ')}` })
      }

      case 'unassign': {
        if (!assignees || assignees.length === 0) {
          return NextResponse.json({ error: 'Assignees are required' }, { status: 400 })
        }
        await removeAssignees(issueNumber, assignees)
        return NextResponse.json({ success: true, message: `Unassigned ${assignees.join(', ')}` })
      }

      case 'comment': {
        if (!comment) {
          return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
        }
        await postComment(issueNumber, comment)
        return NextResponse.json({ success: true, message: 'Comment posted' })
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
