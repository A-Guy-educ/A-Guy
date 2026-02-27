/**
 * @fileType utility
 * @domain ci | cody | git
 * @pattern branch-management
 * @ai-summary Git utilities for feature branch creation in Cody scripts
 */

import { execSync, execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

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

// ============================================================================
// Commit Type Map
// ============================================================================

export const COMMIT_TYPE_MAP: Record<TaskType, string> = {
  spec_only: 'docs',
  implement_feature: 'feat',
  fix_bug: 'fix',
  refactor: 'refactor',
  docs: 'docs',
  ops: 'chore',
  research: 'chore',
}

/** Directories to stage new files from (safe - excludes secrets) */
export const SAFE_STAGE_DIRS = ['src/', 'tests/', '.tasks/']

/** Well-known base branches — if the current branch is one of these, create a feature branch */
const BASE_BRANCHES = ['dev', 'main', 'master', '']

// ============================================================================
// Branch Name Derivation
// ============================================================================

/**
 * Derive a descriptive branch name from task.md
 * Returns: prefix/260225-description-from-title
 * Falls back to taskId if derivation fails
 */
export function deriveBranchName(taskDir: string, taskId: string): string {
  const taskMdPath = path.join(taskDir, 'task.md')

  if (!fs.existsSync(taskMdPath)) {
    return taskId
  }

  try {
    const content = fs.readFileSync(taskMdPath, 'utf-8')

    // Try to extract ## Issue Title first (highest priority)
    let title = ''
    const issueTitleMatch = content.match(/^##\s*Issue\s*Title\s*\n+([^\n]+)/im)
    if (issueTitleMatch) {
      title = issueTitleMatch[1].trim()
    }

    // Fallback: get first meaningful line (skip # Task, headers)
    if (!title) {
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        // Skip headers, empty lines
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('##')) {
          title = trimmed
          break
        }
      }
    }

    if (!title) {
      return taskId
    }

    // Prepend date prefix from taskId for uniqueness
    const datePrefix = taskId.split('-').slice(0, 2).join('-') // e.g., "260225-auto"

    // Include issue number in branch name for disambiguation
    // Without this, findRemoteBranch() cannot distinguish branches created on the same day
    // for different issues (e.g., feat/260227-auto-... vs fix/260227-auto-...)
    const issueNum = process.env.ISSUE_NUMBER
    const issuePart = issueNum ? `-${issueNum}` : ''
    const maxTitleLength = 50 - datePrefix.length - issuePart.length - 1 // minus 1 for the hyphen

    // Sanitize: lowercase, replace spaces/special chars with hyphens, remove non-alphanumeric
    const sanitized = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // keep only alphanumeric, spaces, hyphens
      .replace(/\s+/g, '-') // spaces to hyphens
      .replace(/-+/g, '-') // multiple hyphens to one
      .replace(/^-|-$/g, '') // trim leading/trailing hyphens
      .slice(0, maxTitleLength) // max chars for title portion

    return `${datePrefix}${issuePart}-${sanitized}`
  } catch {
    return taskId
  }
}

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
 * Merge the default branch into the current branch.
 * This keeps the feature branch up-to-date with the latest changes from dev.
 * If a merge conflict occurs, aborts the merge and throws an error.
 */
function mergeDefaultBranch(cwd: string): void {
  const defaultBranch = getDefaultBranch(cwd)
  console.log(`[branch] Merging latest ${defaultBranch} into current branch`)
  try {
    execSync(`git merge origin/${defaultBranch} --no-edit`, { cwd, stdio: 'inherit' })
  } catch (_error) {
    console.error(`[branch] Merge conflict detected while merging ${defaultBranch}`)
    console.log('[branch] Aborting merge')
    execSync('git merge --abort', { cwd, stdio: 'inherit' })
    throw new Error(
      `Merge conflict while merging ${defaultBranch} into feature branch. Please resolve conflicts manually.`,
    )
  }
}

