/**
 * @fileType utility
 * @domain inspector
 * @pattern github-client
 * @ai-summary Thin wrapper around github-api.ts, conforming to GitHubClient interface
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'

import type { GitHubClient, IssueInfo, IssueComment } from '../core/types'

/**
 * Create a GitHub client wrapper around scripts/cody/github-api.ts functions.
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
        '[.[] | select(.state == "open") | {number: .number, title: .title, labels: [.labels[].name], updatedAt: .updated_at}]',
      ])

      if (!output) return []

      // Handle paginated output (multiple JSON arrays concatenated)
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
        args.push('-f', `${key}=${value}`)
      }
      args.push(`--repo=${repo}`)

      // Workflow dispatch requires a PAT — github.token cannot trigger other workflows
      const dispatchToken = patToken || token
      execFileSync('gh', args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'inherit'],
        env: { ...process.env, GH_TOKEN: dispatchToken },
      })
    },

    addLabel(issueNumber: number, label: string): void {
      gh(['issue', 'add-label', String(issueNumber), '--repo', repo, label])
    },

    removeLabel(issueNumber: number, label: string): void {
      gh(['issue', 'remove-label', String(issueNumber), '--repo', repo, label])
    },

    setLifecycleLabel(issueNumber: number, label: string): void {
      // Remove any existing lifecycle labels, then add new one
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

    closeIssue(issueNumber: number, _reason = 'not planned'): void {
      gh(['issue', 'close', String(issueNumber), `--repo=${repo}`])
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

      // Handle paginated output
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
  }
}

/**
 * Read task files from the .tasks directory.
 * Uses the same logic as cody-utils.ts getTaskDir().
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
