/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern tasks-api
 * @ai-summary API route to fetch tasks with kanban data
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/cody/auth'
import {
  fetchIssues,
  fetchComments,
  fetchWorkflowRuns,
  findAssociatedPR,
  findTaskBranch,
  getStatusFromBranch,
} from '@/lib/cody/github-client'
import { parseAllComments } from '@/lib/cody/task-parser'
import { buildCodyTask, getVisibleColumns } from '@/lib/cody/board-mapper'
import type { CodyTask } from '@/lib/cody/types'

// Query params schema
const querySchema = z.object({
  board: z.string().optional().default('all'),
  status: z.enum(['open', 'closed', 'all']).optional().default('all'),
  limit: z.coerce.number().optional().default(50),
})

export async function GET(req: NextRequest) {
  // Check auth
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const params = querySchema.parse({
      board: searchParams.get('board'),
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
    })

    // Determine filters based on board
    let labels: string | undefined
    let milestone: number | undefined

    if (params.board && params.board !== 'all') {
      if (params.board.startsWith('label:')) {
        labels = params.board.replace('label:', '')
      } else if (params.board.startsWith('milestone:')) {
        milestone = parseInt(params.board.replace('milestone:', ''), 10)
      }
    }

    // Fetch issues
    const issues = await fetchIssues({
      state: params.status as 'open' | 'closed' | 'all',
      labels,
      milestone,
      perPage: params.limit,
    })

    // Fetch workflow runs
    const workflowRuns = await fetchWorkflowRuns({ perPage: 50 })

    // Build tasks with all necessary data
    const tasks: CodyTask[] = await Promise.all(
      issues.map(async (issue) => {
        // Fetch comments for this issue
        const rawComments = await fetchComments(issue.number)
        const comments = parseAllComments(rawComments)

        // Find task ID
        const taskMarkerComment = comments.find((c) => c.type === 'task-marker')
        const taskId = taskMarkerComment?.taskId || `issue-${issue.number}`

        // Find workflow run for this task
        const workflowRun = workflowRuns.find((run) =>
          run.html_url.includes(taskId) || run.html_url.includes(issue.number.toString())
        )

        // Try to find branch and status
        let pipeline = null
        if (taskMarkerComment?.taskId) {
          const branch = await findTaskBranch(taskMarkerComment.taskId)
          if (branch) {
            pipeline = await getStatusFromBranch(taskMarkerComment.taskId, branch)
          }
        }

        // Find associated PR
        const associatedPR = taskMarkerComment?.taskId
          ? await findAssociatedPR(taskMarkerComment.taskId)
          : null

        // Build task
        const task = buildCodyTask({
          issue,
          comments,
          workflowRun,
          associatedPR,
        })

        // Add pipeline if found
        if (pipeline) {
          task.pipeline = pipeline
        }

        return task
      })
    )

    // Get visible columns
    const columns = getVisibleColumns(tasks)

    return NextResponse.json({ tasks, columns })
  } catch (error: any) {
    console.error('[Cody] Error fetching tasks:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'GitHub token expired' }, { status: 502 })
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'GitHub rate limit' }, { status: 429 })
    }
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
