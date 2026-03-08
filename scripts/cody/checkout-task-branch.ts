/**
 * @fileType utility
 * @domain cody
 * @ai-summary Checkout existing feature branch for a task
 */

import { logger } from './logger'
import { execFileSync } from 'child_process'
import { closeLinkedPR } from './github-api'

// Git branch prefixes to try
const BRANCH_PREFIXES = ['feat', 'fix', 'refactor', 'docs', 'chore', 'security', 'test']

// Default branch fallback
const DEFAULT_BRANCH_FALLBACK = 'dev'

// Git identity for CI (can be overridden via env vars)
const GIT_EMAIL = process.env.GIT_USER_EMAIL || '242132053+aguyaharonyair@users.noreply.github.com'
const GIT_NAME = process.env.GIT_USER_NAME || 'aguyaharonyair'

/**
 * Execute git command and return output
 */
function gitExec(args: string[], options: { silent?: boolean } = {}): string {
  try {
    return (
      execFileSync('git', args, {
        encoding: 'utf-8',
        stdio: options.silent ? 'ignore' : 'inherit',
      }) || ''
    )
  } catch {
    return ''
  }
}

/**
 * Execute git command that may fail
 */
function gitExecSilent(args: string[]): string {
  try {
    return (
      execFileSync('git', args, {
        encoding: 'utf-8',
      }) || ''
    )
  } catch {
    return ''
  }
}

/**
 * Configure git identity
 */
function configureGitIdentity(): void {
  execFileSync('git', ['config', '--global', 'user.email', GIT_EMAIL], { encoding: 'utf-8' })
  execFileSync('git', ['config', '--global', 'user.name', GIT_NAME], { encoding: 'utf-8' })
}

/**
 * Fetch latest remote refs
 */
function fetchOrigin(): void {
  gitExec(['fetch', 'origin'])
}

/**
 * Get default branch name
 */
function getDefaultBranch(): string {
  const output = gitExecSilent(['symbolic-ref', 'refs/remotes/origin/HEAD'])
  if (output) {
    const match = output.match(/refs\/remotes\/origin\/(.+)/)
    if (match) {
      return match[1].trim()
    }
  }
  return DEFAULT_BRANCH_FALLBACK
}

/**
 * Checkout and pull branch
 */
function checkoutAndPull(branch: string): void {
  gitExec(['checkout', branch])
  gitExec(['pull', 'origin', branch])
}

/**
 * Merge default branch into current branch
 */
function mergeDefaultBranch(defaultBranch: string): boolean {
  try {
    gitExec(['merge', `origin/${defaultBranch}`, '--no-edit'])
    return true
  } catch {
    logger.info('=== CONFLICT: Merge failed ===')
    gitExec(['merge', '--abort'])
    return false
  }
}
/**
 * Reset branch if --fresh flag is set.
 * Closes any existing PR for the issue (which also deletes its branch via --delete-branch).
 * Falls back to manual branch deletion if no PR exists.
 */
export function resetBranchIfFresh(
  branch: string | null,
  _defaultBranch: string,
  issueNumber?: string,
): string | null {
  const fresh = process.env.FRESH === 'true'
  if (!fresh) return branch

  logger.info('  --fresh flag detected: will reset branch from scratch')

  // Close existing PR (also deletes the branch via gh pr close --delete-branch)
  if (issueNumber) {
    logger.info('    Closing existing PR for issue #' + issueNumber)
    const prClosed = closeLinkedPR(parseInt(issueNumber, 10))
    if (prClosed) {
      // closeLinkedPR already deleted the branch via --delete-branch
      return null
    }
  }

  // Fallback: manually delete branch if no PR was found (branch may exist without a PR)
  if (branch) {
    logger.info('    Deleting existing branch: ' + branch)
    try {
      gitExec(['push', 'origin', '--delete', branch])
      logger.info('    Deleted remote branch')
    } catch (_e) {
      // May not exist on remote
    }
    try {
      gitExec(['branch', '-D', branch])
      logger.info('    Deleted local branch')
    } catch (_e) {
      // May not exist locally
    }
  }

  // Return null to force creating a new branch from default
  return null
}

/**
 * Find remote branches matching a task ID pattern.
 * Branch names use descriptive suffixes derived from the issue title,
 * so we search by the date prefix from the task ID (e.g., "260226-auto")
 * combined with the git branch prefix (fix/, feat/, etc.).
 */
