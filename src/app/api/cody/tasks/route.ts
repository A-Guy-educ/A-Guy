/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern tasks-api
 * @ai-summary API route to fetch and create tasks (GitHub issues)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { fetchIssues, fetchWorkflowRuns, fetchOpenPRs, fetchDeploymentPreviews, findBranchByIssueNumber, getStatusFromBranch, findStatusOnBranch, createIssue, updateIssue, uploadIssueAttachment } from '@/ui/cody/github-client'
import type { CodyTask, ColumnId, GitHubIssue, GitHubPR, WorkflowRun } from '@/ui/cody/types'

// Map GitHub issue state to column using agent labels, workflow runs, and PR status
// Priority: agent:* labels (set by Cody pipeline) > active workflow runs > gate labels > completed runs > PR status > other labels
function getColumnForIssue(
  issue: GitHubIssue,
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,
): ColumnId {
  const labelNames = issue.labels.map(l => l.name.toLowerCase())
  
  // 1. Cody lifecycle labels (highest priority — set by the pipeline state machine)
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building')) return 'building'
  if (labelNames.includes('cody:failed')) return 'failed'
  // cody:done = pipeline finished, PR created → task goes to review (not done)
  // Task is only truly "done" when the PR is merged and the issue is closed
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) return 'review'
  
  // 2. Active workflow run takes priority over gate labels
  // This ensures the dashboard shows "Building" even if risk-gated/hard-stop labels
  // are still present (they are removed mid-run after approval)
  if (workflowRun?.status === 'in_progress') return 'building'
  
  // 3. Explicit state labels (only checked when no active workflow run)
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'
  
  // 3b. Pipeline gate labels (set by pipeline when hitting gates)
  // These are now checked AFTER active workflow runs to prevent stale gate labels
  // from hiding active pipeline progress
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'

  // 4. Workflow run completed status
  if (workflowRun?.status === 'completed') {
    // Also handle timed_out and cancelled as failures
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }
  
  // 5. Associated PR (always fetched via bulk)
  if (associatedPR && !associatedPR.merged_at) return 'review'
  
  // 6. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'
  
  // 7. Default to open
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
    const runsByTitle = new Map<string, typeof workflowRuns[number]>()
    for (const run of workflowRuns) {
      const title = run.display_title || ''
      // Keep only the most recent run per title (runs are sorted by date desc)
      if (title && !runsByTitle.has(title)) {
        runsByTitle.set(title, run)
      }
    }

    // Build PR lookup: match by title or by issue number in branch name
    const prsByIssueTitle = new Map<string, typeof openPRs[number]>()
    const prsByIssueNumber = new Map<number, typeof openPRs[number]>()
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
    const prShas = openPRs.map(pr => pr.head.sha)
    const previewUrls = await fetchDeploymentPreviews(prShas)
    // Build SHA -> preview URL lookup keyed by PR number for easy access
    const previewByPrNumber = new Map<number, string>()
    for (const pr of openPRs) {
      const url = previewUrls.get(pr.head.sha)
      if (url) {
        previewByPrNumber.set(pr.number, url)
      } else {
        // Fallback: generate Vercel preview URL from PR number
        previewByPrNumber.set(pr.number, `https://a-m0beir6hv-aguy.vercel.app/`)
      }
    }

    // Parse issues into tasks with additional metadata
    const tasks: CodyTask[] = await Promise.all(
      issues.map(async (issue) => {
        // Extract task ID from title (e.g., "[HIGH-507]" or "[260224-auto-38]")
        const taskIdMatch = issue.title.match(/\[[^\]]+\]/)
        const taskId = taskIdMatch ? taskIdMatch[0].replace(/[\[\]]/g, '') : ''
        
        // Match workflow run by issue title (most reliable) or taskId
        const workflowRun = runsByTitle.get(issue.title) ?? 
          workflowRuns.find(run => taskId && (
            run.html_url.includes(taskId) || 
            run.display_title?.includes(taskId)
          ))

        // Match PR from pre-fetched bulk data (cheap, no extra API calls)
        const pr = prsByIssueTitle.get(issue.title) ??
          prsByIssueNumber.get(issue.number) ??
          null

        // Fetch pipeline status for tasks with active workflows or pipeline labels.
        // Only attempts branch discovery for tasks likely to have pipeline data
        // (has an active workflow run or cody:building/cody:planning labels).
        let pipelineStatus = undefined
        const labelNames = issue.labels.map(l => l.name.toLowerCase())
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

        const column = getColumnForIssue(issue, workflowRun ?? undefined, pr ?? null)

        // Derive gate type from labels (set by pipeline)
        const gateType = labelNames.includes('hard-stop') 
          ? 'hard-stop' 
          : labelNames.includes('risk-gated')
            ? 'risk-gated'
            : undefined

        return {
          id: taskId ? `${taskId}-${issue.number}` : issue.number.toString(),
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          labels: issue.labels.map(l => l.name),
          column,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          pipeline: pipelineStatus,
          workflowRun: workflowRun ? {
            id: workflowRun.id,
            status: workflowRun.status,
            conclusion: workflowRun.conclusion,
            created_at: workflowRun.created_at,
            updated_at: workflowRun.updated_at,
            html_url: workflowRun.html_url,
          } : undefined,
          associatedPR: pr ? {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            head: pr.head,
            merged_at: pr.merged_at,
            html_url: pr.html_url,
          } : null,
          assignees: issue.assignees,
          isCodyAssigned: issue.isCodyAssigned,
          previewUrl: pr ? previewByPrNumber.get(pr.number) : undefined,
          // Substatus from labels and workflow run data
          isTimeout: workflowRun?.conclusion === 'timed_out',
          gateType,
        }
      })
    )

    // Filter by board if needed
    let filteredTasks = tasks
    if (board !== 'all') {
      if (board.startsWith('label:')) {
        const label = board.replace('label:', '')
        filteredTasks = tasks.filter(t => t.labels.includes(label))
      } else if (board.startsWith('milestone:')) {
        // Would need to filter by milestone - for now just return all
        filteredTasks = tasks
      }
    }

    return NextResponse.json({ tasks: filteredTasks })
  } catch (error: any) {
    console.error('[Cody] Error fetching tasks:', error)

    // Check for rate limiting (403 from GitHub)
    const isRateLimited = error?.status === 403 || 
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
        { status: 429 }
      )
    }

    // Check for missing token
    if (error?.message?.includes('GITHUB_TOKEN not configured')) {
      return NextResponse.json(
        {
          error: 'no_token',
          message: 'GITHUB_TOKEN is not configured',
        },
        { status: 401 }
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
    const { title, body: issueBody, mode, labels, assignees, attachments, actorLogin } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Generate task ID prefix only for pipeline modes (not for bug reports)
    // Bug reports should keep their original title format
    const isBugReport = mode === 'bug'
    const datePrefix = new Date().toISOString().slice(2, 8).replace('-', '')
    const taskIdPrefix = !isBugReport && mode ? `[${datePrefix}-auto-XX] ` : ''
    const fullTitle = title.startsWith('[') ? title : `${taskIdPrefix}${title}`

    // Create the issue in GitHub
    const actorNote = actorLogin ? `\n\n---\n_Created by @${actorLogin} via Cody dashboard_` : ''
    const issue = await createIssue({
      title: fullTitle,
      body: (issueBody || '') + actorNote,
      labels: labels || [],
      assignees: assignees || [],
    })

    console.log('[Cody] Created issue:', issue.number, issue.title)

    // Fix the title: replace auto-XX with the real issue number
    if (!isBugReport && mode && fullTitle.includes('auto-XX')) {
      const correctedTitle = fullTitle.replace('auto-XX', `auto-${issue.number}`)
      await updateIssue(issue.number, { title: correctedTitle })
      console.log('[Cody] Fixed issue title:', issue.number, correctedTitle)
      // Update the issue object with the corrected title for the response
      issue.title = correctedTitle
    }

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
    return NextResponse.json({ error: 'Failed to create task', details: error.message }, { status: 500 })
  }
}
