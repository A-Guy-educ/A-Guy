/**
 * @fileType utility
 * @domain cody
 * @pattern github-client
 * @ai-summary GitHub API client with caching and manual rate limit handling
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from '@octokit/rest'
import {
  GITHUB_OWNER,
  GITHUB_REPO,
  WORKFLOW_ID,
  BRANCH_PREFIXES,
  CACHE_TTL,
  TASK_ID_REGEX,
} from './constants'
import type {
  CodyPipelineStatus,
  GitHubIssue,
  GitHubComment,
  WorkflowRun,
  GitHubPR,
  GitHubCollaborator,
  CheckRunResult,
  PRComment,
  FileChange,
  TaskDocument,
} from './types'

// ============ Types ============

interface CacheEntry<T> {
  data: T
  expires: number
  etag?: string // ETag from GitHub for conditional requests
  lastModified?: string // Last-Modified header
}

// ============ Cache ============

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) {
    return entry.data as T
  }
  cache.delete(key)
  return null
}

/**
 * Get cached data along with its ETag for conditional requests
 */
function setCache<T>(
  key: string,
  ttl: number,
  data: T,
  options?: { etag?: string; lastModified?: string },
): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
    etag: options?.etag,
    lastModified: options?.lastModified,
  })
}

// ============ Octokit Singleton ============

let octokitInstance: Octokit | null = null

function getOctokit(): Octokit {
  if (octokitInstance) {
    return octokitInstance
  }

  // Prefer CODY_BOT_TOKEN if set (for bot attribution), otherwise fall back to GITHUB_TOKEN
  const token = process.env.CODY_BOT_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured')
  }

  // Create Octokit instance - rate limiting handled manually in API routes
  octokitInstance = new Octokit({
    auth: token,
  })

  return octokitInstance
}

// ============ Branch Discovery ============

/**
 * Find the branch for a task by trying all possible prefixes
 */
export async function findTaskBranch(taskId: string): Promise<string | null> {
  if (!TASK_ID_REGEX.test(taskId)) {
    return null
  }

  const octokit = getOctokit()

  // Try all prefixes in parallel
  const results = await Promise.allSettled(
    BRANCH_PREFIXES.map(async (prefix) => {
      const branchName = `${prefix}/${taskId}`
      try {
        await octokit.repos.getBranch({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          branch: branchName,
        })
        return branchName
      } catch {
        return null
      }
    }),
  )

  // Return first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value
    }
  }

  return null
}

/**
 * Find a branch by issue number.
 * The pipeline convention includes the issue number in the branch name:
 *   {prefix}/{YYMMDD}-auto-{issueNumber}-{sanitized-title}
 * We search across all known prefixes using the matching-refs API.
 */
export async function findBranchByIssueNumber(
  issueNumber: string | number,
): Promise<string | null> {
  const cacheKey = `branch:issue:${issueNumber}`
  const cached = getCached<string>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()
  const issueStr = String(issueNumber)

  // Search each prefix in parallel using the matching-refs API
  const results = await Promise.allSettled(
    BRANCH_PREFIXES.map(async (prefix) => {
      try {
        const { data } = await octokit.git.listMatchingRefs({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          ref: `heads/${prefix}/`,
        })

        // Find branches containing -<issueNumber>- in their name
        // e.g., fix/260228-auto-635-fix-conversation-delete-endpoint-b
        const pattern = new RegExp(`-${issueStr}-`)
        const match = data.find((ref: any) => {
          const branchName = ref.ref.replace('refs/heads/', '')
          return pattern.test(branchName)
        })

        return match ? match.ref.replace('refs/heads/', '') : null
      } catch {
        return null
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      setCache(cacheKey, CACHE_TTL.pipeline, result.value)
      return result.value
    }
  }

  return null
}

// ============ Status JSON Access ============

/**
 * Read status.json from a branch
 */
export async function getStatusFromBranch(
  taskId: string,
  branch: string,
): Promise<CodyPipelineStatus | null> {
  const cacheKey = `status:branch:${taskId}:${branch}`
  const cached = getCached<CodyPipelineStatus>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: `.tasks/${taskId}/status.json`,
      ref: branch,
    })

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const status = JSON.parse(content) as CodyPipelineStatus
      setCache(cacheKey, CACHE_TTL.pipeline, status)
      return status
    }
  } catch (error: any) {
    if (error.status !== 404) {
      console.error('[Cody] Error fetching status from branch:', error)
    }
  }

  return null
}

