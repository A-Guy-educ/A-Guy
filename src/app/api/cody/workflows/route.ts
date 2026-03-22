/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern workflows-api
 * @ai-summary API route to fetch workflow runs
 */
import { NextRequest, NextResponse } from 'next/server'

import { handleCodyApiError } from '@/ui/cody/github-error-handler'
import { workflowsQuerySchema } from '@/ui/cody/schemas'
import { parseQueryParams } from '@/server/api/responses'
import { requireCodyAuth } from '@/ui/cody/auth'
import { fetchWorkflowRuns } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  // Check auth
  const authError = await requireCodyAuth(req)
  if (authError) return authError

  // Validate query params
  const parsed = parseQueryParams(req, workflowsQuerySchema)
  if ('error' in parsed) return parsed.error
  const { status } = parsed.data

  try {
    const runs = await fetchWorkflowRuns({
      status,
      perPage: 20,
    })

    return NextResponse.json({ runs })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'workflows')
  }
}
