/**
 * @fileType utility
 * @domain ci | cody | git
 * @pattern branch-management
 * @ai-summary Git utilities for feature branch creation in Cody scripts
 */

import { execSync } from 'child_process'

// ============================================================================
// Types
// ============================================================================

export type TaskType =
  | 'spec_only'
  | 'implement_feature'
  | 'fix_bug'
  | 'refactor'
  | 'docs'
  | 'ops'
  | 'research'

// ============================================================================
// Branch Prefix Map
// ============================================================================

export const BRANCH_PREFIX_MAP: Record<TaskType, string> = {
  spec_only: 'feat',
  implement_feature: 'feat',
  fix_bug: 'fix',
  refactor: 'refactor',
  docs: 'docs',
  ops: 'chore',
  research: 'feat',
}

/** Well-known base branches — if the current branch is one of these, create a feature branch */
const BASE_BRANCHES = ['dev', 'main', 'master', '']

// ============================================================================
// Functions
// ============================================================================

/**
 * Detect the default branch of the remote repository.
 * Uses `git remote show origin` to find the HEAD branch.
 * Falls back to 'dev' if detection fails (common for this project).
 */
export function getDefaultBranch(cwd: string = process.cwd()): string {
  try {
    // Use symbolic-ref which is faster and more reliable than parsing `git remote show origin`
    const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
    // ref is like "refs/remotes/origin/dev" — extract the branch name
    const branch = ref.replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch {
    // symbolic-ref may fail if HEAD ref hasn't been set
  }

  try {
    // Fallback: parse `git remote show origin` output
    const output = execSync('git remote show origin', {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10_000,
    })
    const match = output.match(/HEAD branch:\s*(\S+)/)
    if (match?.[1]) return match[1]
  } catch {
    // Remote may be unreachable
  }

  return 'dev'
}

/**
 * Creates a feature branch before the build stage if needed.
 * This ensures the branch follows project conventions: fix/260218-description
 *
 * @param taskId - The task ID (e.g., "260218-user-metrics")
 * @param taskType - The task type (e.g., "fix_bug", "implement_feature")
 * @param projectDir - Optional project directory (defaults to cwd)
 */
export function ensureFeatureBranch(taskId: string, taskType: string, projectDir?: string): void {
  const cwd = projectDir || process.cwd()

  const currentBranch = execSync('git branch --show-current', {
    cwd,
    encoding: 'utf-8',
  }).trim()

  // Already on a feature branch - don't recreate
  if (!BASE_BRANCHES.includes(currentBranch)) {
    console.log(`[branch] Already on feature branch: ${currentBranch}`)
    return
  }

  const prefix = BRANCH_PREFIX_MAP[taskType as TaskType] || 'feat'
  const branchName = `${prefix}/${taskId}`

  console.log(`[branch] Ensuring feature branch: ${branchName}`)

  // Fetch latest from origin
  execSync('git fetch origin', { cwd, stdio: 'inherit' })

  // Check if branch already exists on remote
  let remoteBranchExists = false
  try {
    execSync(`git rev-parse --verify origin/${branchName}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    remoteBranchExists = true
  } catch {
    remoteBranchExists = false
  }

  if (remoteBranchExists) {
    // Branch exists on remote — checkout and track it
    console.log(`[branch] Remote branch exists, checking out: ${branchName}`)
    // Clean dirty state from previous failed runs before switching
    // Only run destructive clean in CI — in local mode, abort if working tree is dirty
    if (process.env.GITHUB_ACTIONS) {
      try {
        execSync('git checkout -- .', { cwd, stdio: 'pipe' })
        execSync('git clean -fd', { cwd, stdio: 'pipe' })
      } catch {
        // Ignore — working tree may already be clean
      }
    } else {
      // Local mode: check for uncommitted changes and warn
      try {
        const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim()
        if (status) {
          console.warn('[branch] ⚠ Working tree has uncommitted changes — stashing before checkout')
          execSync('git stash --include-untracked', { cwd, stdio: 'pipe' })
        }
      } catch {
        // Ignore status check errors
      }
    }
    execSync(`git checkout ${branchName}`, { cwd, stdio: 'inherit' })
    execSync(`git pull origin ${branchName}`, { cwd, stdio: 'inherit' })
    console.log(`[branch] Checked out and pulled: ${branchName}`)
  } else {
    // Branch doesn't exist — create from the default branch
    const defaultBranch = getDefaultBranch(cwd)
    console.log(`[branch] Creating new branch from ${defaultBranch}: ${branchName}`)
    execSync(`git checkout ${defaultBranch}`, { cwd, stdio: 'inherit' })
    execSync(`git pull origin ${defaultBranch}`, { cwd, stdio: 'inherit' })
    execSync(`git checkout -b ${branchName}`, { cwd, stdio: 'inherit' })
    console.log(`[branch] Created and switched to: ${branchName}`)
  }
}
