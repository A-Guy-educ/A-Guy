/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern prs-comments-api
 * @ai-summary API route to fetch and post PR comments
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleCodyApiError } from '@/ui/cody/github-error-handler'
import { requireAuth } from '@/ui/cody/auth'
import { fetchPRComments, postComment, clearCache } from '@/ui/cody/github-client'

const getSchema = z.object({
  prNumber: z.coerce.number().int().positive(),
})

const postSchema = z.object({
  prNumber: z.number().int().positive(),
  body: z.string().min(1),
  actorLogin: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const parsed = getSchema.safeParse({ prNumber: searchParams.get('prNumber') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid prNumber' }, { status: 400 })
    }

    const comments = await fetchPRComments(parsed.data.prNumber)
    return NextResponse.json({ comments })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'pr-comments')
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { prNumber, body: commentBody, actorLogin } = parsed.data
    const fullBody = actorLogin ? `${commentBody}\n\n_(posted by @${actorLogin})_` : commentBody

    // GitHub API: PR comments use the same endpoint as issue comments
    await postComment(prNumber, fullBody)
    clearCache()

    return NextResponse.json({ success: true, message: 'Comment posted' })
  } catch (error: unknown) {
    return handleCodyApiError(error, 'pr-comments')
  }
}
