/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-actions-api
 * @ai-summary API route for task actions (approve, reject, rerun, abort, execute)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCodyAuth } from '@/ui/cody/auth'

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
  closePR,
  findAssociatedPRByIssueNumber,
  findTaskBranch,
  deleteBranch,
  clearCache,
} from '@/ui/cody/github-client'

const actionSchema = z.object({
  action: z.enum([
    'approve',
    'reject',
    'rerun',
    'execute',
    'abort',
    'close',
    'close-pr',
    'reset',
    'reopen',
    'add-label',
    'remove-label',
    'assign',
    'unassign',
    'comment',
    'fix',
  ]),
  feedback: z.string().optional(),
  fromStage: z.string().optional(),
  mode: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  label: z.string().optional(),
  comment: z.string().optional(),
  actorLogin: z.string().optional(),
})

/** Format a string with actor attribution */
function withActor(message: string, actor?: string): string {
  return actor ? `${message} _(by @${actor})_` : message
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const authResult = await requireCodyAuth(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const { taskId } = await params
    const body = await req.json()
    const { action, feedback, fromStage, mode: _mode, actorLogin } = actionSchema.parse(body)

    // Get issue number from taskId
    const issueNumber = parseInt(taskId.replace('issue-', ''), 10)
    if (isNaN(issueNumber)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const { assignees, label, comment } = actionSchema.parse(body)
    const actor = actorLogin || undefined

    switch (action) {
      case 'approve': {
        await postComment(issueNumber, withActor('/cody approve', actor))
        return NextResponse.json({ success: true, message: 'Gate approved' })
      }

      case 'reject': {
        await postComment(issueNumber, withActor('/cody reject', actor))
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
        await postComment(issueNumber, withActor('/cody', actor))
        return NextResponse.json({ success: true, message: 'Cody execution triggered' })
      }

      case 'abort': {
        // Try to find and cancel in-progress workflow runs for this task
        const runs = await fetchWorkflowRuns({ perPage: 30 })
        const run = runs.find(
          (r) =>
            r.status === 'in_progress' &&
            (r.display_title?.includes(taskId) ||
              r.html_url.includes(taskId) ||
              r.html_url.includes(issueNumber.toString())),
        )

        // Post comment regardless of whether we found a running workflow
        // This ensures the issue is marked as stopped even if workflow already finished
        await postComment(
          issueNumber,
          withActor('## 🛑 Operation stopped - Run aborted by user.', actor),
        )

        if (run) {
          await cancelWorkflowRun(run.id)
          return NextResponse.json({ success: true, message: 'Workflow cancelled' })
        }
        // Return success anyway - the comment was posted
        return NextResponse.json({
          success: true,
          message: 'Marked as stopped (no running workflow)',
        })
      }

      case 'close': {
        // Close PR if exists
        const pr = await findAssociatedPRByIssueNumber(issueNumber)
        if (pr) {
          await closePR(pr.number)
        }

        // Delete branch if exists
        const branchName = await findTaskBranch(taskId)
        if (
          branchName &&
          branchName !== 'dev' &&
          branchName !== 'main' &&
          branchName !== 'master'
        ) {
          await deleteBranch(branchName)
        }

        // Finally close the issue
        await updateIssue(issueNumber, { state: 'closed' })
        if (actor) await postComment(issueNumber, `🔒 Issue closed _(by @${actor})_`)

        // Clear server-side cache so the next poll reflects the closed state immediately
        clearCache()

        return NextResponse.json({
          success: true,
          message: 'Issue closed (PR closed, branch deleted)',
        })
      }

      case 'close-pr': {
        // Find the associated PR for this task
        const pr = await findAssociatedPRByIssueNumber(issueNumber)
        if (!pr) {
          return NextResponse.json({ error: 'No associated PR found' }, { status: 404 })
        }
        await closePR(pr.number)
        clearCache()
        return NextResponse.json({ success: true, message: `PR #${pr.number} closed` })
      }

      case 'reset': {
        // Full reset: delete branch, close PR, remove agent labels, re-trigger pipeline
        const branchName = await findTaskBranch(taskId)

        // Close PR if exists
        const pr = await findAssociatedPRByIssueNumber(issueNumber)
        if (pr) {
          await closePR(pr.number)
        }

        // Delete branch if exists
        if (
          branchName &&
          branchName !== 'dev' &&
          branchName !== 'main' &&
          branchName !== 'master'
        ) {
          await deleteBranch(branchName)
        }

        // Remove lifecycle labels
        const labelsToRemove = [
          'cody:done',
          'cody:failed',
          'cody:building',
          'cody:planning',
          'cody:review',
          'hard-stop',
          'risk-gated',
        ]
        for (const lbl of labelsToRemove) {
          try {
            await removeLabel(issueNumber, lbl)
          } catch {
            // Ignore if label doesn't exist
          }
        }

        // Re-trigger pipeline
        await postComment(issueNumber, withActor('🔄 Task reset and re-triggered', actor))
        await postComment(issueNumber, '/cody')

        clearCache()

        return NextResponse.json({
          success: true,
          message: `Task reset: branch deleted, PR closed, labels removed, pipeline triggered`,
        })
      }

      case 'reopen': {
        await updateIssue(issueNumber, { state: 'open' })
        if (actor) await postComment(issueNumber, `🔓 Issue reopened _(by @${actor})_`)
        clearCache()
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
        clearCache()
        return NextResponse.json({ success: true, message: `Assigned to ${assignees.join(', ')}` })
      }

      case 'unassign': {
        if (!assignees || assignees.length === 0) {
          return NextResponse.json({ error: 'Assignees are required' }, { status: 400 })
        }
        await removeAssignees(issueNumber, assignees)
        clearCache()
        return NextResponse.json({ success: true, message: `Unassigned ${assignees.join(', ')}` })
      }

      case 'comment': {
        if (!comment) {
          return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
        }
        await postComment(issueNumber, comment)
        return NextResponse.json({ success: true, message: 'Comment posted' })
      }

      case 'fix': {
        if (!comment) {
          return NextResponse.json({ error: 'Fix description is required' }, { status: 400 })
        }
        const associatedPR = await findAssociatedPRByIssueNumber(issueNumber)
        if (!associatedPR) {
          return NextResponse.json({ error: 'No associated PR found' }, { status: 404 })
        }
        const fixBody = withActor(
          `@cody fix

${comment}`,
          actor,
        )
        await postComment(associatedPR.number, fixBody)
        clearCache()
        return NextResponse.json({ success: true, message: 'Fix requested on PR' })
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