/**
 * Read status.json from an artifact
 */
export async function getStatusFromArtifact(
  taskId: string,
  runId: string,
): Promise<CodyPipelineStatus | null> {
  const cacheKey = `status:artifact:${taskId}:${runId}`
  const cached = getCached<CodyPipelineStatus>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    // Find artifact
    const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      run_id: parseInt(runId),
    })

    const artifact = artifacts.artifacts.find(
      (a: { name: string }) => a.name === `cody-${taskId}-${runId}`,
    )

    if (!artifact) {
      return null
    }

    // Download artifact
    await octokit.actions.downloadArtifact({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      artifact_id: artifact.id,
      archive_format: 'zipball',
    })

    // Note: In a real implementation, we'd need to extract the zip and parse status.json
    // For now, return null as this requires additional handling
    console.log('[Cody] Artifact download not fully implemented')
    return null
  } catch (error: any) {
    if (error.status !== 404) {
      console.error('[Cody] Error fetching status from artifact:', error)
    }
  }

  return null
}

// ============ Issue & Comment Fetching ============

/**
 * Fetch a single issue by number (optimized for detail view)
 */
export async function fetchIssue(issueNumber: number): Promise<GitHubIssue | null> {
  const cacheKey = `issue:${issueNumber}`
  const cached = getCached<GitHubIssue>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    const { data } = await octokit.issues.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      issue_number: issueNumber,
    })

    const issue: GitHubIssue = {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state as 'open' | 'closed',
      labels: data.labels.map((l: any) =>
        typeof l === 'string'
          ? { name: l, color: '000000' }
          : { name: l.name ?? '', color: l.color ?? '000000' },
      ),
      milestone: data.milestone ? { title: data.milestone.title ?? '' } : null,
      assignees:
        data.assignees?.map((a: any) => ({
          login: a.login ?? '',
          avatar_url: a.avatar_url ?? '',
        })) ?? [],
      created_at: data.created_at ?? '',
      updated_at: data.updated_at ?? '',
      closed_at: data.closed_at ?? null,
      html_url: data.html_url ?? '',
      isCodyAssigned:
        data.assignees?.some(
          (a: any) =>
            a.login === 'github-actions[bot]' || a.login === 'Copilot' || (a as any).type === 'Bot',
        ) ?? false,
    }

    // Single issue, cache for longer
    setCache(cacheKey, CACHE_TTL.tasks, issue)
    return issue
  } catch (error: any) {
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Fetch issues with optional filters
 */
export async function fetchIssues(options?: {
  state?: 'open' | 'closed' | 'all'
  labels?: string
  milestone?: number
  perPage?: number
  since?: string // ISO 8601 date string - only returns issues updated after this date
}): Promise<GitHubIssue[]> {
  const cacheKey = `issues:${JSON.stringify(options)}`
  const cached = getCached<GitHubIssue[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.issues.listForRepo({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    state: options?.state || 'open',
    labels: options?.labels,
    milestone: options?.milestone ? String(options.milestone) : undefined,
    per_page: options?.perPage || 50,
    sort: 'updated',
    direction: 'desc',
    since: options?.since as any, // Octokit accepts ISO string
  })

  // Filter out pull requests — GitHub issues API returns both issues and PRs
  const issues: GitHubIssue[] = data
    .filter((issue: any) => !issue.pull_request)
    .map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state as 'open' | 'closed',
      labels: issue.labels.map((l: any) =>
        typeof l === 'string'
          ? { name: l, color: '000000' }
          : { name: l.name ?? '', color: l.color ?? '000000' },
      ),
      milestone: issue.milestone ? { title: issue.milestone.title ?? '' } : null,
      assignees:
        issue.assignees?.map((a: any) => ({
          login: a.login ?? '',
          avatar_url: a.avatar_url ?? '',
        })) ?? [],
      created_at: issue.created_at ?? '',
      updated_at: issue.updated_at ?? '',
      closed_at: issue.closed_at ?? null,
      html_url: issue.html_url ?? '',
      isCodyAssigned:
        issue.assignees?.some(
          (a: any) =>
            a.login === 'github-actions[bot]' || a.login === 'Copilot' || a.type === 'Bot',
        ) ?? false,
    }))

  setCache(cacheKey, CACHE_TTL.tasks, issues)
  return issues
}