function findRemoteBranch(taskId: string): string | null {
  // Extract date prefix: "260226-auto-18" → "260226-auto"
  // For manual tasks like "260226-my-task" → "260226-my"
  const parts = taskId.split('-')
  // Use first two parts as the search pattern (date + descriptor)
  const datePrefix = parts.slice(0, 2).join('-')

  const remoteBranches = gitExecSilent(['branch', '-r', '--list'])
  if (!remoteBranches) return null

  const branches = remoteBranches
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && !b.includes('->'))
    .map((b) => b.replace('origin/', ''))

  // First, try to find branches that match by date prefix AND exact issue number
  // This prevents picking up the wrong branch when multiple issues use the same date
  const issueNumber = process.env.ISSUE_NUMBER
  if (issueNumber) {
    for (const prefix of BRANCH_PREFIXES) {
      const pattern = `${prefix}/${datePrefix}-`
      const matches = branches.filter((b) => b.startsWith(pattern))
      // Must match EXACT issue number: -699- or -699 at end, not -694-
      const issueMatch = matches.find((b) => {
        // Match -699- or -699. or -699_ or end of string
        const regex = new RegExp('-' + issueNumber + '(-|\.|_|$)')
        return regex.test(b)
      })
      if (issueMatch) return issueMatch
    }
    // If we have an issue number but no matching branch, DON'T fall back - create new branch
    logger.info('  No branch found for issue #' + issueNumber + ', will create new branch')
    return null
  }

  // Collect ALL matches across ALL prefixes before deciding
  // Previously this returned on the first prefix with a single match,
  // which could pick feat/ when the correct branch was fix/
  const allMatches: string[] = []
  for (const prefix of BRANCH_PREFIXES) {
    const pattern = `${prefix}/${datePrefix}-`
    const matches = branches.filter((b) => b.startsWith(pattern))
    allMatches.push(...matches)
  }

  // Only return if there's exactly ONE match across all prefixes
  if (allMatches.length === 1) {
    return allMatches[0]
  }
  // If multiple matches across different prefixes, don't guess — create new branch

  // Also try exact match (legacy/simple branch names)
  for (const prefix of BRANCH_PREFIXES) {
    const exact = `${prefix}/${taskId}`
    if (branches.includes(exact)) return exact
  }

  return null
}

/**
 * Find remote branches matching an issue number (without requiring a task ID).
 * Used when --fresh flag is set and task_id is empty but issue_number is available.
 */
function findRemoteBranchByIssueNumber(issueNumber: string): string | null {
  const remoteBranches = gitExecSilent(['branch', '-r', '--list'])
  if (!remoteBranches) return null

  const branches = remoteBranches
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && !b.includes('->'))
    .map((b) => b.replace('origin/', ''))

  // Search all prefixes for a branch containing the exact issue number
  for (const prefix of BRANCH_PREFIXES) {
    const matches = branches.filter((b) => b.startsWith(`${prefix}/`))
    const issueMatch = matches.find((b) => {
      const regex = new RegExp('-' + issueNumber + '(-|\\.|_|$)')
      return regex.test(b)
    })
    if (issueMatch) return issueMatch
  }

  return null
}

/**
 * Main entry point
 */
function main(): void {
  const taskId = process.env.TASK_ID
  const issueNumber = process.env.ISSUE_NUMBER
  const fresh = process.env.FRESH === 'true'

  // When --fresh is used, task_id may be empty. We can still find the old branch
  // by issue number to delete it and start clean.
  if (!taskId && !issueNumber) {
    logger.error('Neither TASK_ID nor ISSUE_NUMBER set!')
    process.exit(1)
  }

  // Configure git identity
  configureGitIdentity()

  // Fetch latest
  fetchOrigin()

  // Get default branch
  const defaultBranch = getDefaultBranch()
  logger.info(`=== Default branch: ${defaultBranch} ===`)

  // Find feature branch by pattern matching
  let branch: string | null = null
  if (taskId) {
    branch = findRemoteBranch(taskId)
  } else if (issueNumber) {
    // No task ID (e.g., --fresh mode) — search by issue number
    logger.info(`=== No task ID, searching by issue number #${issueNumber} ===`)
    branch = findRemoteBranchByIssueNumber(issueNumber)
  }

  // Reset branch if --fresh flag is set (deletes old branch)
  branch = resetBranchIfFresh(branch, defaultBranch, issueNumber)

  if (branch) {
    logger.info(`=== Found feature branch: ${branch} ===`)

    checkoutAndPull(branch)

    logger.info(`=== Merging latest ${defaultBranch} into ${branch} ===`)

    if (!mergeDefaultBranch(defaultBranch)) {
      logger.info('=== Aborting merge ===')
      process.exit(1)
    }

    process.exit(0)
  }

  // When --fresh with no task ID, we just deleted the old branch (if found).
  // The pipeline will generate a new task ID and ensureFeatureBranch() will create a new branch.
  if (fresh && !taskId) {
    logger.info(
      `=== --fresh mode: old branch cleaned up, staying on ${defaultBranch} for new task ===`,
    )
    process.exit(0)
  }

  logger.info(
    `=== No feature branch found for ${taskId || 'issue #' + issueNumber}, staying on default branch ===`,
  )
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
