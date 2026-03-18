/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern polling
 * @ai-summary Polling utilities for workflow completion
 */

import type { GitHubClient, WorkflowRun, IssueComment } from '../../inspector/core/types'

export interface PollWorkflowOptions {
  workflow: string
  afterTimestamp: string
  matchBranch?: RegExp
  maxWaitMs: number
  intervalMs: number
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Poll for a workflow run to complete.
 * Looks for the most recent run created after the given timestamp.
 */
export async function pollWorkflowRun(
  gh: GitHubClient,
  opts: PollWorkflowOptions,
): Promise<WorkflowRun> {
  const startTime = Date.now()

  while (Date.now() - startTime < opts.maxWaitMs) {
    const runs = gh.listWorkflowRuns(opts.workflow, { per_page: 30, status: 'completed' })

    // Filter by timestamp and optionally by branch
    const matchingRuns = runs
      .filter((run) => new Date(run.createdAt).getTime() >= new Date(opts.afterTimestamp).getTime())
      .filter((run) => !opts.matchBranch || opts.matchBranch.test(run.headBranch))

    if (matchingRuns.length > 0) {
      // Return the most recent one
      return matchingRuns.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]
    }

    await sleep(opts.intervalMs)
  }

  throw new TimeoutError(`Workflow ${opts.workflow} did not complete within ${opts.maxWaitMs}ms`)
}

/**
 * Poll for a comment matching a pattern on an issue.
 */
export async function pollForComment(
  gh: GitHubClient,
  issueNumber: number,
  pattern: RegExp,
  maxWaitMs: number,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<IssueComment> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const comments = gh.getIssueComments(issueNumber)

    for (const comment of comments) {
      if (pattern.test(comment.body)) {
        return comment
      }
    }

    await sleep(intervalMs)
  }

  throw new TimeoutError(
    `No comment matching ${pattern} found on issue ${issueNumber} within ${maxWaitMs}ms`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Re-export sleep for external use
export { sleep }

const POLL_INTERVAL_MS = 30_000 // Default poll interval