/**
 * Fetch comments for an issue
 */
export async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
  const cacheKey = `comments:${issueNumber}`
  const cached = getCached<GitHubComment[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.issues.listComments({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    per_page: 100,
  })

  const comments: GitHubComment[] = data.map((comment: any) => ({
    id: comment.id,
    body: comment.body ?? '',
    created_at: comment.created_at ?? '',
    user: {
      login: comment.user?.login ?? 'unknown',
      type: comment.user?.type ?? 'User',
      avatar_url: comment.user?.avatar_url ?? '',
    },
  }))

  // Comments are less likely to change, cache longer
  setCache(cacheKey, CACHE_TTL.tasks * 2, comments)
  return comments
}

// ============ Workflow Runs ============

/**
 * Fetch workflow runs for the Cody workflow
 */
export async function fetchWorkflowRuns(options?: {
  status?: 'queued' | 'in_progress' | 'completed'
  perPage?: number
}): Promise<WorkflowRun[]> {
  const cacheKey = `workflows:${JSON.stringify(options)}`
  const cached = getCached<WorkflowRun[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.actions.listWorkflowRuns({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    workflow_id: WORKFLOW_ID,
    status: options?.status,
    per_page: options?.perPage || 20,
  })

  const runs: WorkflowRun[] = data.workflow_runs.map((run) => ({
    id: run.id,
    status: run.status as 'queued' | 'in_progress' | 'completed',
    conclusion: run.conclusion,
    created_at: run.created_at,
    updated_at: run.updated_at,
    html_url: run.html_url,
    display_title: (run as any).display_title ?? '',
  }))

  setCache(cacheKey, CACHE_TTL.pipeline, runs)
  return runs
}

/**
 * Get workflow run for a specific task
 */
export async function getWorkflowRunForTask(taskId: string): Promise<WorkflowRun | null> {
  const runs = await fetchWorkflowRuns({ perPage: 50 })
  // Look for run with the task ID in the head_branch or workflow run name
  return (
    runs.find((run) => run.html_url.includes(taskId) || taskId.includes(run.id.toString())) || null
  )
}

/**
 * Fetch check runs (lint, test, typecheck, etc.) for a workflow run
 */
export async function fetchCheckRunsForRun(runId: number): Promise<CheckRunResult[]> {
  const cacheKey = `check-runs:${runId}`
  const cached = getCached<CheckRunResult[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    // Get jobs for the workflow run - these contain lint, test, typecheck results
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      run_id: runId,
      per_page: 50,
    })

    const checkRuns: CheckRunResult[] = (data.jobs as any[]).map((job) => ({
      name: job.name,
      status: job.status as 'queued' | 'in_progress' | 'completed',
      conclusion: job.conclusion as CheckRunResult['conclusion'],
      output: job.steps
        ? {
            summary: `${job.steps.length} steps`,
            text: JSON.stringify(
              job.steps.map((s: any) => ({
                name: s.name,
                status: s.status,
                conclusion: s.conclusion,
              })),
            ),
          }
        : undefined,
      html_url: job.html_url || undefined,
    }))

    setCache(cacheKey, CACHE_TTL.pipeline, checkRuns)
    return checkRuns
  } catch (error) {
    console.error('[Cody] Error fetching check runs:', error)
    return []
  }
}