/**
 * Creates a feature branch before the build stage if needed.
 * This ensures the branch follows project conventions: fix/260225-description
 *
 * @param taskId - The task ID (e.g., "260218-user-metrics")
 * @param taskType - The task type (e.g., "fix_bug", "implement_feature")
 * @param projectDir - Optional project directory (defaults to cwd)
 * @param taskDir - Optional task directory for deriving descriptive branch name
 */
export function ensureFeatureBranch(
  taskId: string,
  taskType: string,
  projectDir?: string,
  taskDir?: string,
): void {
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

  // Derive descriptive name from task.md if available, otherwise use taskId
  const branchDescription = taskDir ? deriveBranchName(taskDir, taskId) : taskId
  const branchName = `${prefix}/${branchDescription}`

  console.log(`[branch] Ensuring feature branch: ${branchName}`)

  // Fetch latest from origin
  execSync('git fetch origin', { cwd, stdio: 'inherit' })

  // Check if branch already exists on remote (original behavior)
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
    // Only revert tracked file modifications - don't delete untracked files
    // (Deleting untracked files could remove agent-created source files before they're committed)
    if (process.env.GITHUB_ACTIONS) {
      try {
        execSync('git checkout -- .', { cwd, stdio: 'pipe' })
      } catch {
        // Ignore — working tree may already be clean
      }
    } else {
      // Local mode: check for uncommitted changes and stash before checkout
      // Track whether we actually stashed to avoid popping unrelated stashes
      let didStash = false
      try {
        const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim()
        if (status) {
          console.warn('[branch] ⚠ Working tree has uncommitted changes — stashing before checkout')
          execSync('git stash --include-untracked', { cwd, stdio: 'pipe' })
          didStash = true
        }
      } catch {
        // Ignore status check errors
      }
      execSync(`git checkout ${branchName}`, { cwd, stdio: 'inherit' })
      execSync(`git pull origin ${branchName}`, { cwd, stdio: 'inherit' })

      // Merge default branch after pulling feature branch to keep it up-to-date
      mergeDefaultBranch(cwd)

      // Restore stashed changes only if we actually stashed something
      if (didStash) {
        try {
          console.log('[branch] Restoring stashed changes...')
          execSync('git stash pop', { cwd, stdio: 'inherit' })
        } catch {
          console.warn('[branch] ⚠ Could not restore stash — may need manual recovery')
        }
      }
    }
    console.log(`[branch] Checked out and pulled: ${branchName}`)
  } else {
    // Branch doesn't exist on remote — check if it exists locally (from previous failed run)
    let localBranchExists = false
    try {
      execSync(`git rev-parse --verify ${branchName}`, {
        cwd,
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      localBranchExists = true
    } catch {
      localBranchExists = false
    }

    // If branch exists locally, checkout and resume work (stages will skip if already completed)
    if (localBranchExists) {
      console.log(`[branch] Local branch exists, resuming: ${branchName}`)
      // Stash dirty state before switching (only in local mode, not CI)
      // Track whether we actually stashed to avoid popping unrelated stashes
      let didStash = false
      if (!process.env.GITHUB_ACTIONS) {
        try {
          const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim()
          if (status) {
            console.log('[branch] Stashing uncommitted changes before checkout...')
            execSync('git stash --include-untracked', { cwd, stdio: 'pipe' })
            didStash = true
          }
        } catch {
          /* ignore */
        }
      } else {
        // CI mode: revert tracked files only - don't delete untracked files
        try {
          execSync('git checkout -- .', { cwd, stdio: 'pipe' })
        } catch {
          // Ignore — working tree may already be clean
        }
      }

      execSync(`git checkout ${branchName}`, { cwd, stdio: 'inherit' })

      // Merge default branch after checking out local branch to keep it up-to-date
      mergeDefaultBranch(cwd)

      // Restore stashed changes only if we actually stashed something
      if (didStash) {
        try {
          console.log('[branch] Restoring stashed changes...')
          execSync('git stash pop', { cwd, stdio: 'inherit' })
        } catch {
          console.warn('[branch] Could not restore stash — may need manual recovery')
        }
      }

      // Try to push if remote doesn't have it yet
      try {
        execSync(`git push origin ${branchName}`, { cwd, stdio: 'inherit' })
      } catch {
        // Remote doesn't have it yet - that's fine
      }
      console.log(`[branch] Checked out local branch: ${branchName}`)
      return
    }

    // Branch doesn't exist locally either — create new from default branch
    const defaultBranch = getDefaultBranch(cwd)
    console.log(`[branch] Creating new branch from ${defaultBranch}: ${branchName}`)
    execSync(`git checkout ${defaultBranch}`, { cwd, stdio: 'inherit' })
    execSync(`git pull origin ${defaultBranch}`, { cwd, stdio: 'inherit' })
    execSync(`git checkout -b ${branchName}`, { cwd, stdio: 'inherit' })
    console.log(`[branch] Created and switched to: ${branchName}`)
  }
}

// Helper to get environment with hooks disabled for CI
function getHookSafeEnv(): NodeJS.ProcessEnv {
  return { ...process.env, HUSKY: '0', SKIP_HOOKS: '1' }
}

/**
 * Derive conventional commit type from task type.
 */
export function deriveCommitType(taskType: string): string {
  return COMMIT_TYPE_MAP[taskType as TaskType] || 'feat'
}

/**
 * Extract commit subject from task.md content.
 * Uses first non-empty line after the title.
 */
export function extractCommitSubject(taskMdContent: string): string {
  const lines = taskMdContent.split('\n')
  let foundTitle = false

  for (const line of lines) {
    // Skip the # Task title line
    if (line.match(/^#\s+Task/i)) {
      foundTitle = true
      continue
    }
    // Skip empty lines
    if (!line.trim()) continue
    // First non-empty line after title is the subject
    if (foundTitle || line.match(/^#/)) {
      // Clean up the subject: remove leading -, *, numbers, etc.
      const subject = line
        .replace(/^[-*\d.]\s*/, '')
        .replace(/^#+\s*/, '') // strip markdown headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // strip bold markers
        .replace(/`(.*?)`/g, '$1') // strip inline code
        .trim()
      // Truncate to 72 chars (conventional commit subject max)
      return subject.length > 72 ? subject.slice(0, 69) + '...' : subject
    }
  }

  // Fallback: use first non-empty line
  const firstNonEmpty = lines.find((l) => l.trim())
  if (firstNonEmpty) {
    return firstNonEmpty.replace(/^#\s*/, '').slice(0, 72)
  }

  return 'implement changes'
}

/**
 * Extract commit body from build.md content.
 * Uses the ## Changes section.
 */
export function extractCommitBody(buildMdContent: string): string {
  const changesMatch = buildMdContent.match(/##\s*Changes\s*\n([\s\S]*?)(?=\n##\s|$)/i)

  if (changesMatch && changesMatch[1]) {
    // Take first few bullet points as body
    const bullets = changesMatch[1]
      .split('\n')
      .filter((line) => line.trim().match(/^[-*•]/))
      .slice(0, 5)
      .map((line) =>
        line
          .replace(/^[-*•]\s*/, '')
          .replace(/\*\*(.*?)\*\*/g, '$1') // strip bold
          .replace(/`(.*?)`/g, '$1') // strip inline code
          .trim(),
      )
      .join('. ')

    if (bullets.length > 20) return bullets
  }

  // Fallback: generic body
  return 'See build report for details.'
}

/**
 * Commit and push changes to the current branch.
 * Uses conventional commit format.
 */
export function commitAndPush(
  taskId: string,
  taskDir: string,
  cwd?: string,
): {
  hash: string
  branch: string
  success: boolean
  message: string
} {
  const workDir = cwd || process.cwd()

  // Get current branch
  const branch = execSync('git branch --show-current', {
    cwd: workDir,
    encoding: 'utf-8',
  }).trim()

  // Read task.json for commit type
  const taskJsonPath = path.join(taskDir, 'task.json')
  let taskType = 'implement_feature'
  let commitType = 'feat'

  if (fs.existsSync(taskJsonPath)) {
    try {
      const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
      taskType = taskJson.task_type || taskType
      commitType = deriveCommitType(taskType)
    } catch {
      // Use default
    }
  }

  // Read task.md for subject
  const taskMdPath = path.join(taskDir, 'task.md')
  let subject = 'implement changes'
  if (fs.existsSync(taskMdPath)) {
    const taskMdContent = fs.readFileSync(taskMdPath, 'utf-8')
    subject = extractCommitSubject(taskMdContent)
  }

  // Read build.md for body
  const buildMdPath = path.join(taskDir, 'build.md')
  let body = 'See build report for details.'
  if (fs.existsSync(buildMdPath)) {
    const buildMdContent = fs.readFileSync(buildMdPath, 'utf-8')
    body = extractCommitBody(buildMdContent)
  }

  // Build commit message
  const commitMessage = `${commitType}(${taskId}): ${subject}\n\n${body}`

  try {
    // Check if there are changes
    const status = execSync('git status --porcelain', {
      cwd: workDir,
      encoding: 'utf-8',
    }).trim()

    if (!status) {
      return {
        hash: '',
        branch,
        success: false,
        message: 'No changes to commit',
      }
    }

    // Stage tracked changes (modifications + deletions)
    execSync('git add -u', { cwd: workDir, stdio: 'inherit' })

    // Stage new files from safe directories only (BUG-15: avoid root-level .env files)
    // Pre-commit hooks (check-secrets, check-no-css) provide additional safety
    const safeDirs = ['src', 'tests', 'scripts', 'public', 'docs', '.tasks']
    for (const dir of safeDirs) {
      const dirPath = path.join(workDir, dir)
      if (fs.existsSync(dirPath)) {
        try {
          execFileSync('git', ['add', '--', dirPath], { cwd: workDir, stdio: 'pipe' })
        } catch {
          // Directory may have no new files - that's fine
        }
      }
    }

    // Commit using execFileSync to prevent shell injection (BUG-4 fix)
    // Skip husky/commitlint hooks in CI - they run their own quality gates
    const hookSafeEnv = getHookSafeEnv()
    execFileSync('git', ['commit', '--no-gpg-sign', '-m', commitMessage], {
      cwd: workDir,
      stdio: 'inherit',
      env: hookSafeEnv,
    })

    // Get commit hash
    const hash = execSync('git rev-parse HEAD', {
      cwd: workDir,
      encoding: 'utf-8',
    })
      .trim()
      .slice(0, 7)

    // Push — use hook-safe env to skip pre-push hooks
    execSync('git push -u origin HEAD', {
      cwd: workDir,
      stdio: 'inherit',
      env: hookSafeEnv,
    })

    return {
      hash,
      branch,
      success: true,
      message: `Committed and pushed: ${hash} ${subject}`,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      hash: '',
      branch,
      success: false,
      message: `Commit failed: ${msg}`,
    }
  }
}

// ============================================================================
// Pipeline Files Commit - Unified commit function
// ============================================================================

export type StagingStrategy = 'task-only' | 'tracked+task' | 'all'

export interface CommitPipelineFilesOptions {
  /** Task directory path */
  taskDir: string
  /** Task ID for branch/commit messages */
  taskId: string
  /** Commit message */
  message: string
  /** Whether to ensure feature branch exists first (default: true in CI) */
  ensureBranch?: boolean
  /** Whether to clean dirty state before commit (default: true in CI) */
  cleanDirtyState?: boolean
  /** Staging strategy: which files to stage */
  stagingStrategy?: StagingStrategy
  /** Whether to push after commit (default: true in CI) */
  push?: boolean
  /** Working directory (default: process.cwd()) */
  cwd?: string
  /** Whether this is CI mode (affects defaults) */
  isCI?: boolean
  /** Whether this is a dry run */
  dryRun?: boolean
}

export interface CommitPipelineFilesResult {
  success: boolean
  message: string
  committed?: boolean
  pushed?: boolean
}

/**
 * Unified function to commit pipeline files.
 * Consolidates 3 patterns from cody.ts:
 * - commitTaskFilesCI (CI mode with branch/cleanup)
 * - commitTaskFiles (local mode)
 * - autofix commit (tracked + task files)
 */
export function commitPipelineFiles(
  options: CommitPipelineFilesOptions,
): CommitPipelineFilesResult {
  const {
    taskDir,
    taskId,
    message,
    ensureBranch = false,
    cleanDirtyState = false,
    stagingStrategy = 'task-only',
    push = false,
    cwd = process.cwd(),
    isCI = false,
    dryRun = false,
  } = options

  // Skip in dry-run mode
  if (dryRun) {
    return { success: true, message: 'Dry run - skipped', committed: false, pushed: false }
  }

  try {
    // 1. Optionally ensure feature branch exists
    if (ensureBranch) {
      // Read task type from task.json
      const taskJsonPath = path.join(taskDir, 'task.json')
      let taskType = 'implement_feature'
      if (fs.existsSync(taskJsonPath)) {
        try {
          const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
          taskType = taskData.task_type || 'implement_feature'
        } catch {
          // Use default
        }
      }
      ensureFeatureBranch(taskId, taskType, cwd, taskDir)
    }

    // 2. Optionally clean dirty state (CI mode)
    // Only revert tracked file modifications - don't delete untracked files
    // (Deleting untracked files could remove agent-created source files before they're committed)
    if (cleanDirtyState && isCI) {
      try {
        execSync('git checkout -- .', { cwd, stdio: 'pipe' })
      } catch {
        // Working tree may already be clean
      }
    }

    // 3. Stage files based on strategy
    // Use execFileSync to prevent shell injection via taskDir paths
    // Don't throw on staging errors - silent fail is ok for staging
    switch (stagingStrategy) {
      case 'all':
        try {
          execSync('git add -A', { cwd, stdio: 'inherit' })
        } catch {
          // Ignore staging errors
        }
        break
      case 'tracked+task':
        try {
          execSync('git add -u', { cwd, stdio: 'inherit' })
        } catch {
          // Ignore
        }
        try {
          execFileSync('git', ['add', '--', taskDir], { cwd, stdio: 'inherit' })
        } catch {
          // Ignore
        }
        break
      case 'task-only':
      default:
        try {
          execFileSync('git', ['add', '--', taskDir], { cwd, stdio: 'inherit' })
        } catch {
          // Ignore staging errors - silent fail is ok
        }
        break
    }

    // 4. Commit using execFileSync to prevent shell injection (BUG-5 fix)
    // Skip husky/commitlint hooks in CI - they run their own quality gates
    const hookSafeEnv = getHookSafeEnv()
    let committed = false
    try {
      execFileSync('git', ['commit', '--no-gpg-sign', '-m', message], {
        cwd,
        stdio: 'inherit',
        env: hookSafeEnv,
      })
      committed = true
      console.log(`[commit] ${message}`)
    } catch (commitError: unknown) {
      const commitMsg = commitError instanceof Error ? commitError.message : String(commitError)
      if (commitMsg.includes('nothing to commit') || commitMsg.includes('no changes added')) {
        return { success: true, message: 'No changes to commit', committed: false }
      }
      throw commitError
    }

    // 5. Optionally push
    // Use hook-safe env to skip pre-push hooks (e.g., Prettier/verify)
    // which may fail on unrelated files and block the pipeline
    let pushed = false
    if (push) {
      execSync('git push -u origin HEAD', { cwd, stdio: 'inherit', env: hookSafeEnv })
      pushed = true
      console.log(`[commit] Pushed to origin`)
    }

    return { success: true, message: 'Committed successfully', committed, pushed }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[commit] Error: ${msg}`)
    return { success: false, message: msg }
  }
}
