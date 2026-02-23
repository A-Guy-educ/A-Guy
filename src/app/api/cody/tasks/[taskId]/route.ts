/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-detail-api
 * @ai-summary API route to fetch detailed task info
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import {
  fetchIssue,
  fetchIssues,
  fetchComments,
  findTaskBranch,
  getStatusFromBranch,
  findAssociatedPR,
  fetchWorkflowRuns,
} from '@/ui/cody/github-client'
import { parseAllComments } from '@/ui/cody/task-parser'
import { buildCodyTask } from '@/ui/cody/board-mapper'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  // Skip auth for now - open access for testing

  try {
    const { taskId } = await params

    // Try to find by issue number first (optimized path - single API call)
    const issueNumberFromUrl = parseInt(taskId.replace('issue-', ''), 10)
    
    if (!isNaN(issueNumberFromUrl)) {
      // Optimized: directly fetch the single issue by number
      const issue = await fetchIssue(issueNumberFromUrl)
      
      if (issue) {
        // Fetch comments for this single issue
        const comments = await fetchComments(issue.number)
        const parsed = parseAllComments(comments)
        
        // Get workflow runs, branch, and PR in parallel
        const [runs, branch, associatedPR] = await Promise.all([
          fetchWorkflowRuns({ perPage: 50 }),
          findTaskBranch(taskId),
          findAssociatedPR(taskId),
        ])
        
        const workflowRun = runs.find((r) => r.html_url.includes(issueNumberFromUrl.toString()))
        
        let pipeline = null
        if (branch) {
          pipeline = await getStatusFromBranch(taskId, branch)
        }

        const task = buildCodyTask({
          issue,
          comments: parsed,
          workflowRun,
          associatedPR,
        })

        if (pipeline) {
          task.pipeline = pipeline
        }

        return NextResponse.json({ 
          task,
          assignees: issue.assignees,
          comments: comments.map(c => ({
            id: c.id,
            body: c.body,
            created_at: c.created_at,
            user: c.user,
          })),
        })
      }
      
      // Issue not found
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Fallback: Search through all issues if taskId is not numeric (e.g., task ID like "260221-feature")
    // This is less efficient but handles task ID lookups
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

        // Return task with assignees and raw comments for the detail panel
        return NextResponse.json({ 
          task,
          assignees: issue.assignees,
          comments: comments.map(c => ({
            id: c.id,
            body: c.body,
            created_at: c.created_at,
            user: c.user,
          })),
        })
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
