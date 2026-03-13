/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern tasks-api
 * @ai-summary API route to fetch and create tasks (GitHub issues)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import {
  fetchIssues,
  fetchWorkflowRuns,
  fetchOpenPRs,
  fetchDeploymentPreviews,
  findBranchByIssueNumber,
  getStatusFromBranch,
  findStatusOnBranch,
  createIssue,
  uploadIssueAttachment,
} from '@/ui/cody/github-client'
import type {
  CodyTask,
  ColumnId,
  GitHubIssue,
  GitHubPR,
  WorkflowRun,
  CodyPipelineStatus,
} from '@/ui/cody/types'

/**
 * Derive column from live pipeline status.
 * Pipeline state is more accurate than GitHub labels (no propagation delay).
 * Called first when pipeline data is available; label-based fallback used otherwise.
 */
export function deriveColumnFromPipeline(pipeline: CodyPipelineStatus): ColumnId {
  switch (pipeline.state) {
    case 'running':
      return 'building'
    case 'paused':
      return 'gate-waiting'
    case 'completed':
      return 'review'
    case 'failed':
    case 'timeout':
      return 'failed'
    default:
      return 'building'
  }
}

/**
 * Derive gate type from pipeline controlMode, falling back to label names.
 * Pipeline data is preferred since labels may lag by 10–30 s.
 */
export function deriveGateType(
  pipeline?: CodyPipelineStatus | null,
  labelNames?: string[],
): 'hard-stop' | 'risk-gated' | undefined {
  if (pipeline?.controlMode === 'hard-stop') return 'hard-stop'
  if (pipeline?.controlMode === 'risk-gated') return 'risk-gated'
  if (labelNames?.includes('hard-stop')) return 'hard-stop'
  if (labelNames?.includes('risk-gated')) return 'risk-gated'
  return undefined
}

// Map GitHub issue state to column using agent labels, workflow runs, and PR status.
// Used as fallback when no live pipeline data is available.
// Priority: cody:failed/done > gate labels > cody:planning/building > active runs > completed runs > PR > other labels
function getColumnForIssue(
  issue: GitHubIssue,
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,
): ColumnId {
  const labelNames = issue.labels.map((l) => l.name.toLowerCase())

  // 1. Terminal lifecycle labels (highest priority)
  if (labelNames.includes('cody:failed')) return 'failed'
  // cody:done = pipeline finished, PR created → task goes to review (not done)
  // Task is only truly "done" when the PR is merged and the issue is closed
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) return 'review'

  // 2. Gate labels — pipeline paused waiting for approval.
  // Must be checked BEFORE cody:planning/cody:building and in_progress workflow,
  // because the pipeline keeps running (polling for approval) while gated,
  // and the cody:planning label is never removed when a gate fires.
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'

  // 3. Cody active-work labels (only reached when NOT gated)
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building'))
    return 'building'

  // 4. Active workflow run (only reached when NOT gated and no cody:* label)
  if (workflowRun?.status === 'in_progress') return 'building'

  // 5. Explicit state labels (only checked when no active workflow run)
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'

  // 6. Workflow run completed status
  if (workflowRun?.status === 'completed') {
    // Also handle timed_out and cancelled as failures
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }

  // 7. Associated PR (always fetched via bulk)
  if (associatedPR && !associatedPR.merged_at) return 'review'

  // 8. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

  // 9. Default to open
  return 'open'
}

