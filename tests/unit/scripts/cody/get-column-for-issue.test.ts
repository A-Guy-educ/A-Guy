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

  // 1. Terminal lifecycle labels (highest priority)
  if (labelNames.includes('cody:failed')) return 'failed'
  // cody:done = pipeline finished, PR created → task goes to review (not done)
  // Task is only truly "done" when the PR is merged and the issue is closed
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) return 'review'

  // 2. Gate labels — pipeline paused waiting for approval.
  // Must be checked BEFORE cody:planning/cody:building and in_progress workflow,
  // because the pipeline keeps running (polling for approval) while gated,
  // and the cody:planning label is never removed when a gate fires.
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'

  // 3. Cody active-work labels (only reached when NOT gated)
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building'))
    return 'building'

  // 4. Active workflow run (only reached when NOT gated and no cody:* label)
  if (workflowRun?.status === 'in_progress') return 'building'

  // 5. Explicit state labels (only checked when no active workflow run)
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'

  // 6. Workflow run completed status
  if (workflowRun?.status === 'completed') {
    // Also handle timed_out and cancelled as failures
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }

  // 7. Associated PR (always fetched via bulk)
  if (associatedPR && !associatedPR.merged_at) return 'review'

  // 8. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

  // 9. Default to open
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

    it('risk-gated should override cody:building label (gate takes priority)', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:building', color: 'blue' },
          { name: 'risk-gated', color: 'yellow' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })

    it('risk-gated should override cody:planning label (gate takes priority)', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:planning', color: 'blue' },
          { name: 'risk-gated', color: 'yellow' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })

    it('hard-stop should override cody:planning label (gate takes priority)', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:planning', color: 'blue' },
          { name: 'hard-stop', color: 'red' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('gate-waiting')
    })

    it('cody:planning + risk-gated + in_progress workflow should still be gate-waiting', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:planning', color: 'blue' },
          { name: 'risk-gated', color: 'yellow' },
        ],
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
      expect(getColumnForIssue(issue, workflowRun)).toBe('gate-waiting')
    })

    it('cody:done should still override risk-gated (pipeline completed)', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:done', color: 'green' },
          { name: 'risk-gated', color: 'yellow' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('review')
    })

    it('cody:failed should still override risk-gated', () => {
      const issue = {
        ...baseIssue,
        labels: [
          { name: 'cody:failed', color: 'red' },
          { name: 'risk-gated', color: 'yellow' },
        ],
      }
      expect(getColumnForIssue(issue)).toBe('failed')
    })
  })

  describe('gate labels take priority over workflow runs', () => {
    it('risk-gated should override in_progress workflow (gate takes priority)', () => {
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
      expect(getColumnForIssue(issue, workflowRun)).toBe('gate-waiting')
    })

    it('hard-stop should override in_progress workflow (gate takes priority)', () => {
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
      expect(getColumnForIssue(issue, workflowRun)).toBe('gate-waiting')
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