// ============ Bulk PR Fetch ============

/**
 * Fetch all open PRs in one call (cheap: single API request).
 * Used by the dashboard to match PRs to issues without N per-issue calls.
 */
export async function fetchOpenPRs(): Promise<GitHubPR[]> {
  const cacheKey = 'open-prs'
  const cached = getCached<GitHubPR[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.pulls.list({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    state: 'open',
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  })

  const prs: GitHubPR[] = data.map((pr) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    head: {
      ref: pr.head.ref,
      sha: pr.head.sha,
    },
    merged_at: pr.merged_at,
    html_url: pr.html_url,
  }))

  setCache(cacheKey, CACHE_TTL.prs, prs)
  return prs
}

// ============ Vercel Preview URLs ============

/**
 * Fetch Vercel preview URLs for a set of PR head SHAs.
 * Strategy: 1 bulk call for recent deployments, then 1 status call per matched deployment.
 * Returns a Map of SHA -> preview URL.
 */
export async function fetchDeploymentPreviews(prShas: string[]): Promise<Map<string, string>> {
  if (prShas.length === 0) return new Map()

  const cacheKey = `previews:${prShas.sort().join(',')}`
  const cached = getCached<Map<string, string>>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()
  const result = new Map<string, string>()

  try {
    // 1. Bulk fetch recent Preview deployments (1 API call)
    const { data: deployments } = await octokit.repos.listDeployments({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      environment: 'Preview',
      per_page: 30,
    })

    // 2. Match deployments to our PR SHAs
    const shaSet = new Set(prShas)
    const matched = deployments.filter((d) => shaSet.has(d.sha))

    // 3. Fetch status for each matched deployment (1 call per match, typically 1-3)
    await Promise.all(
      matched.map(async (deployment) => {
        try {
          const { data: statuses } = await octokit.repos.listDeploymentStatuses({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            deployment_id: deployment.id,
            per_page: 1,
          })
          if (statuses.length > 0 && statuses[0].environment_url) {
            result.set(deployment.sha, statuses[0].environment_url)
          }
        } catch {
          // Skip individual failures
        }
      }),
    )
  } catch (error) {
    console.error('[Cody] Error fetching deployment previews:', error)
  }

  // Cache for 2 minutes (deployments don't change often)
  setCache(cacheKey, CACHE_TTL.prs, result)
  return result
}

// ============ PR Discovery ============

/**
 * Find PR associated with a task by branch name
 */
export async function findAssociatedPR(taskId: string): Promise<GitHubPR | null> {
  const cacheKey = `pr:${taskId}`
  const cached = getCached<GitHubPR | null>(cacheKey)
  if (cached !== null) return cached

  const octokit = getOctokit()

  // Try all branch prefixes
  const branchNames = BRANCH_PREFIXES.map((prefix) => `${prefix}/${taskId}`)

  for (const branchName of branchNames) {
    try {
      const { data } = await octokit.pulls.list({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        head: `${GITHUB_OWNER}:${branchName}`,
        state: 'open',
      })

      if (data.length > 0) {
        const pr: GitHubPR = {
          id: data[0].id,
          number: data[0].number,
          title: data[0].title,
          state: data[0].state,
          head: {
            ref: data[0].head.ref,
            sha: data[0].head.sha,
          },
          merged_at: data[0].merged_at,
          html_url: data[0].html_url,
        }
        setCache(cacheKey, CACHE_TTL.prs, pr)
        return pr
      }
    } catch {
      // Try next prefix
    }
  }

  // Cache null as well
  setCache(cacheKey, CACHE_TTL.prs, null)
  return null
}

/**
 * Fetch comments for a PR
 */
