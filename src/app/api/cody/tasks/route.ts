/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern tasks-api
 * @ai-summary API route to fetch and create tasks (GitHub issues)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { fetchIssues, fetchWorkflowRuns, findAssociatedPR, findTaskBranch, getStatusFromBranch, createIssue } from '@/ui/cody/github-client'
import type { CodyTask, ColumnId } from '@/ui/cody/types'

// Map GitHub issue state to column
// Note: We now only fetch open issues, so 'closed' case should not occur
function getColumnForIssue(issue: { state: 'open' | 'closed'; labels: Array<{ name: string }> }, workflowStatus?: string): ColumnId {
  // Check for labels that indicate state
  const labelNames = issue.labels.map(l => l.name.toLowerCase())
  
  if (labelNames.includes('failed') || workflowStatus === 'failed') return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'
  
  return 'open'
}

export async function GET(req: NextRequest) {
  // Skip auth check for now - open access for testing
  
  const { searchParams } = new URL(req.url)
  const board = searchParams.get('board') || 'all'
  const since = searchParams.get('since') || undefined // ISO date string, e.g., "2026-02-01"
  const includeDetails = searchParams.get('includeDetails') !== 'false' // whether to fetch PRs/branches

  // Date filter presets
  let sinceDate: string | undefined = since
  if (!sinceDate && searchParams.get('days')) {
    const days = parseInt(searchParams.get('days')!, 10)
    const date = new Date()
    date.setDate(date.getDate() - days)
    sinceDate = date.toISOString()
  }

  try {
    // Fetch only open issues to reduce API calls and skip done/closed tasks
    const issues = await fetchIssues({ 
      state: 'open', 
      perPage: 100,
      since: sinceDate,
    })

    // Only fetch workflow runs if we need details
    const workflowRuns = includeDetails 
      ? await fetchWorkflowRuns({ perPage: 50 })
      : []

    // Parse issues into tasks with additional metadata
    const tasks: CodyTask[] = await Promise.all(
      issues.map(async (issue) => {
        // Find workflow run for this task
        const taskIdMatch = issue.title.match(/\[[^\]]+\]/)
        const taskId = taskIdMatch ? taskIdMatch[0].replace(/[\[\]]/g, '') : ''
        
        const workflowRun = workflowRuns.find(run => 
          run.html_url.includes(taskId) || 
          (issue.body && issue.body.includes(run.id.toString()))
        )

        // Only fetch PR and branch details if requested (expensive API calls)
        let pr = null
        let pipelineStatus = undefined
        
        if (includeDetails && taskId) {
          // Find associated PR
          pr = await findAssociatedPR(taskId)

          // Get pipeline status from branch
          const branch = await findTaskBranch(taskId)
          if (branch) {
            const status = await getStatusFromBranch(taskId, branch)
            if (status) pipelineStatus = status
          }
        }

        const column = getColumnForIssue(issue, workflowRun?.status)

        return {
          id: taskId || issue.number.toString(),
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
          // Include assignees for Execute button logic
          assignees: issue.assignees,
          isCodyAssigned: issue.isCodyAssigned,
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
    const { title, body: issueBody, mode, labels, assignees } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Generate task ID prefix if mode is provided
    const taskIdPrefix = mode ? `[${new Date().toISOString().slice(2, 8).replace('-', '')}-auto-XX] ` : ''
    const fullTitle = title.startsWith('[') ? title : `${taskIdPrefix}${title}`

    // Create the issue in GitHub
    const issue = await createIssue({
      title: fullTitle,
      body: issueBody || '',
      labels: labels || [],
      assignees: assignees || [],
    })

    console.log('[Cody] Created issue:', issue.number, issue.title)

    return NextResponse.json({
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
      },
    })
  } catch (error: any) {
    console.error('[Cody] Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task', details: error.message }, { status: 500 })
  }
}
