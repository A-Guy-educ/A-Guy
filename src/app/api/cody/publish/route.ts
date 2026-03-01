/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern publish
 * @ai-summary Create a PR from dev → main and auto-approve it via GitHub API
 */
import { NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

const OWNER = 'A-Guy-educ'
const REPO = 'A-Guy'
const DEV_BRANCH = 'dev'
const PROD_BRANCH = 'main'

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured')
  }
  return new Octokit({ auth: token })
}

export async function POST() {
  try {
    const octokit = getOctokit()
    const results: string[] = []

    // 1. Check if dev is ahead of main
    let aheadBy = 0
    try {
      const { data: comparison } = await octokit.repos.compareCommits({
        owner: OWNER,
        repo: REPO,
        base: PROD_BRANCH,
        head: DEV_BRANCH,
      })
      aheadBy = comparison.ahead_by

      if (aheadBy === 0) {
        return NextResponse.json({
          success: true,
          message: 'Nothing to publish — dev is already up to date with main.',
          results: ['No new commits on dev'],
        })
      }

      results.push(`dev is ${aheadBy} commits ahead of main`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      results.push(`Compare note: ${msg}`)
    }

    // 2. Check for an existing open PR from dev → main
    let prNumber: number | null = null
    let prUrl: string | null = null

    try {
      const { data: existingPRs } = await octokit.pulls.list({
        owner: OWNER,
        repo: REPO,
        state: 'open',
        head: `${OWNER}:${DEV_BRANCH}`,
        base: PROD_BRANCH,
      })

      if (existingPRs.length > 0) {
        prNumber = existingPRs[0].number
        prUrl = existingPRs[0].html_url
        results.push(`Found existing PR #${prNumber}`)
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      results.push(`PR list note: ${msg}`)
    }

    // 3. Create PR if none exists
    if (!prNumber) {
      try {
        const { data: newPR } = await octokit.pulls.create({
          owner: OWNER,
          repo: REPO,
          title: `Publish dev → production (${aheadBy} commits)`,
          body: 'Automated publish via Cody dashboard.\n\nThis PR merges the `dev` branch into `main` to trigger a production deployment.',
          head: DEV_BRANCH,
          base: PROD_BRANCH,
        })
        prNumber = newPR.number
        prUrl = newPR.html_url
        results.push(`Created PR #${prNumber}`)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('No commits between')) {
          return NextResponse.json({
            success: true,
            message: 'Nothing to publish — no new commits between dev and main.',
            results,
          })
        }
        throw error
      }
    }

    // 4. Approve the PR
    try {
      await octokit.pulls.createReview({
        owner: OWNER,
        repo: REPO,
        pull_number: prNumber!,
        event: 'APPROVE',
        body: '✅ Auto-approved via Cody dashboard publish.',
      })
      results.push(`Approved PR #${prNumber}`)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      // May fail if the token user is the PR author (can't self-approve)
      results.push(`Approval note: ${msg}`)
    }

    return NextResponse.json({
      success: true,
      message: `PR #${prNumber} created and approved`,
      prUrl,
      prNumber,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cody] Publish error:', msg)
    return NextResponse.json({ error: msg || 'Publish failed' }, { status: 500 })
  }
}