export async function fetchPRComments(prNumber: number): Promise<PRComment[]> {
  const cacheKey = `pr-comments:${prNumber}`
  const cached = getCached<PRComment[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    const { data } = await octokit.issues.listComments({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      issue_number: prNumber,
      per_page: 50,
    })

    const comments: PRComment[] = data.map((comment) => ({
      id: comment.id,
      body: comment.body || '',
      created_at: comment.created_at,
      user: {
        login: comment.user?.login || '',
        avatar_url: comment.user?.avatar_url || '',
      },
    }))

    setCache(cacheKey, CACHE_TTL.tasks, comments)
    return comments
  } catch (error) {
    console.error('[Cody] Error fetching PR comments:', error)
    return []
  }
}

/**
 * Fetch file changes for a PR
 */
export async function fetchPRFileChanges(prNumber: number): Promise<FileChange[]> {
  const cacheKey = `pr-files:${prNumber}`
  const cached = getCached<FileChange[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    const { data } = await octokit.pulls.listFiles({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: prNumber,
      per_page: 100,
    })

    const changes: FileChange[] = data.map((file) => ({
      filename: file.filename,
      status: file.status as FileChange['status'],
      additions: file.additions,
      deletions: file.deletions,
    }))

    setCache(cacheKey, CACHE_TTL.tasks, changes)
    return changes
  } catch (error) {
    console.error('[Cody] Error fetching PR files:', error)
    return []
  }
}

/**
 * Close a PR (without merging)
 */
export async function closePR(prNumber: number): Promise<void> {
  const octokit = getOctokit()

  await octokit.pulls.update({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    pull_number: prNumber,
    state: 'closed',
  })

  // Invalidate PR cache
  cache.clear()
}

/**
 * Delete a branch
 */
export async function deleteBranch(branchName: string): Promise<void> {
  // Don't delete protected branches
  if (branchName === 'dev' || branchName === 'main' || branchName === 'master') {
    console.log(`[Cody] Skipping deletion of protected branch: ${branchName}`)
    return
  }

  const octokit = getOctokit()

  try {
    await octokit.git.deleteRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: `heads/${branchName}`,
    })
    console.log(`[Cody] Deleted branch: ${branchName}`)
  } catch (error: any) {
    // Ignore if branch doesn't exist
    if (error.status === 422 && error.message?.includes('Reference does not exist')) {
      console.log(`[Cody] Branch already deleted: ${branchName}`)
      return
    }
    throw error
  }

  // Invalidate cache
  cache.clear()
}

/**
 * Fetch all task documents from branch by listing the task directory.
 * Discovers files dynamically instead of using a hardcoded list.
 */
export async function fetchTaskDocuments(taskId: string, branch: string): Promise<TaskDocument[]> {
  const octokit = getOctokit()
  const taskPath = `.tasks/${taskId}`

  try {
    // List all files in the task directory
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: taskPath,
      ref: branch,
    })

    if (!Array.isArray(data)) return []

    // Filter to files only (skip subdirectories), fetch content in parallel
    const files = data.filter((item: any) => item.type === 'file')

    const results = await Promise.allSettled(
      files.map(async (file: any) => {
        try {
          const { data: fileData } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: file.path,
            ref: branch,
          })

          if ('content' in fileData && fileData.content) {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
            return {
              name: file.name as string,
              content,
              path: file.path as string,
            }
          }
        } catch {
          // File content couldn't be fetched
        }
        return null
      }),
    )

    const documents: TaskDocument[] = []
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        documents.push(result.value)
      }
    }

    return documents
  } catch {
    // Task directory doesn't exist on this branch
    return []
  }
}

/**
 * Fetch task documents by discovering the task directory on a branch.
 * Lists .tasks/ dir, finds dirs matching YYMMDD- pattern, picks the newest,
 * then fetches known doc files from it.
 */
