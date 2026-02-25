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
 * Check if branch exists on origin
 */
function branchExistsOnOrigin(branch: string): boolean {
  const output = gitExecSilent(['rev-parse', '--verify', `origin/${branch}`])
  return !!output.trim()
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

  // Try each prefix
  for (const prefix of BRANCH_PREFIXES) {
    const branch = `${prefix}/${taskId}`

    if (branchExistsOnOrigin(branch)) {
      console.log(`=== Found feature branch: ${branch} ===`)

      checkoutAndPull(branch)

      console.log(`=== Merging latest ${defaultBranch} into ${branch} ===`)

      if (!mergeDefaultBranch(defaultBranch)) {
        console.log('=== Aborting merge ===')
        process.exit(1)
      }

      process.exit(0)
    }
  }

  console.log(`=== No feature branch found for ${taskId}, staying on default branch ===`)
}

// Run if called directly
if (require.main === module) {
  main()
}
