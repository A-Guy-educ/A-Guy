/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pipeline-api
 * @ai-summary API route to fetch pipeline status for a task
 */
import { NextRequest, NextResponse } from 'next/server'

import { handleCodyApiError } from '@/ui/cody/github-error-handler'
import { pipelineParamsSchema } from '@/ui/cody/schemas'
import { apiValidationError } from '@/server/api/responses'
import { requireAuth } from '@/ui/cody/auth'
import {
  findTaskBranch,
  findBranchByIssueNumber,
  getStatusFromBranch,
  findStatusOnBranch,
  getStatusFromArtifact,
  fetchWorkflowRuns,
} from '@/ui/cody/github-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  // Check auth
  const authError = await requireAuth(req)
  if (authError) return authError

  // Validate path params
  const { taskId: rawTaskId } = await params
  const parsed = pipelineParamsSchema.safeParse({ taskId: rawTaskId })
  if (!parsed.success) {
    return apiValidationError(parsed.error)
  }
  const { taskId } = parsed.data

  try {
    // Try branch status first (for running tasks)
    const branch = await findTaskBranch(taskId)
    if (branch) {
      let status = await getStatusFromBranch(taskId, branch)
      // Fallback: discover task ID by scanning .tasks/ directory
      if (!status) {
        status = await findStatusOnBranch(branch)
      }
      if (status) {
        return NextResponse.json({
          status,
          source: 'branch',
        })
      }
    }

    // If taskId looks like an issue number, try finding branch by issue number
    if (/^\d+$/.test(taskId)) {
      const issueBranch = await findBranchByIssueNumber(parseInt(taskId))
      if (issueBranch) {
        const status = await findStatusOnBranch(issueBranch)
        if (status) {
          return NextResponse.json({
            status,
            source: 'branch',
          })
        }
      }
    }

    // Try artifact status (for completed tasks)
    const workflowRuns = await fetchWorkflowRuns({ perPage: 10 })
    const run = workflowRuns.find((r) => r.html_url.includes(taskId))

    if (run) {
      const status = await getStatusFromArtifact(taskId, run.id.toString())
      if (status) {
        return NextResponse.json({
          status,
          source: 'artifact',
        })
      }
    }

    // No status found
    return NextResponse.json({
      status: null,
      source: null,
    })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'pipeline')
  }
}