export async function fetchBranchDocuments(branch: string): Promise<TaskDocument[]> {
  const octokit = getOctokit()

  try {
    // 1. List .tasks/ directory on the branch
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: '.tasks',
      ref: branch,
    })

    if (!Array.isArray(data)) return []

    // 2. Find directories matching YYMMDD- pattern (e.g., 260228-auto-74)
    const taskDirs = data
      .filter((item: any) => item.type === 'dir' && /^\d{6}-/.test(item.name))
      .map((item: any) => item.name)
      .sort()
      .reverse() // newest first by date prefix

    if (taskDirs.length === 0) return []

    // 3. Use the newest task dir
    const taskId = taskDirs[0]

    // 4. Fetch known doc files from it
    return fetchTaskDocuments(taskId, branch)
  } catch (error: any) {
    if (error.status !== 404) {
      console.error('[Cody] Error listing branch task dirs:', error)
    }
    return []
  }
}

// ============ Labels & Milestones ============

/**
 * Fetch all labels
 */
export async function fetchLabels(): Promise<Array<{ name: string; color: string }>> {
  const cacheKey = 'labels'
  const cached = getCached<Array<{ name: string; color: string }>>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.issues.listLabelsForRepo({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    per_page: 100,
  })

  const labels = data.map((label) => ({
    name: label.name,
    color: label.color,
  }))

  setCache(cacheKey, CACHE_TTL.boards, labels)
  return labels
}

/**
 * Fetch all milestones
 */
export async function fetchMilestones(): Promise<
  Array<{ id: number; title: string; number: number }>
> {
  const cacheKey = 'milestones'
  const cached = getCached<Array<{ id: number; title: string; number: number }>>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.issues.listMilestones({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    state: 'open',
    per_page: 50,
  })

  const milestones = data.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    number: milestone.number,
  }))

  setCache(cacheKey, CACHE_TTL.boards, milestones)
  return milestones
}

// ============ Actions ============

/**
 * Post a comment on an issue
 */
export async function postComment(issueNumber: number, body: string): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.createComment({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    body,
  })

  // Invalidate comment cache
  cache.delete(`comments:${issueNumber}`)
}

/**
 * Trigger workflow dispatch
 */
export async function triggerWorkflow(options: {
  taskId: string
  mode?: string
  fromStage?: string
  feedback?: string
}): Promise<void> {
  const octokit = getOctokit()

  await octokit.actions.createWorkflowDispatch({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    workflow_id: WORKFLOW_ID,
    ref: 'main',
    inputs: {
      task_id: options.taskId,
      mode: options.mode || 'full',
      from_stage: options.fromStage || '',
      feedback: options.feedback || '',
    },
  })
}

/**
 * Cancel a workflow run
 */
export async function cancelWorkflowRun(runId: number): Promise<void> {
  const octokit = getOctokit()

  await octokit.actions.cancelWorkflowRun({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    run_id: runId,
  })
}

// ============ Issue CRUD Operations ============

/**
 * Create a new GitHub issue
 */
export async function createIssue(options: {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}): Promise<GitHubIssue> {
  const octokit = getOctokit()

  const { data } = await octokit.issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title: options.title,
    body: options.body ?? '',
    labels: options.labels,
    assignees: options.assignees,
  })

  // Invalidate issues cache
  cache.clear()

  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    state: data.state as 'open' | 'closed',
    labels:
      data.labels?.map((l: any) => ({
        name: l.name ?? '',
        color: l.color ?? '000000',
      })) ?? [],
    milestone: data.milestone ? { title: data.milestone.title ?? '' } : null,
    assignees:
      data.assignees?.map((a: any) => ({
        login: a.login ?? '',
        avatar_url: a.avatar_url ?? '',
      })) ?? [],
    created_at: data.created_at ?? '',
    updated_at: data.updated_at ?? '',
    closed_at: data.closed_at ?? null,
    html_url: data.html_url ?? '',
  }
}

/**
 * Update an issue (close, reopen, change title/body)
 */
