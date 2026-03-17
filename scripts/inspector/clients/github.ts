/**
 * @fileType utility
 * @domain inspector
 * @pattern github-client
 * @ai-summary Thin wrapper around gh CLI, conforming to GitHubClient interface
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'

import type { GitHubClient, IssueInfo, IssueComment, WorkflowRun } from '../core/types'

/**
 * Create a GitHub client wrapper around the gh CLI.
 */
export function createGitHubClient(repo: string, token: string, patToken?: string): GitHubClient {
  const gh = (args: string[], input?: string): string => {
    try {
      return execFileSync('gh', args, {
        input,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...process.env, GH_TOKEN: token },
      }).trim()
    } catch (_error) {
      // Many gh commands are fire-and-forget; return empty on failure
      return ''
    }
  }

  return {
    postComment(issueNumber: number, body: string): void {
      gh(['issue', 'comment', String(issueNumber), '--repo', repo, '--body-file', '-'], body)
    },

    getIssue(issueNumber: number): { body: string | null; title: string | null } {
      const output = gh([
        'api',
        `repos/${repo}/issues/${issueNumber}`,
        '--jq',
        '{body: .body, title: .title}',
      ])
      if (!output) return { body: null, title: null }
      try {
        return JSON.parse(output)
      } catch {
        return { body: null, title: null }
      }
    },

    getOpenIssues(labels?: string[]): IssueInfo[] {
      let query = `repos/${repo}/issues`
      if (labels && labels.length > 0) {
        query += `?labels=${labels.join(',')}`
      }

      const output = gh([
        'api',
        query,
        '--paginate',
        '--jq',
        // Exclude pull requests — GitHub /issues API returns both issues and PRs.
        '[.[] | select(.state == "open") | select(.pull_request == null) | {number: .number, title: .title, labels: [.labels[].name], updatedAt: .updated_at}]',
      ])

      if (!output) return []

      const arrays = output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as IssueInfo[]
          } catch {
            return [] as IssueInfo[]
          }
        })

      return arrays.flat()
    },

    triggerWorkflow(workflow: string, inputs: Record<string, string>): void {
      const args = ['workflow', 'run', workflow]
      for (const [key, value] of Object.entries(inputs)) {
        if (value) args.push('-f', `${key}=${value}`)
      }
      args.push(`--repo=${repo}`)

      const dispatchToken = patToken || token
      try {
        execFileSync('gh', args, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, GH_TOKEN: dispatchToken },
        })
      } catch (error) {
        const err = error as NodeJS.ErrnoException & { stderr?: string }
        const msg = err.stderr || err.message || String(error)
        throw new Error(`Workflow dispatch failed for ${workflow}: ${msg}`)
      }
    },

    addLabel(issueNumber: number, label: string): void {
      gh(['issue', 'edit', String(issueNumber), '--repo', repo, '--add-label', label])
    },

    removeLabel(issueNumber: number, label: string): void {
      gh(['issue', 'edit', String(issueNumber), '--repo', repo, '--remove-label', label])
    },

    setLifecycleLabel(issueNumber: number, label: string): void {
      const lifecycleLabels = [
        'cody:planning',
        'cody:building',
        'cody:review',
        'cody:done',
        'cody:failed',
      ]
      for (const lbl of lifecycleLabels) {
        this.removeLabel(issueNumber, lbl)
      }
      this.addLabel(issueNumber, label)
    },

    // FIX #16: Pass reason parameter
    closeIssue(issueNumber: number, reason = 'not planned'): void {
      gh(['issue', 'close', String(issueNumber), `--repo=${repo}`, '--reason', reason])
    },

    getIssueComments(issueNumber: number): IssueComment[] {
      const output = gh([
        'api',
        `repos/${repo}/issues/${issueNumber}/comments`,
        '--paginate',
        '--jq',
        '[.[] | {id: .id, body: .body, author: .user.login, createdAt: .created_at}]',
      ])

      if (!output) return []

      const arrays = output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as IssueComment[]
          } catch {
            return [] as IssueComment[]
          }
        })

      return arrays.flat()
    },

    listWorkflowRuns(
      workflow: string,
      opts: { per_page?: number; status?: string; branch?: string } = {},
    ): WorkflowRun[] {
      const perPage = opts.per_page ?? 30
      const statusFilter = opts.status ?? 'completed'
      let query = `repos/${repo}/actions/workflows/${workflow}/runs?per_page=${perPage}&status=${statusFilter}`
      if (opts.branch) query += `&branch=${encodeURIComponent(opts.branch)}`

      const output = gh([
        'api',
        query,
        '--jq',
        '[.workflow_runs[] | {id: .id, status: .status, conclusion: .conclusion, createdAt: .created_at, updatedAt: .updated_at, headBranch: .head_branch, event: .event}]',
      ])

      if (!output) return []
      try {
        return JSON.parse(output) as WorkflowRun[]
      } catch {
        return []
      }
    },

    // FIX #1: Create issue without --label, then add labels via edit.
    // gh issue create --label fails silently when the label doesn't exist.
    // gh issue edit --add-label creates the label if it doesn't exist.
    createIssue(title: string, body: string, labels: string[]): number | null {
      const args = ['issue', 'create', '--repo', repo, '--title', title, '--body-file', '-']
      const output = gh(args, body)
      if (!output) return null

      const match = output.match(/\/issues\/(\d+)/)
      const issueNumber = match ? parseInt(match[1], 10) : null

      // Add labels separately — this auto-creates labels that don't exist
      if (issueNumber && labels.length > 0) {
        this.addLabel(issueNumber, labels.join(','))
      }

      return issueNumber
    },

    searchIssues(query: string): IssueInfo[] {
      const output = gh([
        'api',
        `search/issues?q=${encodeURIComponent(query + ` repo:${repo}`)}&per_page=30`,
        '--jq',
        '[.items[] | {number: .number, title: .title, labels: [.labels[].name], updatedAt: .updated_at}]',
      ])

      if (!output) return []
      try {
        return JSON.parse(output) as IssueInfo[]
      } catch {
        return []
      }
    },
  }
}

/**
 * Read task files from the .tasks directory.
 */
export function readTaskFile(taskId: string, filename: string): string {
  const taskDir = getTaskDir(taskId)
  const filePath = `${taskDir}/${filename}`

  if (!fs.existsSync(filePath)) {
    return ''
  }

  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Get the task directory path.
 */
export function getTaskDir(taskId: string): string {
  return `${process.cwd()}/.tasks/${taskId}`
}
