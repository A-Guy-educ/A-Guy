/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern approve-review
 * @ai-summary Approve a PR review and merge it via GitHub API (Octokit)
 */
import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { requireAuth } from '@/ui/cody/auth'

const OWNER = 'A-Guy-educ'
const REPO = 'A-Guy'

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured')
  }
  return new Octokit({ auth: token })
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json()
    const { prNumber } = body

    if (!prNumber) {
      return NextResponse.json({ error: 'Missing prNumber' }, { status: 400 })
    }

    const octokit = getOctokit()
    const results: string[] = []

    // 1. Approve the PR review
    try {
      await octokit.pulls.createReview({
        owner: OWNER,
        repo: REPO,
        pull_number: Number(prNumber),
        event: 'APPROVE',
        body: '✅ Approved via Cody dashboard.',
      })
      results.push(`Approved PR #${prNumber}`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      // May fail if already approved or self-review
      results.push(`Review note: ${msg}`)
    }

    // 2. Merge the PR (squash)
    try {
      await octokit.pulls.merge({
        owner: OWNER,
        repo: REPO,
        pull_number: Number(prNumber),
        merge_method: 'squash',
      })
      results.push(`Merged PR #${prNumber}`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('not mergeable') || msg.includes('405')) {
        return NextResponse.json(
          {
            error: 'PR is not mergeable — CI may still be running or checks have failed',
            results,
          },
          { status: 409 },
        )
      }
      throw error
    }

    // 3. Delete the branch (only for feature branches, not dev)
    try {
      const { data: pr } = await octokit.pulls.get({
        owner: OWNER,
        repo: REPO,
        pull_number: Number(prNumber),
      })

      const branchRef = pr.head.ref
      // Don't delete protected branches
      if (branchRef !== 'dev' && branchRef !== 'main') {
        await octokit.git.deleteRef({
          owner: OWNER,
          repo: REPO,
          ref: `heads/${branchRef}`,
        })
        results.push(`Deleted branch ${branchRef}`)
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      results.push(`Branch cleanup note: ${msg}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cody] Merge error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
