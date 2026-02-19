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

const BASE_BRANCHES = ['dev', 'main', '']

// ============================================================================
// Functions
// ============================================================================

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
    execSync(`git checkout ${branchName}`, { cwd, stdio: 'inherit' })
    execSync(`git pull origin ${branchName}`, { cwd, stdio: 'inherit' })
    console.log(`[branch] Checked out and pulled: ${branchName}`)
  } else {
    // Branch doesn't exist — create from dev
    console.log(`[branch] Creating new branch from dev: ${branchName}`)
    execSync('git checkout dev', { cwd, stdio: 'inherit' })
    execSync('git pull origin dev', { cwd, stdio: 'inherit' })
    execSync(`git checkout -b ${branchName}`, { cwd, stdio: 'inherit' })
    console.log(`[branch] Created and switched to: ${branchName}`)
  }
}
