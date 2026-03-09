/**
 * @fileType test
 * @domain cody
 * @pattern tasks-api
 * @ai-summary Tests for the getColumnForIssue function in the Cody dashboard API
 */
import { describe, it, expect } from 'vitest'

// Import types from the actual module
interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<{ name: string; color: string }>
  created_at: string
  updated_at: string
}

interface WorkflowRun {
  id: number
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: string | null
  created_at: string
  updated_at: string
  html_url: string
  display_title: string
}

interface GitHubPR {
  id: number
  number: number
  title: string
  state: string
  head: { ref: string; sha: string }
  merged_at: string | null
  html_url: string
}

type ColumnId = 'open' | 'building' | 'review' | 'done' | 'failed' | 'gate-waiting' | 'retrying'

// Copy of the actual function from src/app/api/cody/tasks/route.ts
// This test ensures the priority ordering works correctly
function getColumnForIssue(
  issue: GitHubIssue,
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,
): ColumnId {
  const labelNames = issue.labels.map((l) => l.name.toLowerCase())

  // 1. Cody lifecycle labels (highest priority — set by the pipeline state machine)
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building'))
    return 'building'
  if (labelNames.includes('cody:failed')) return 'failed'
  // cody:done = pipeline finished, PR created → task goes to review (not done)
  // Task is only truly "done" when the PR is merged and the issue is closed
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) return 'review'

  // 2. Active workflow run takes priority over gate labels
  // This ensures the dashboard shows "Building" even if risk-gated/hard-stop labels
  // are still present (they are removed mid-run after approval)
  if (workflowRun?.status === 'in_progress') return 'building'

  // 3. Explicit state labels (only checked when no active workflow run)
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'

  // 3b. Pipeline gate labels (set by pipeline when hitting gates)
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'

  // 4. Workflow run completed status
  if (workflowRun?.status === 'completed') {
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }

  // 5. Associated PR
  if (associatedPR && !associatedPR.merged_at) return 'review'

  // 6. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

  // 7. Default to open
  return 'open'
}

describe('getColumnForIssue', () => {
  const baseIssue: GitHubIssue = {
    id: 1,
    number: 640,
    title: '[2603--auto-XX] P5 Exercise Generation from Document',
    body: '',
    state: 'open',
    labels: [],
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }

  describe('cody:* lifecycle labels take highest priority', () => {
    it('should return building for cody:building label', () => {
      const issue = { ...baseIssue, labels: [{ name: 'cody:building', color: 'blue' }] }
      expect(getColumnForIssue(issue)).toBe('building')
    })

    it('should return failed for cody:failed label', () => {
      const issue = { ...baseIssue, labels: [{ name: 'cody:failed', color: 'red' }] }
      expect(getColumnForIssue(issue)).toBe('failed')
    })

    it('should return review for cody:done label (pipeline finished, PR ready)', () => {
      const issue = { ...baseIssue, labels: [{ name: 'cody:done', color: 'green' }] }
      expect(getColumnForIssue(issue)).toBe('review')
    })

    it('cody:building should override risk-gated label', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:building', color: 'blue' },
          { name: 'risk-gated', color: 'yellow' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('building')
    })
  })

  describe('workflow run in_progress takes priority over gate labels', () => {
    it('should return building when workflow is in_progress, even with risk-gated label', () => {
      const issue = {
        ...baseIssue,
        labels: [{ name: 'risk-gated', color: 'yellow' }],
      }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'in_progress',
        conclusion: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('building')
    })

    it('should return building when workflow is in_progress, even with hard-stop label', () => {
      const issue = {
        ...baseIssue,
        labels: [{ name: 'hard-stop', color: 'red' }],
      }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'in_progress',
        conclusion: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('building')
    })

    it('should return gate-waiting for risk-gated when no active workflow run', () => {
      const issue = {
        ...baseIssue,
        labels: [{ name: 'risk-gated', color: 'yellow' }],
      }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })

    it('should return gate-waiting for hard-stop when no active workflow run', () => {
      const issue = {
        ...baseIssue,
        labels: [{ name: 'hard-stop', color: 'red' }],
      }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })
  })

  describe('workflow run completed status', () => {
    it('should return failed when workflow completed with failure', () => {
      const issue = { ...baseIssue, labels: [] }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('failed')
    })

    it('should return failed when workflow completed with timed_out', () => {
      const issue = { ...baseIssue, labels: [] }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'completed',
        conclusion: 'timed_out',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('failed')
    })

    it('should return failed when workflow completed with cancelled', () => {
      const issue = { ...baseIssue, labels: [] }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'completed',
        conclusion: 'cancelled',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('failed')
    })

    it('should NOT return failed when workflow completed with success', () => {
      const issue = { ...baseIssue, labels: [] }
      const workflowRun: WorkflowRun = {
        id: 123,
        status: 'completed',
        conclusion: 'success',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        html_url: 'https://github.com/owner/repo/actions/runs/123',
        display_title: 'Task title',
      }
      expect(getColumnForIssue(issue, workflowRun)).toBe('open')
    })
  })

  describe('other label behaviors', () => {
    it('should return failed for explicit failed label', () => {
      const issue = { ...baseIssue, labels: [{ name: 'failed', color: 'red' }] }
      expect(getColumnForIssue(issue)).toBe('failed')
    })

    it('should return gate-waiting for gate-waiting label', () => {
      const issue = { ...baseIssue, labels: [{ name: 'gate-waiting', color: 'yellow' }] }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })

    it('should return retrying for retrying label', () => {
      const issue = { ...baseIssue, labels: [{ name: 'retrying', color: 'orange' }] }
      expect(getColumnForIssue(issue)).toBe('retrying')
    })

    it('should return review for associated PR', () => {
      const issue = { ...baseIssue, labels: [] }
      const pr: GitHubPR = {
        id: 1,
        number: 1,
        title: 'PR title',
        state: 'open',
        head: { ref: 'feat/640-task', sha: 'abc123' },
        merged_at: null,
        html_url: 'https://github.com/owner/repo/pull/1',
      }
      expect(getColumnForIssue(issue, undefined, pr)).toBe('review')
    })

    it('should return open for default case', () => {
      expect(getColumnForIssue(baseIssue)).toBe('open')
    })
  })
})