export async function GET(req: NextRequest) {
  // Skip auth check for now - open access for testing

  const { searchParams } = new URL(req.url)
  const board = searchParams.get('board') || 'all'
  const since = searchParams.get('since') || undefined // ISO date string, e.g., "2026-02-01"
  // includeDetails param is no longer needed — pipeline data is auto-fetched for active tasks

  // Date filter presets
  let sinceDate: string | undefined = since
  if (!sinceDate && searchParams.get('days')) {
    const days = parseInt(searchParams.get('days')!, 10)
    const date = new Date()
    date.setDate(date.getDate() - days)
    sinceDate = date.toISOString()
  }

  try {
    // Fetch issues, workflow runs, and open PRs in parallel (3 API calls, all cached)
    const [issues, workflowRuns, openPRs] = await Promise.all([
      fetchIssues({
        state: 'open',
        perPage: 100,
        since: sinceDate,
      }),
      fetchWorkflowRuns({ perPage: 30 }),
      fetchOpenPRs(),
    ])

    // Build a map of most recent workflow run per issue title for fast lookup
    const runsByTitle = new Map<string, (typeof workflowRuns)[number]>()
    for (const run of workflowRuns) {
      const title = run.display_title || ''
      // Keep only the most recent run per title (runs are sorted by date desc)
      if (title && !runsByTitle.has(title)) {
        runsByTitle.set(title, run)
      }
    }

    // Build PR lookup: match by title or by issue number in branch name
    const prsByIssueTitle = new Map<string, (typeof openPRs)[number]>()
    const prsByIssueNumber = new Map<number, (typeof openPRs)[number]>()
    for (const pr of openPRs) {
      prsByIssueTitle.set(pr.title, pr)
      // Extract issue number from branch name (e.g., "feat/501-add-loading" -> 501)
      // or from PR title "Closes #501"
      const branchMatch = pr.head.ref.match(/\/(\d{3,})-/)
      if (branchMatch) {
        prsByIssueNumber.set(parseInt(branchMatch[1], 10), pr)
      }
      const closesMatch = pr.title.match(/(?:closes|fixes|resolves)\s+#(\d+)/i)
      if (closesMatch) {
        prsByIssueNumber.set(parseInt(closesMatch[1], 10), pr)
      }
    }

    // Fetch Vercel preview URLs for PRs that have them (1 bulk + N status calls, cached)
    const prShas = openPRs.map((pr) => pr.head.sha)
    const previewUrls = await fetchDeploymentPreviews(prShas)
    // Build SHA -> preview URL lookup keyed by PR number for easy access
    const previewByPrNumber = new Map<number, string>()
    for (const pr of openPRs) {
      const url = previewUrls.get(pr.head.sha)
      if (url) {
        previewByPrNumber.set(pr.number, url)
      }
      // No fallback — showing no preview URL is better than a wrong one.
      // The fetchDeploymentPreviews function now handles SHA-based lookups
      // for older deployments that fall outside the bulk fetch window.
    }

    // Parse issues into tasks with additional metadata
    const tasks: CodyTask[] = await Promise.all(
      issues.map(async (issue) => {
        // Extract task ID from title (e.g., "[HIGH-507]" or "[260224-auto-38]")
        const taskIdMatch = issue.title.match(/\[[^\]]+\]/)
        const taskId = taskIdMatch ? taskIdMatch[0].replace(/[\[\]]/g, '') : ''

        // Match workflow run by issue title (most reliable) or taskId
        const workflowRun =
          runsByTitle.get(issue.title) ??
          workflowRuns.find(
            (run) =>
              taskId && (run.html_url.includes(taskId) || run.display_title?.includes(taskId)),
          )

        // Match PR from pre-fetched bulk data (cheap, no extra API calls)
        const pr = prsByIssueTitle.get(issue.title) ?? prsByIssueNumber.get(issue.number) ?? null

        // Fetch pipeline status for tasks with active workflows or pipeline labels.
        // Only attempts branch discovery for tasks likely to have pipeline data
        // (has an active workflow run or cody:building/cody:planning labels).
        let pipelineStatus = undefined
        const labelNames = issue.labels.map((l) => l.name.toLowerCase())
        // Fetch pipeline for tasks that are actively building, recently failed, or paused at a gate
        const isLikelyActive =
          workflowRun?.status === 'in_progress' ||
          workflowRun?.status === 'queued' ||
          labelNames.includes('cody:building') ||
          labelNames.includes('cody:planning') ||
          labelNames.includes('cody:failed') ||
          labelNames.includes('hard-stop') ||
          labelNames.includes('risk-gated')

        if (isLikelyActive && issue.number) {
          const branch = await findBranchByIssueNumber(issue.number)
          if (branch) {
            // First try with known taskId from title brackets (fast, exact path)
            let status: Awaited<ReturnType<typeof getStatusFromBranch>> = null
            if (taskId) {
              status = await getStatusFromBranch(taskId, branch)
            }
            // Fallback: discover task ID by scanning .tasks/ directory on the branch.
            // Pipeline generates random task IDs (e.g., 260306-auto-330) that don't
            // match the issue number, so we need to discover the actual directory.
            if (!status) {
              status = await findStatusOnBranch(branch)
            }
            if (status) pipelineStatus = status
          }
        }

        // Pipeline state is authoritative when available (no label-propagation delay).
        // Fall back to label/workflow-based derivation when pipeline data is absent.
        const column = pipelineStatus
          ? deriveColumnFromPipeline(pipelineStatus)
          : getColumnForIssue(issue, workflowRun ?? undefined, pr ?? null)

        // Derive gate type: prefer pipeline controlMode, fall back to labels
        const gateType = deriveGateType(pipelineStatus, labelNames)

        return {
          id: taskId ? `${taskId}-${issue.number}` : issue.number.toString(),
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          labels: issue.labels.map((l) => l.name),
          column,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          pipeline: pipelineStatus,
          workflowRun: workflowRun
            ? {
                id: workflowRun.id,
                status: workflowRun.status,
                conclusion: workflowRun.conclusion,
                created_at: workflowRun.created_at,
                updated_at: workflowRun.updated_at,
                html_url: workflowRun.html_url,
              }
            : undefined,
          associatedPR: pr
            ? {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                state: pr.state,
                head: pr.head,
                merged_at: pr.merged_at,
                html_url: pr.html_url,
              }
            : null,
          assignees: issue.assignees,
          isCodyAssigned: issue.isCodyAssigned,
          previewUrl: pr ? previewByPrNumber.get(pr.number) : undefined,
          // Substatus from labels and workflow run data
          isTimeout: workflowRun?.conclusion === 'timed_out',
          gateType,
        }
      }),
    )

    // Filter by board if needed
    let filteredTasks = tasks
    if (board !== 'all') {
      if (board.startsWith('label:')) {
        const label = board.replace('label:', '')
        filteredTasks = tasks.filter((t) => t.labels.includes(label))
      } else if (board.startsWith('milestone:')) {
        // Would need to filter by milestone - for now just return all
        filteredTasks = tasks
      }
    }

    return NextResponse.json({ tasks: filteredTasks })
  } catch (error: any) {
    console.error('[Cody] Error fetching tasks:', error)

    // Check for rate limiting (403 from GitHub)
    const isRateLimited =
      error?.status === 403 ||
      error?.message?.includes('rate limit') ||
      error?.response?.headers?.['x-ratelimit-remaining'] === '0'

    if (isRateLimited) {
      const resetTime = error?.response?.headers?.['x-ratelimit-reset']
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null
      const retryAfter = resetDate
        ? Math.ceil((resetDate.getTime() - Date.now()) / 1000 / 60)
        : null

      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'GitHub API rate limit exceeded',
          retryAfter: retryAfter ? `${retryAfter} minutes` : 'unknown',
          resetTime: resetDate?.toISOString() || null,
        },
        { status: 429 },
      )
    }

    // Check for missing token
    if (error?.message?.includes('GITHUB_TOKEN not configured')) {
      return NextResponse.json(
        {
          error: 'no_token',
          message: 'GITHUB_TOKEN is not configured',
        },
        { status: 401 },
      )
    }

    // Return empty state for other errors instead of mock data
    return NextResponse.json({
      tasks: [],
      error: error?.message || 'Failed to fetch tasks',
    })
  }
}

export async function POST(req: NextRequest) {
  // Skip auth check for now - open access for testing

  try {
    const body = await req.json()
    const { title, body: issueBody, labels, assignees, attachments, actorLogin } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Create the issue in GitHub
    const actorNote = actorLogin ? `\n\n---\n_Created by @${actorLogin} via Cody dashboard_` : ''
    const issue = await createIssue({
      title,
      body: (issueBody || '') + actorNote,
      labels: labels || [],
      assignees: assignees || [],
    })

    console.log('[Cody] Created issue:', issue.number, issue.title)

    // Upload attachments if provided
    const uploadedAttachments = []
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log('[Cody] Uploading', attachments.length, 'attachments...')
      for (const attachment of attachments) {
        try {
          const result = await uploadIssueAttachment(issue.number, {
            name: attachment.name,
            content: attachment.content,
          })
          uploadedAttachments.push(result)
          console.log('[Cody] Uploaded attachment:', result.name, result.attachment_url)
        } catch (attachError: any) {
          console.error('[Cody] Failed to upload attachment:', attachError.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
      },
      attachments: uploadedAttachments,
    })
  } catch (error: any) {
    console.error('[Cody] Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task', details: error.message },
      { status: 500 },
    )
  }
}
