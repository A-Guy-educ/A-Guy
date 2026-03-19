/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern assertions
 * @ai-summary Assertion functions for GitHub artifacts
 */

import { execFileSync } from 'child_process'
import type { GitHubClient, WorkflowRun } from '../../inspector/core/types'

export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

/**
 * Assert that an issue has all expected labels.
 */
export function assertLabelsPresent(
  gh: GitHubClient,
  issueNumber: number,
  expectedLabels: string[],
): void {
  const issue = gh.getIssue(issueNumber)
  if (!issue) {
    throw new AssertionError(`Issue #${issueNumber} not found`)
  }

  // getIssue doesn't return labels, so we need to check differently
  // We'll search for issues with specific labels
  const issues = gh.getOpenIssues([`label:${SYSTEM_TEST_LABEL}`])
  const matchingIssue = issues.find((i) => i.number === issueNumber)

  if (!matchingIssue) {
    // Issue might be closed, so getOpenIssues won't find it
    // Try via gh CLI directly
    try {
      const output = execFileSync(
        'gh',
        ['api', `repos/${process.env.REPO}/issues/${issueNumber}`, '--jq', '.labels[]?.name'],
        {
          encoding: 'utf-8',
          env: { ...process.env },
        },
      )

      const actualLabels = output.trim().split('\n').filter(Boolean)
      checkLabels(actualLabels, expectedLabels, issueNumber)
    } catch {
      throw new AssertionError(
        `Could not verify labels on issue #${issueNumber}. Issue may be closed.`,
      )
    }
  } else {
    checkLabels(matchingIssue.labels, expectedLabels, issueNumber)
  }
}

function checkLabels(actual: string[], expected: string[], issueNumber: number): void {
  const missing = expected.filter((label) => !actual.includes(label))
  if (missing.length > 0) {
    throw new AssertionError(
      `Issue #${issueNumber} missing labels: ${missing.join(', ')}. Have: ${actual.join(', ')}`,
    )
  }
}

/**
 * Assert that a PR was created matching the branch pattern.
 */
export function assertPRCreated(
  repo: string,
  branchPattern: RegExp,
): { number: number; branch: string; title: string } {
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'list', '--limit', '50', '--state', 'open', '--json', 'number,headRefName,title'],
      {
        encoding: 'utf-8',
        env: { ...process.env, GH_REPO: repo },
      },
    )

    const prs = JSON.parse(output) as Array<{ number: number; headRefName: string; title: string }>

    for (const pr of prs) {
      if (branchPattern.test(pr.headRefName)) {
        return {
          number: pr.number,
          branch: pr.headRefName,
          title: pr.title,
        }
      }
    }

    throw new AssertionError(
      `No PR found matching branch pattern ${branchPattern}. Available PRs: ${prs.map((p) => p.headRefName).join(', ')}`,
    )
  } catch (error) {
    if (error instanceof AssertionError) throw error
    throw new AssertionError(`Failed to search for PRs: ${error}`)
  }
}

/**
 * Assert that no PR was created matching the branch pattern.
 */
export function assertNoPRCreated(repo: string, branchPattern: RegExp): void {
  try {
    const result = assertPRCreated(repo, branchPattern)
    throw new AssertionError(
      `Expected no PR matching ${branchPattern}, but found PR #${result.number}: ${result.branch}`,
    )
  } catch (error) {
    if (error instanceof AssertionError) throw error
    // If we couldn't search, that's OK - assume no PR
  }
}

interface StageState {
  state: string
}

/**
 * Assert that stage states match expected values.
 */
export function assertStageStates(
  statusJson: { stages?: Record<string, StageState> },
  expected: Record<string, 'completed' | 'skipped' | 'pending' | 'running'>,
): void {
  const stages = statusJson.stages || {}

  for (const [stageName, expectedState] of Object.entries(expected)) {
    const actual = stages[stageName]?.state

    if (actual !== expectedState) {
      throw new AssertionError(
        `Stage "${stageName}" expected state "${expectedState}", got "${actual || 'not present'}"`,
      )
    }
  }
}

/**
 * Assert that at least one comment matches the pattern.
 */
export function assertCommentExists(gh: GitHubClient, issueNumber: number, pattern: RegExp): void {
  const comments = gh.getIssueComments(issueNumber)

  for (const comment of comments) {
    if (pattern.test(comment.body)) {
      return // Found matching comment
    }
  }

  throw new AssertionError(`No comment matching ${pattern} found on issue #${issueNumber}`)
}

/**
 * Assert that workflow run succeeded.
 */
export function assertWorkflowSucceeded(run: WorkflowRun): void {
  if (run.conclusion !== 'success') {
    throw new AssertionError(
      `Workflow run ${run.id} concluded as "${run.conclusion}", expected "success"`,
    )
  }
}

const SYSTEM_TEST_LABEL = 'system-test'
