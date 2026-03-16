/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern approve-review
 * @ai-summary Approve a PR review and merge it via GitHub API (Octokit).
 *             All PRs (feature and publish) use standard squash merge.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCodyAuth, verifyActorLogin } from '@/ui/cody/auth'
import { getOctokit } from '@/ui/cody/github-client'
import { GITHUB_OWNER, GITHUB_REPO } from '@/ui/cody/constants'

const DEV_BRANCH = 'dev'
const PROD_BRANCH = 'main'

export async function POST(req: NextRequest) {
  // Use GitHub OAuth auth for consistency with other routes
  const authResult = await requireCodyAuth(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const { prNumber, actorLogin } = body

    if (!prNumber) {
      return NextResponse.json({ error: 'Missing prNumber' }, { status: 400 })
    }

    // Verify actorLogin matches the authenticated session (prevents impersonation)
    const actorResult = await verifyActorLogin(req, actorLogin)
    if (actorResult instanceof NextResponse) return actorResult
    const { identity } = actorResult

    // Use verified identity's login for attribution
    const verifiedLogin = identity.login

    const octokit = getOctokit()
    const results: string[] = []

    // Fetch PR data once, reuse throughout
    const { data: prData } = await octokit.pulls.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: Number(prNumber),
    })

    const isPublishPR = prData.head.ref === DEV_BRANCH && prData.base.ref === PROD_BRANCH

    // 1. Approve the PR review - use verified identity for attribution
    try {
      await octokit.pulls.createReview({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        pull_number: Number(prNumber),
        event: 'APPROVE',
        body: `✅ Approved by @${verifiedLogin} via Cody dashboard.`,
      })
      results.push(`Approved PR #${prNumber}`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      // May fail if already approved or self-review
      results.push(`Review note: ${msg}`)
    }

    // 2. Merge the PR (squash merge for all PRs)
    try {
      const mergeMethod = isPublishPR ? 'merge' : 'squash'
      await octokit.pulls.merge({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        pull_number: Number(prNumber),
        merge_method: mergeMethod,
      })
      results.push(`Merged PR #${prNumber} (${mergeMethod})`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('not mergeable') || msg.includes('405')) {
        return NextResponse.json(
          {
            error:
              'PR is not mergeable — CI may still be running, checks have failed, or there are merge conflicts',
            results,
          },
          { status: 409 },
        )
      }
      throw error
    }

    // 3. Delete the branch (only for feature branches, not dev or main)
    if (!isPublishPR) {
      try {
        const branchRef = prData.head.ref
        if (branchRef !== DEV_BRANCH && branchRef !== PROD_BRANCH) {
          await octokit.git.deleteRef({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            ref: `heads/${branchRef}`,
          })
          results.push(`Deleted branch ${branchRef}`)
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        results.push(`Branch cleanup note: ${msg}`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cody] Merge error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
