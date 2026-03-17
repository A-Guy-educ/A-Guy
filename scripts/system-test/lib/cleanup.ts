/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern cleanup
 * @ai-summary Cleanup functions for test artifacts
 */

import { execFileSync } from 'child_process'
import type { GitHubClient } from '../../inspector/core/types'

export interface CleanupOptions {
  issueNumber?: number
  prNumbers?: number[]
  branches?: string[]
}

/**
 * Clean up test artifacts from a scenario run.
 * Each operation is try/catch'd independently - one failure doesn't block others.
 */
export async function cleanupScenario(
  gh: GitHubClient,
  repo: string,
  opts: CleanupOptions,
): Promise<void> {
  // Close issue
  if (opts.issueNumber) {
    try {
      gh.closeIssue(opts.issueNumber, 'not planned')
      console.log(`✓ Closed issue #${opts.issueNumber}`)
    } catch (error) {
      console.warn(`⚠ Failed to close issue #${opts.issueNumber}: ${error}`)
    }
  }

  // Close PRs
  if (opts.prNumbers) {
    for (const prNumber of opts.prNumbers) {
      try {
        execFileSync('gh', ['pr', 'close', String(prNumber), '--repo', repo], {
          encoding: 'utf-8',
          env: { ...process.env },
        })
        console.log(`✓ Closed PR #${prNumber}`)
      } catch (error) {
        console.warn(`⚠ Failed to close PR #${prNumber}: ${error}`)
      }
    }
  }

  // Delete branches
  if (opts.branches) {
    for (const branch of opts.branches) {
      try {
        execFileSync('gh', ['api', '-X', 'DELETE', `repos/${repo}/git/refs/heads/${branch}`], {
          encoding: 'utf-8',
          env: { ...process.env },
        })
        console.log(`✓ Deleted branch ${branch}`)
      } catch (error) {
        console.warn(`⚠ Failed to delete branch ${branch}: ${error}`)
      }
    }
  }
}

/**
 * Clean up all system test artifacts.
 * Finds all open issues with the system-test label and cleans them up.
 * This is an idempotent safety net for catching any leaked artifacts.
 */
export async function cleanupAllSystemTests(
  gh: GitHubClient,
  repo: string,
): Promise<{ closedIssues: number; closedPRs: number; deletedBranches: number }> {
  let closedIssues = 0
  let closedPRs = 0
  let deletedBranches = 0

  // Find all open issues with system-test label
  const issues = gh.getOpenIssues(['system-test'])

  console.log(`Found ${issues.length} open issues with system-test label`)

  for (const issue of issues) {
    // Find associated PRs by looking for branches with systest pattern
    let foundPRs: number[] = []
    let foundBranches: string[] = []

    try {
      const output = execFileSync(
        'gh',
        ['pr', 'list', '--limit', '100', '--state', 'open', '--json', 'number,headRefName'],
        {
          encoding: 'utf-8',
          env: { ...process.env, GH_REPO: repo },
        },
      )

      const prs = JSON.parse(output) as Array<{ number: number; headRefName: string }>
      const systestPRs = prs.filter(
        (p) => p.headRefName.includes('systest') || p.headRefName.includes('system-test'),
      )
      foundPRs = systestPRs.map((p) => p.number)
      foundBranches = systestPRs.map((p) => p.headRefName)
    } catch {
      // No PRs found
    }

    // Clean up this issue and its artifacts
    await cleanupScenario(gh, repo, {
      issueNumber: issue.number,
      prNumbers: foundPRs.length > 0 ? foundPRs : undefined,
      branches: foundBranches.length > 0 ? foundBranches : undefined,
    })

    closedIssues++
    closedPRs += foundPRs.length
    deletedBranches += foundBranches.length
  }

  return { closedIssues, closedPRs, deletedBranches }
}
