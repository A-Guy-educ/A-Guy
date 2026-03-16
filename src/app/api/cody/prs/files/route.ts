/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pr-files-api
 * @ai-summary API route to fetch file changes for a PR
 */
import { NextRequest, NextResponse } from 'next/server'

import { handleCodyApiError } from '@/ui/cody/github-error-handler'
import { prFilesQuerySchema } from '@/ui/cody/schemas'
import { parseQueryParams } from '@/server/api/responses'
import { requireCodyAuth } from '@/ui/cody/auth'
import { fetchPRFileChanges } from '@/ui/cody/github-client'

export async function GET(req: NextRequest) {
  const authError = await requireCodyAuth(req)
  if (authError) return authError

  // Validate query params
  const parsed = parseQueryParams(req, prFilesQuerySchema)
  if ('error' in parsed) return parsed.error
  const { prNumber } = parsed.data

  try {
    const files = await fetchPRFileChanges(prNumber)

    return NextResponse.json({ files })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'prs/files')
  }
}
