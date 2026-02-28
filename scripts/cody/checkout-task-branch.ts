/**
 * @fileType utility
 * @domain cody
 * @ai-summary Checkout existing feature branch for a task
 */

import { execSync } from 'child_process'

// Git branch prefixes to try
const BRANCH_PREFIXES = ['feat', 'fix', 'refactor', 'docs', 'chore', 'security', 'test']

// Default branch fallback
const DEFAULT_BRANCH_FALLBACK = 'dev'

// Git identity for CI
const GIT_EMAIL = '242132053+aguyaharonyair@users.noreply.github.com'
const GIT_NAME = 'aguyaharonyair'

/**
 * Execute git command and return output
 */
function gitExec(args: string[], options: { silent?: boolean } = {}): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: options.silent ? 'ignore' : 'inherit',
    })
  } catch {
    return ''
  }
}

/**
 * Execute git command that may fail
 */
function gitExecSilent(args: string[]): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
    })
  } catch {
    return ''
  }
}

/**
 * Configure git identity
 */
function configureGitIdentity(): void {
  execSync(`git config --global user.email "${GIT_EMAIL}"`, { encoding: 'utf-8' })
  execSync(`git config --global user.name "${GIT_NAME}"`, { encoding: 'utf-8' })
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
    console.log('=== CONFLICT: Merge failed ===')
    gitExec(['merge', '--abort'])
    return false
  }
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

  // First, try to find branches that match by date prefix AND include issue number
  // This prevents picking up the wrong branch when multiple issues use the same date
  const issueNumber = process.env.ISSUE_NUMBER
  if (issueNumber) {
    for (const prefix of BRANCH_PREFIXES) {
      const pattern = `${prefix}/${datePrefix}-`
      const matches = branches.filter((b) => b.startsWith(pattern))
      // If there's a branch that includes the issue number, use it
      const issueMatch = matches.find((b) => b.includes(issueNumber))
      if (issueMatch) return issueMatch
    }
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
 * Main entry point
 */
function main(): void {
  const taskId = process.env.TASK_ID

  if (!taskId) {
    console.error('TASK_ID not set!')
    process.exit(1)
  }

  // Configure git identity
  configureGitIdentity()

  // Fetch latest
  fetchOrigin()

  // Get default branch
  const defaultBranch = getDefaultBranch()
  console.log(`=== Default branch: ${defaultBranch} ===`)

  // Find feature branch by pattern matching
  const branch = findRemoteBranch(taskId)

  if (branch) {
    console.log(`=== Found feature branch: ${branch} ===`)

    checkoutAndPull(branch)

    console.log(`=== Merging latest ${defaultBranch} into ${branch} ===`)

    if (!mergeDefaultBranch(defaultBranch)) {
      console.log('=== Aborting merge ===')
      process.exit(1)
    }

    process.exit(0)
  }

  console.log(`=== No feature branch found for ${taskId}, staying on default branch ===`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