export async function updateIssue(
  issueNumber: number,
  options: {
    title?: string
    body?: string
    state?: 'open' | 'closed'
    labels?: string[]
    assignees?: string[]
  },
): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.update({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    title: options.title,
    body: options.body,
    state: options.state,
    labels: options.labels,
    assignees: options.assignees,
  })

  // Invalidate cache
  cache.clear()
  cache.delete(`comments:${issueNumber}`)
}

/**
 * Add assignees to an issue
 */
export async function addAssignees(issueNumber: number, assignees: string[]): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.addAssignees({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    assignees,
  })

  // Invalidate cache
  cache.clear()
}

/**
 * Remove assignees from an issue
 */
export async function removeAssignees(issueNumber: number, assignees: string[]): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.removeAssignees({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    assignees,
  })

  // Invalidate cache
  cache.clear()
}

/**
 * Add labels to an issue
 */
export async function addLabels(issueNumber: number, labels: string[]): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.addLabels({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    labels,
  })

  // Invalidate cache
  cache.clear()
}

/**
 * Remove a label from an issue
 */
export async function removeLabel(issueNumber: number, label: string): Promise<void> {
  const octokit = getOctokit()

  await octokit.issues.removeLabel({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    name: label,
  })

  // Invalidate cache
  cache.clear()
}

/**
 * Fetch repository collaborators (for assignee picker)
 */
export async function fetchCollaborators(): Promise<GitHubCollaborator[]> {
  const cacheKey = 'collaborators'
  const cached = getCached<GitHubCollaborator[]>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  const { data } = await octokit.repos.listCollaborators({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    per_page: 100,
  })

  const collaborators: GitHubCollaborator[] = data.map((user) => ({
    login: user.login ?? '',
    avatar_url: user.avatar_url ?? '',
  }))

  setCache(cacheKey, CACHE_TTL.boards, collaborators)
  return collaborators
}

// ============ Utility ============

/**
 * Clear all cache (for testing or manual refresh)
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  }
}

// ============ PR CI Status ============

/**
 * Fetch the combined CI status for a PR's head commit.
 * Uses the combined status API + check runs to determine overall state.
 */
export async function fetchPRCIStatus(
  prNumber: number,
): Promise<{ ciStatus: 'pending' | 'success' | 'failure' | 'running'; mergeable: boolean }> {
  const cacheKey = `pr-ci-status:${prNumber}`
  const cached = getCached<{
    ciStatus: 'pending' | 'success' | 'failure' | 'running'
    mergeable: boolean
  }>(cacheKey)
  if (cached) return cached

  const octokit = getOctokit()

  try {
    // 1. Get the PR to find head SHA and mergeable state
    const { data: pr } = await octokit.pulls.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: prNumber,
    })

    const sha = pr.head.sha
    const mergeable = pr.mergeable ?? false

    // 2. Get check runs for the head SHA
    const { data: checkRuns } = await octokit.checks.listForRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: sha,
    })

    // 3. Determine overall CI status
    let ciStatus: 'pending' | 'success' | 'failure' | 'running' = 'pending'

    if (checkRuns.total_count === 0) {
      ciStatus = 'pending'
    } else {
      const hasFailure = checkRuns.check_runs.some(
        (run) => run.conclusion === 'failure' || run.conclusion === 'timed_out',
      )
      const hasRunning = checkRuns.check_runs.some(
        (run) => run.status === 'in_progress' || run.status === 'queued',
      )
      const allSuccess = checkRuns.check_runs.every(
        (run) => run.conclusion === 'success' || run.conclusion === 'skipped',
      )

      if (hasFailure) {
        ciStatus = 'failure'
      } else if (hasRunning) {
        ciStatus = 'running'
      } else if (allSuccess) {
        ciStatus = 'success'
      }
    }

    const result = { ciStatus, mergeable: mergeable && ciStatus === 'success' }

    // Short cache — CI status changes frequently
    setCache(cacheKey, 30_000, result) // 30 seconds
    return result
  } catch (error) {
    console.error('[Cody] Error fetching PR CI status:', error)
    return { ciStatus: 'pending', mergeable: false }
  }
}
