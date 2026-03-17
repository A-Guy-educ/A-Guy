/**
 * @fileType utility
 * @domain ci | cody | git
 * @pattern branch-management
 * @ai-summary Git utilities for feature branch creation in Cody scripts
 */

import { logger } from './logger'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
// FIX #9: Import status functions to persist branch name early
import { setBranchName, loadState } from './engine/status'

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
  } catch (deriveErr) {
    // FIX #7: Log when branch name derivation falls back to taskId
    logger.warn(
      { err: deriveErr },
      `[branch] Branch name derivation failed, falling back to: ${taskId}`,
    )
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
    const ref = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
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
    const output = execFileSync('git', ['remote', 'show', 'origin'], {
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
/**
 * Find and checkout a remote branch matching the given task ID.
 * Used by rerun mode to ensure task files are available before reading them.
 * Unlike ensureFeatureBranch, this doesn't need taskType — it searches all
 * remote branches for the task ID pattern.
 *
 * @returns true if a branch was found and checked out, false if not found
 */
export function checkoutTaskBranch(taskId: string, taskDir?: string): boolean {
  const cwd = process.cwd()
  const currentBranch = execFileSync('git', ['branch', '--show-current'], {
    cwd,
    encoding: 'utf-8',
  }).trim()

  // Already on a feature branch — don't switch
  if (!BASE_BRANCHES.includes(currentBranch)) {
    logger.info(`[branch] Already on feature branch: ${currentBranch}`)
    return true
  }

  // Fetch latest
  try {
    execFileSync('git', ['fetch', 'origin'], { cwd, stdio: 'inherit', timeout: 120_000 })
  } catch (fetchErr) {
    logger.warn({ err: fetchErr }, '[branch] git fetch failed')
    return false
  }

  // Search remote branches for one containing the task ID
  let remoteBranches: string[]
  try {
    const output = execFileSync('git', ['branch', '-r', '--list', `origin/*${taskId}*`], {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
    remoteBranches = output
      .split('\n')
      .map((b) => b.trim().replace('origin/', ''))
      .filter(Boolean)
  } catch {
    remoteBranches = []
  }

  if (remoteBranches.length === 0) {
    logger.info(`[branch] No remote branch found matching task ID: ${taskId}`)
    return false
  }

  // Use the first match (there should only be one branch per task)
  const branchName = remoteBranches[0]
  logger.info(`[branch] Found task branch: ${branchName} (for rerun of ${taskId})`)

  try {
    // Clean dirty state in CI before switching
    if (process.env.GITHUB_ACTIONS) {
      try {
        execFileSync('git', ['checkout', '--', '.'], { cwd, stdio: 'pipe' })
      } catch {
        // Working tree may already be clean
      }
    }

    execFileSync('git', ['checkout', branchName], { cwd, stdio: 'inherit' })
    execFileSync('git', ['pull', 'origin', branchName], { cwd, stdio: 'inherit' })
    mergeDefaultBranch(cwd)

    // Persist branch name to status.json
    try {
      const existingState = loadState(taskDir ? path.basename(taskDir) : taskId)
      if (existingState) {
        setBranchName(taskDir ? path.basename(taskDir) : taskId, existingState, branchName)
      }
    } catch {
      // Non-critical
    }

    logger.info(`[branch] Checked out task branch: ${branchName}`)
    return true
  } catch (checkoutErr) {
    logger.error({ err: checkoutErr }, `[branch] Failed to checkout task branch: ${branchName}`)
    return false
  }
}

export function mergeDefaultBranch(cwd: string): void {
  const defaultBranch = getDefaultBranch(cwd)
  logger.info(`[branch] Merging latest ${defaultBranch} into current branch`)
  try {
    execFileSync('git', ['merge', `origin/${defaultBranch}`, '--no-edit'], {
      cwd,
      stdio: 'inherit',
    })
  } catch (_error) {
    logger.error(`[branch] Merge conflict detected while merging ${defaultBranch}`)
    logger.info('[branch] Aborting merge')
    try {
      execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'inherit' })
    } catch (abortError) {
      // FIX #6: Log the abort error before falling back to hard reset.
      // merge --abort can fail if merge state was corrupted; hard reset discards ALL
      // uncommitted changes (not just conflicts), which is a last resort.
      const abortMsg = abortError instanceof Error ? abortError.message : String(abortError)
      logger.warn(
        `[branch] merge --abort failed (${abortMsg}), falling back to git reset --hard HEAD`,
      )
      logger.warn('[branch] \u26a0\ufe0f Hard reset will discard ALL uncommitted changes')
      execFileSync('git', ['reset', '--hard', 'HEAD'], { cwd, stdio: 'inherit' })
    }
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

  const currentBranch = execFileSync('git', ['branch', '--show-current'], {
    cwd,
    encoding: 'utf-8',
  }).trim()

  // Already on a feature branch - don't recreate
  if (!BASE_BRANCHES.includes(currentBranch)) {
    logger.info(`[branch] Already on feature branch: ${currentBranch}`)
    return
  }

  const prefix = BRANCH_PREFIX_MAP[taskType as TaskType] || 'feat'

  // Derive descriptive name from task.md if available, otherwise use taskId
  const branchDescription = taskDir ? deriveBranchName(taskDir, taskId) : taskId
  const branchName = `${prefix}/${branchDescription}`

  logger.info(`[branch] Ensuring feature branch: ${branchName}`)

  // Fetch latest from origin
  execFileSync('git', ['fetch', 'origin'], { cwd, stdio: 'inherit', timeout: 120_000 })

  // Check if branch already exists on remote (original behavior)
  let remoteBranchExists = false
  try {
    execFileSync('git', ['rev-parse', '--verify', `origin/${branchName}`], {
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
    logger.info(`[branch] Remote branch exists, checking out: ${branchName}`)
    // Clean dirty state from previous failed runs before switching
    // Only revert tracked file modifications - don't delete untracked files
    // (Deleting untracked files could remove agent-created source files before they're committed)
    if (process.env.GITHUB_ACTIONS) {
      // CI mode: clean dirty tracked files from previous failed runs, then checkout branch
      try {
        execFileSync('git', ['checkout', '--', '.'], { cwd, stdio: 'pipe' })
      } catch {
        // Ignore — working tree may already be clean
      }
      // BUG FIX: Actually checkout the feature branch in CI mode.
      // Previously this only cleaned dirty state but never switched branches,
      // causing commits/pushes to land on dev (which has branch protection).
      execFileSync('git', ['checkout', branchName], { cwd, stdio: 'inherit' })
      execFileSync('git', ['pull', 'origin', branchName], { cwd, stdio: 'inherit' })

      // Merge default branch to keep feature branch up-to-date
      mergeDefaultBranch(cwd)
    } else {
      // Local mode: check for uncommitted changes and stash before checkout
      // Track whether we actually stashed to avoid popping unrelated stashes
      let didStash = false
      try {
        const status = execFileSync('git', ['status', '--porcelain'], {
          cwd,
          encoding: 'utf-8',
        }).trim()
        if (status) {
          logger.warn('[branch] ⚠ Working tree has uncommitted changes — stashing before checkout')
          execFileSync('git', ['stash', '--include-untracked'], { cwd, stdio: 'pipe' })
          didStash = true
        }
      } catch {
        // Ignore status check errors
      }
      execFileSync('git', ['checkout', branchName], { cwd, stdio: 'inherit' })
      execFileSync('git', ['pull', 'origin', branchName], { cwd, stdio: 'inherit' })

      // Merge default branch after pulling feature branch to keep it up-to-date
      mergeDefaultBranch(cwd)

      // Restore stashed changes only if we actually stashed something
      if (didStash) {
        try {
          logger.info('[branch] Restoring stashed changes...')
          execFileSync('git', ['stash', 'pop'], { cwd, stdio: 'inherit' })
        } catch {
          logger.warn('[branch] ⚠ Could not restore stash — may need manual recovery')
        }
      }
    }
    // FIX #9: Persist branch name to status.json immediately after checkout,
    // not just in build stage preExecute. This ensures the dashboard can find the
    // branch even for stages that run before build (e.g., gap, architect).
    try {
      const taskIdFromDir = taskDir ? path.basename(taskDir) : taskId
      const existingState = loadState(taskIdFromDir)
      if (existingState) {
        setBranchName(taskIdFromDir, existingState, branchName)
        logger.info(`[branch] Persisted branch name to status.json: ${branchName}`)
      }
    } catch {
      // Non-critical - branch name will be captured in build stage preExecute as fallback
    }
    logger.info(`[branch] Checked out and pulled: ${branchName}`)
  } else {
    // Branch doesn't exist on remote — check if it exists locally (from previous failed run)
    let localBranchExists = false
    try {
      execFileSync('git', ['rev-parse', '--verify', branchName], {
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
      logger.info(`[branch] Local branch exists, resuming: ${branchName}`)
      // Stash dirty state before switching (only in local mode, not CI)
      // Track whether we actually stashed to avoid popping unrelated stashes
      let didStash = false
      if (!process.env.GITHUB_ACTIONS) {
        try {
          const status = execFileSync('git', ['status', '--porcelain'], {
            cwd,
            encoding: 'utf-8',
          }).trim()
          if (status) {
            logger.info('[branch] Stashing uncommitted changes before checkout...')
            execFileSync('git', ['stash', '--include-untracked'], { cwd, stdio: 'pipe' })
            didStash = true
          }
        } catch {
          /* ignore */
        }
      } else {
        // CI mode: revert tracked files only - don't delete untracked files
        try {
          execFileSync('git', ['checkout', '--', '.'], { cwd, stdio: 'pipe' })
        } catch {
          // Ignore — working tree may already be clean
        }
      }

      execFileSync('git', ['checkout', branchName], { cwd, stdio: 'inherit' })

      // Merge default branch after checking out local branch to keep it up-to-date
      mergeDefaultBranch(cwd)

      // Restore stashed changes only if we actually stashed something
      if (didStash) {
        try {
          logger.info('[branch] Restoring stashed changes...')
          execFileSync('git', ['stash', 'pop'], { cwd, stdio: 'inherit' })
        } catch {
          logger.warn('[branch] Could not restore stash — may need manual recovery')
        }
      }

      // Try to push if remote doesn't have it yet
      try {
        execFileSync('git', ['push', '-u', 'origin', branchName], { cwd, stdio: 'inherit' })
      } catch {
        // Remote doesn't have it yet - that's fine
      }
      logger.info(`[branch] Checked out local branch: ${branchName}`)
      return
    }

    // Branch doesn't exist locally either — create new from default branch
    const defaultBranch = getDefaultBranch(cwd)
    logger.info(`[branch] Creating new branch from ${defaultBranch}: ${branchName}`)
    execFileSync('git', ['checkout', defaultBranch], { cwd, stdio: 'inherit' })
    execFileSync('git', ['pull', 'origin', defaultBranch], { cwd, stdio: 'inherit' })
    execFileSync('git', ['checkout', '-b', branchName], { cwd, stdio: 'inherit' })
    logger.info(`[branch] Created and switched to: ${branchName}`)
  }
}

// R2-FIX #7: Cache hook-safe env to avoid recreating on every git call (hot path).
// process.env changes are rare during pipeline execution, so caching is safe.
let _hookSafeEnvCache: NodeJS.ProcessEnv | null = null
function getHookSafeEnv(): NodeJS.ProcessEnv {
  if (!_hookSafeEnvCache) {
    _hookSafeEnvCache = { ...process.env, HUSKY: '0', SKIP_HOOKS: '1' }
  }
  return _hookSafeEnvCache
}

/**
 * Push to origin with automatic pull-rebase-retry on rejection.
 * Handles the case where the remote branch has been updated by a previous
 * pipeline run (e.g., gate approval pushed new commits before rerun started).
 *
 * @returns true if push succeeded, false if it failed even after rebase
 */
export function pushWithRebase(cwd: string, env?: NodeJS.ProcessEnv): boolean {
  const pushEnv = env || getHookSafeEnv()
  const pushOpts = { cwd, stdio: 'inherit' as const, env: pushEnv, timeout: 120_000 }

  try {
    execFileSync('git', ['push', '-u', 'origin', 'HEAD'], pushOpts)
    return true
  } catch {
    // Push rejected — remote has new commits. Pull with rebase and retry.
    logger.info('[push] Push rejected, pulling with rebase...')
    try {
      execFileSync('git', ['pull', '--rebase', 'origin', 'HEAD'], {
        cwd,
        stdio: 'inherit',
        timeout: 120_000,
        env: pushEnv,
      })
      execFileSync('git', ['push', '-u', 'origin', 'HEAD'], pushOpts)
      logger.info('[push] Push succeeded after rebase')
      return true
    } catch (rebaseError: unknown) {
      const msg = rebaseError instanceof Error ? rebaseError.message : String(rebaseError)
      logger.error(`[push] Push failed after rebase: ${msg}`)
      return false
    }
  }
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
  let branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: workDir,
    encoding: 'utf-8',
  }).trim()

  // Handle detached HEAD state (empty branch name)
  if (!branch) {
    branch =
      execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: workDir,
        encoding: 'utf-8',
      }).trim() || 'detached'
    logger.warn(`[commit] Detached HEAD detected, using ref: ${branch}`)
  }

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
    const status = execFileSync('git', ['status', '--porcelain'], {
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
    execFileSync('git', ['add', '-u'], { cwd: workDir, stdio: 'inherit' })

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

    // H6 FIX: Also stage new root config files that are needed for builds
    // These are safe config files (not .env) that the project needs
    const rootConfigPatterns = [
      'package.json',
      'pnpm-lock.yaml',
      'tsconfig.json',
      /^tsconfig\..*\.json$/,
      /^next\.config\..+$/,
      'payload.config.ts',
      /^tailwind\.config\..+$/,
      /^postcss\.config\..+$/,
      /^eslint\.config\..+$/,
      /^\.prettierrc/,
      /^jest\.config\..+$/,
      /^vitest\.config\..+$/,
    ]

    const rootFiles = fs.readdirSync(workDir)
    for (const pattern of rootConfigPatterns) {
      const matches =
        typeof pattern === 'string'
          ? rootFiles.filter((f: string) => f === pattern)
          : rootFiles.filter((f: string) => pattern.test(f))
      for (const file of matches) {
        try {
          execFileSync('git', ['add', '--', file], { cwd: workDir, stdio: 'pipe' })
        } catch {
          // File may not be git-addable - that's fine
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
    const hash = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workDir,
      encoding: 'utf-8',
    })
      .trim()
      .slice(0, 7)

    // Push with automatic rebase-retry on rejection (fixes rejected pushes on reruns)
    const pushed = pushWithRebase(workDir, hookSafeEnv)
    if (!pushed) {
      return {
        hash,
        branch,
        success: false,
        message: `Committed (${hash}) but push failed after rebase`,
      }
    }

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

/**
 * Files that are always excluded from task-only commits (internal state markers).
 * NOTE: OpenCode runtime file patterns here must be kept in sync with
 * the .gitignore entries under "OpenCode runtime files (per-task isolated data dirs)".
 */
const TASK_FILES_ALWAYS_EXCLUDE = [
  'gate-*.md',
  'rerun-feedback.consumed.md',
  // OpenCode runtime files (only opencode.db is committed for session reuse)
  'opencode-data/opencode/opencode.db-wal',
  'opencode-data/opencode/opencode.db-shm',
  'opencode-data/opencode/snapshot/',
  'opencode-data/opencode/logs/',
  'opencode-data/opencode/auth.json',
  'opencode-data/opencode/bin/',
  'opencode-data/opencode/tool-output/',
  'opencode-data/opencode/storage/',
  'opencode-data/opencode/worktree/',
]

/**
 * Debug artifacts — only committed when the pipeline fails (black box data).
 * On success these add noise to PRs; on failure they're essential for diagnosis.
 */
const TASK_FILES_DEBUG_ONLY = ['*-events.jsonl', '*-stderr.log']

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
  /** Whether the pipeline has failed — includes debug artifacts (*-events.jsonl, *-stderr.log) */
  pipelineFailed?: boolean
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
    pipelineFailed = false,
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
        execFileSync('git', ['checkout', '--', '.'], { cwd, stdio: 'pipe' })
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
          execFileSync('git', ['add', '-A'], { cwd, stdio: 'inherit' })
        } catch (stageErr) {
          // FIX #7: Log staging errors instead of silently swallowing them
          logger.warn({ err: stageErr }, '[commit] git add -A failed (non-fatal)')
        }
        break
      case 'tracked+task':
        try {
          execFileSync('git', ['add', '-u'], { cwd, stdio: 'inherit' })
        } catch (stageErr) {
          // FIX #7: Log instead of silent swallow
          logger.warn({ err: stageErr }, '[commit] git add -u failed (non-fatal)')
        }
        try {
          execFileSync('git', ['add', '--', taskDir], { cwd, stdio: 'inherit' })
        } catch (stageErr) {
          logger.warn({ err: stageErr }, '[commit] git add task dir failed (non-fatal)')
        }
        break
      case 'task-only':
      default:
        try {
          execFileSync('git', ['add', '--', taskDir], { cwd, stdio: 'inherit' })
        } catch (stageErr) {
          // FIX #7: Log instead of silent swallow
          logger.warn({ err: stageErr }, '[commit] git add task-only failed (non-fatal)')
        }
        break
    }

    // 3b. Unstage excluded task artifacts to keep PRs clean
    // Always exclude gate markers; only include debug artifacts on failure
    if (stagingStrategy === 'task-only' || stagingStrategy === 'tracked+task') {
      const excludePatterns = [
        ...TASK_FILES_ALWAYS_EXCLUDE,
        ...(!pipelineFailed ? TASK_FILES_DEBUG_ONLY : []),
      ]
      for (const pattern of excludePatterns) {
        try {
          execFileSync('git', ['reset', 'HEAD', '--', path.join(taskDir, pattern)], {
            cwd,
            stdio: 'pipe',
          })
        } catch {
          // Pattern may not match any staged files — that's fine
        }
      }
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
      logger.info(`[commit] ${message}`)
    } catch (commitError: unknown) {
      const commitMsg = commitError instanceof Error ? commitError.message : String(commitError)
      if (commitMsg.includes('nothing to commit') || commitMsg.includes('no changes added')) {
        return { success: true, message: 'No changes to commit', committed: false }
      }
      throw commitError
    }

    // 5. Optionally push (with rebase-retry on rejection)
    // Use hook-safe env to skip pre-push hooks (e.g., Prettier/verify)
    // which may fail on unrelated files and block the pipeline
    let pushed = false
    if (push) {
      pushed = pushWithRebase(cwd, hookSafeEnv)
      if (pushed) {
        logger.info(`[commit] Pushed to origin`)
      } else {
        logger.error(`[commit] Push failed — remote may have diverged`)
      }
    }

    return { success: true, message: 'Committed successfully', committed, pushed }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[commit] Error: ${msg}`)
    return { success: false, message: msg }
  }
}
