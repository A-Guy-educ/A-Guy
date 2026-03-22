/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern prs-api
 * @ai-summary API route to fetch PRs
 */
import { NextRequest, NextResponse } from 'next/server'

import { handleCodyApiError } from '@/ui/cody/github-error-handler'
import { prsQuerySchema } from '@/ui/cody/schemas'
import { parseQueryParams } from '@/server/api/responses'
import { requireCodyAuth } from '@/ui/cody/auth'
import { findAssociatedPR } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  // Check auth
  const authError = await requireCodyAuth(req)
  if (authError) return authError

  // Validate query params
  const parsed = parseQueryParams(req, prsQuerySchema)
  if ('error' in parsed) return parsed.error
  const { taskId } = parsed.data

  try {
    const pr = await findAssociatedPR(taskId)

    return NextResponse.json({ pr })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'prs')
  }
}
