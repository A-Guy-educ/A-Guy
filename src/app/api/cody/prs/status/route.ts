/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern pr-ci-status
 * @ai-summary Fetch CI status and mergeability for a PR
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCodyAuth } from '@/ui/cody/auth'
import { fetchPRCIStatus } from '@/ui/cody/github-client'
import { logger } from '@/infra/utils/logger/logger'

const querySchema = z.object({
  prNumber: z.coerce.number().int().positive(),
})

export async function GET(req: NextRequest) {
  const authError = await requireCodyAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({ prNumber: searchParams.get('prNumber') })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid prNumber: must be a positive integer' },
        { status: 400 },
      )
    }

    const status = await fetchPRCIStatus(parsed.data.prNumber)

    return NextResponse.json(status)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, `Error fetching PR CI status: ${msg}`)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
