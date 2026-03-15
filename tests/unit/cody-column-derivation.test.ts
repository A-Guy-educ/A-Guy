/**
 * @fileType test
 * @domain cody
 * @pattern column-derivation
 * @ai-summary Tests for task column derivation based on issue and PR labels
 */
import { describe, it, expect } from 'vitest'
import type { ColumnId } from '@/ui/cody/types'

// Import the function - it's defined in route.ts
// We'll re-implement the testable parts here to test the logic
type _GitHubIssueLabels = Array<{ name: string }>

interface MockGitHubPR {
  labels?: string[]
  merged_at?: string | null
}

interface MockWorkflowRun {
  status?: string
  conclusion?: string
}

/**
 * Derive column from PR labels - mirrors the logic in route.ts getColumnForIssue
 */
function deriveColumnFromLabels(
  issueLabels: string[],
  workflowRun?: MockWorkflowRun,
  pr?: MockGitHubPR | null,
): ColumnId {
  const labelNames = issueLabels.map((l) => l.toLowerCase())

  // 0. Check PR labels
  const prLabels = pr?.labels?.map((l) => l.toLowerCase()) ?? []

  // 1. Terminal lifecycle labels
  if (labelNames.includes('cody:failed') && !prLabels.includes('risk-gated')) return 'failed'
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) {
    // Check if PR has labels indicating active work
    if (prLabels.includes('hard-stop') || prLabels.includes('risk-gated')) return 'gate-waiting'
    if (prLabels.includes('cody:building') || prLabels.includes('cody:planning')) return 'building'
    if (prLabels.includes('cody:failed')) return 'failed'
    return 'review'
  }

  // 2. Gate labels
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'
  if (prLabels.includes('hard-stop') || prLabels.includes('risk-gated')) return 'gate-waiting'

  // 3. Active work labels
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building'))
    return 'building'

  // 4. Workflow run
  if (workflowRun?.status === 'in_progress') return 'building'

  // 5. Other labels
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'

  // 6. Workflow completed
  if (workflowRun?.status === 'completed') {
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }

  // 7. PR
  if (pr && !pr.merged_at) return 'review'

  // 8. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

  return 'open'
}

describe('Column Derivation from Labels', () => {
  describe('cody:done issue with PR labels', () => {
    it('returns gate-waiting when PR has risk-gated label', () => {
      const column = deriveColumnFromLabels(['cody:done', 'type:feature'], undefined, {
        labels: ['risk-gated', 'type:bug'],
      })
      expect(column).toBe('gate-waiting')
    })

    it('returns gate-waiting when PR has hard-stop label', () => {
      const column = deriveColumnFromLabels(['cody:done'], undefined, {
        labels: ['hard-stop'],
      })
      expect(column).toBe('gate-waiting')
    })

    it('returns building when PR has cody:building label', () => {
      const column = deriveColumnFromLabels(['cody:done'], undefined, {
        labels: ['cody:building'],
      })
      expect(column).toBe('building')
    })

    it('returns failed when PR has cody:failed label but no risk-gated', () => {
      const column = deriveColumnFromLabels(['cody:done'], undefined, {
        labels: ['cody:failed'],
      })
      expect(column).toBe('failed')
    })

    it('returns review when PR has no active labels', () => {
      const column = deriveColumnFromLabels(['cody:done', 'type:feature'], undefined, {
        labels: ['type:bug'],
      })
      expect(column).toBe('review')
    })

    it('returns review when no PR exists', () => {
      const column = deriveColumnFromLabels(['cody:done'], undefined, null)
      expect(column).toBe('review')
    })
  })

  describe('cody:failed issue with PR labels', () => {
    it('returns gate-waiting (not failed) when issue has cody:failed but PR has risk-gated', () => {
      const column = deriveColumnFromLabels(['cody:failed'], undefined, {
        labels: ['risk-gated'],
      })
      // risk-gated should take precedence over cody:failed
      expect(column).toBe('gate-waiting')
    })

    it('returns failed when issue has cody:failed and no PR', () => {
      const column = deriveColumnFromLabels(['cody:failed'], undefined, null)
      expect(column).toBe('failed')
    })
  })

  describe('issues without cody:done', () => {
    it('returns gate-waiting when issue has risk-gated label', () => {
      const column = deriveColumnFromLabels(['risk-gated'], undefined, null)
      expect(column).toBe('gate-waiting')
    })

    it('returns building when issue has cody:building label', () => {
      const column = deriveColumnFromLabels(['cody:building'], undefined, null)
      expect(column).toBe('building')
    })

    it('returns review when PR exists and issue has no special labels', () => {
      const column = deriveColumnFromLabels(['type:feature'], undefined, {
        labels: [],
        merged_at: null,
      })
      expect(column).toBe('review')
    })
  })

  describe('workflow run status', () => {
    it('returns building when workflow is in_progress', () => {
      const column = deriveColumnFromLabels(['type:feature'], { status: 'in_progress' }, null)
      expect(column).toBe('building')
    })

    it('returns failed when workflow completed with failure', () => {
      const column = deriveColumnFromLabels(
        ['type:feature'],
        { status: 'completed', conclusion: 'failure' },
        null,
      )
      expect(column).toBe('failed')
    })
  })
})
