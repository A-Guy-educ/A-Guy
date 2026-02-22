/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-detail-api
 * @ai-summary API route to fetch detailed task info
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/cody/auth'
import {
  fetchIssues,
  fetchComments,
  findTaskBranch,
  getStatusFromBranch,
  findAssociatedPR,
  fetchWorkflowRuns,
} from '@/lib/cody/github-client'
import { parseAllComments } from '@/lib/cody/task-parser'
import { buildCodyTask } from '@/lib/cody/board-mapper'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  // Check auth
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { taskId } = await params

    // Find issue by task ID in comments
    const issues = await fetchIssues({ state: 'all', perPage: 100 })

    // Find the issue that has this task ID in comments
    for (const issue of issues) {
      const comments = await fetchComments(issue.number)
      const parsed = parseAllComments(comments)
      const taskMarker = parsed.find((c) => c.type === 'task-marker')

      if (taskMarker?.taskId === taskId) {
        // Get workflow runs
        const runs = await fetchWorkflowRuns({ perPage: 50 })
        const workflowRun = runs.find((r) => r.html_url.includes(taskId))

        // Get pipeline status
        const branch = await findTaskBranch(taskId)
        let pipeline = null
        if (branch) {
          pipeline = await getStatusFromBranch(taskId, branch)
        }

        // Get associated PR
        const associatedPR = await findAssociatedPR(taskId)

        // Build task
        const task = buildCodyTask({
          issue,
          comments: parsed,
          workflowRun,
          associatedPR,
        })

        if (pipeline) {
          task.pipeline = pipeline
        }

        return NextResponse.json({ task })
      }
    }

    // Try to find by issue number if taskId is numeric
    const issueNumber = parseInt(taskId.replace('issue-', ''), 10)
    if (!isNaN(issueNumber)) {
      const issue = issues.find((i) => i.number === issueNumber)
      if (issue) {
        const comments = await fetchComments(issue.number)
        const parsed = parseAllComments(comments)
        const runs = await fetchWorkflowRuns({ perPage: 50 })
        const workflowRun = runs.find((r) => r.html_url.includes(issueNumber.toString()))
        const associatedPR = await findAssociatedPR(taskId)

        const task = buildCodyTask({
          issue,
          comments: parsed,
          workflowRun,
          associatedPR,
        })

        return NextResponse.json({ task })
      }
    }

    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch (error: any) {
    console.error('[Cody] Error fetching task detail:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
