/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern task-detail-api
 * @ai-summary API route to fetch detailed task info
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireCodyAuth } from '@/ui/cody/auth'

import {
  fetchIssue,
  fetchIssues,
  fetchComments,
  findTaskBranch,
  getStatusFromBranch,
  findAssociatedPRByIssueNumber,
  fetchWorkflowRuns,
} from '@/ui/cody/github-client'
import { parseAllComments } from '@/ui/cody/task-parser'
import type {
  CodyTask,
  GitHubIssue,
  GitHubPR,
  ParsedComment,
  WorkflowRun,
  ColumnId,
} from '@/ui/cody/types'

/**
 * Derive column from issue state + parsed comments + workflow run + PR.
 * Inlined from the deleted board-mapper.ts.
 */
function deriveColumn(
  issue: GitHubIssue,
  comments: ParsedComment[],
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,
): ColumnId {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const taskMarker = sorted.find((c) => c.type === 'task-marker')
  const failure = [...sorted]
    .reverse()
    .find((c) => c.type === 'failure' || c.type === 'cody-failed')
  const gate = [...sorted].reverse().find((c) => c.type === 'gate-request')
  const gateApproval = [...sorted].reverse().find((c) => c.type === 'gate-approval')
  const retries = sorted.filter((c) => c.type === 'supervisor-retry')
  const exhausted = [...sorted].reverse().find((c) => c.type === 'supervisor-exhausted')

  if (failure && exhausted) return 'failed'
  if (gate && (!gateApproval || gate.createdAt > gateApproval.createdAt)) return 'gate-waiting'
  if (retries.length > 0 && !exhausted && failure) return 'retrying'
  if (taskMarker && workflowRun?.status === 'in_progress') return 'building'
  if (associatedPR && !associatedPR.merged_at) return 'review'
  if (taskMarker) return 'building'
  return 'open'
}

function buildCodyTask(options: {
  issue: GitHubIssue
  comments: ParsedComment[]
  workflowRun?: WorkflowRun
  associatedPR?: GitHubPR | null
}): CodyTask {
  const { issue, comments, workflowRun, associatedPR } = options
  const taskMarker = comments.find((c) => c.type === 'task-marker')
  const taskId = taskMarker?.taskId || `issue-${issue.number}`
  const column = deriveColumn(issue, comments, workflowRun, associatedPR)

  // Derive substatus fields from parsed comments
  // Gate type and stage from gate-request comments
  const lastGateRequest = [...comments].reverse().find((c) => c.type === 'gate-request')
  const lastGateApproval = [...comments].reverse().find((c) => c.type === 'gate-approval')
  let gateType: 'hard-stop' | 'risk-gated' | undefined
  let gateStage: string | undefined

  if (
    lastGateRequest &&
    (!lastGateApproval || lastGateRequest.createdAt > lastGateApproval.createdAt)
  ) {
    // Determine gate type from comment body: 🚫 Hard Stop vs 🚦 Risk Gate
    gateType = lastGateRequest.body.includes('🚫 Hard Stop') ? 'hard-stop' : 'risk-gated'
    // Extract gate stage from body (e.g., "paused at architect gate")
    const stageMatch = lastGateRequest.body.match(/at (\w+) gate/)
    gateStage = stageMatch?.[1]
  }

  // Check for other comment-based substates
  const hasClarifyStop = comments.some((c) => c.type === 'clarify-stop')
  const hasExhausted = comments.some((c) => c.type === 'supervisor-exhausted')
  const hasSupervisorError = comments.some((c) => c.type === 'supervisor-error')
  const hasTimeout = comments.some((c) => c.type === 'timeout')

  // Also check workflow run for timeout (GitHub Actions conclusion)
  const isTimeoutFromWorkflow = workflowRun?.conclusion === 'timed_out'

  return {
    id: taskId,
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body || '',
    state: issue.state,
    labels: issue.labels.map((l) => l.name),
    column,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    workflowRun,
    associatedPR,
    // Substatus fields
    gateType,
    gateStage,
    clarifyWaiting: hasClarifyStop && column !== 'done',
    isTimeout: hasTimeout || isTimeoutFromWorkflow,
    isExhausted: hasExhausted,
    isSupervisorError: hasSupervisorError,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const authResult = await requireCodyAuth(req)
  if (authResult instanceof NextResponse) return authResult

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
          findAssociatedPRByIssueNumber(issueNumberFromUrl),
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
          comments: comments.map((c) => ({
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
        const associatedPR = await findAssociatedPRByIssueNumber(issue.number)

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
          comments: comments.map((c) => ({
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
