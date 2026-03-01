/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern publish
 * @ai-summary Create a GitHub issue with 'publish' label to trigger dev→main PR workflow
 */
import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { requireAuth } from '@/ui/cody/auth'
import { GITHUB_OWNER, GITHUB_REPO, DEV_BRANCH, PROD_BRANCH } from '@/ui/cody/constants'

const PUBLISH_LABEL = 'publish'

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
    const octokit = getOctokit()

    // 1. Check if dev is ahead of main
    const { data: comparison } = await octokit.repos.compareCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      base: PROD_BRANCH,
      head: DEV_BRANCH,
    })

    if (comparison.ahead_by === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nothing to publish — dev is already up to date with main.',
      })
    }

    // 2. Check for existing open publish issue
    const { data: existingIssues } = await octokit.issues.listForRepo({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      labels: PUBLISH_LABEL,
      state: 'open',
    })

    // Filter out PRs (GitHub API returns PRs in issue list)
    const publishIssues = existingIssues.filter((i) => !i.pull_request)

    if (publishIssues.length > 0) {
      const existing = publishIssues[0]
      return NextResponse.json({
        success: true,
        message: `Publish already in progress — issue #${existing.number}`,
        issueNumber: existing.number,
        issueUrl: existing.html_url,
      })
    }

    // 3. Create the publish issue
    const { data: issue } = await octokit.issues.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title: `Publish dev → production (${comparison.ahead_by} commits)`,
      body: [
        '## Publish to Production',
        '',
        `Merging \`${DEV_BRANCH}\` into \`${PROD_BRANCH}\` — **${comparison.ahead_by} commits** ahead.`,
        '',
        'This issue was created via the Cody dashboard Publish button.',
        'A GitHub Action will automatically create a PR from `dev` → `main`.',
        'Once CI passes, use the Merge button in the dashboard to finalize.',
      ].join('\n'),
      labels: [PUBLISH_LABEL],
    })

    return NextResponse.json({
      success: true,
      message: `Publish issue #${issue.number} created`,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cody] Publish error:', msg)
    return NextResponse.json({ error: msg || 'Publish failed' }, { status: 500 })
  }
}
