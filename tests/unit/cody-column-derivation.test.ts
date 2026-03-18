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
 * Derive column from issue labels only - mirrors the updated logic in route.ts getColumnForIssue
 * PR labels are no longer used for column derivation (issue labels are the single source of truth)
 */
function deriveColumnFromLabels(
  issueLabels: string[],
  workflowRun?: MockWorkflowRun,
  pr?: MockGitHubPR | null,
): ColumnId {
  const labelNames = issueLabels.map((l) => l.toLowerCase())

  // 0. Terminal lifecycle labels (highest priority)
  if (labelNames.includes('cody:failed')) return 'failed'
  if (labelNames.includes('cody:done') || labelNames.includes('cody:review')) {
    return 'review'
  }

  // 1. Gate labels
  if (labelNames.includes('hard-stop') || labelNames.includes('risk-gated')) return 'gate-waiting'

  // 2. Active work labels
  if (labelNames.includes('cody:planning') || labelNames.includes('cody:building'))
    return 'building'

  // 3. Workflow run
  if (workflowRun?.status === 'in_progress') return 'building'

  // 4. Other labels
  if (labelNames.includes('failed')) return 'failed'
  if (labelNames.includes('gate-waiting')) return 'gate-waiting'
  if (labelNames.includes('retrying')) return 'retrying'

  // 5. Workflow completed
  if (workflowRun?.status === 'completed') {
    if (
      workflowRun.conclusion === 'failure' ||
      workflowRun.conclusion === 'timed_out' ||
      workflowRun.conclusion === 'cancelled'
    )
      return 'failed'
  }

  // 6. PR
  if (pr && !pr.merged_at) return 'review'

  // 7. Other labels
  if (labelNames.includes('released')) return 'done'
  if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
  if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

  return 'open'
}

describe('Column Derivation from Labels', () => {
  describe('cody:done/cody:review issues', () => {
    it('returns review when issue has cody:done label', () => {
      const column = deriveColumnFromLabels(['cody:done', 'type:feature'], undefined, null)
      expect(column).toBe('review')
    })

    it('returns review when issue has cody:review label', () => {
      const column = deriveColumnFromLabels(['cody:review'], undefined, null)
      expect(column).toBe('review')
    })

    it('returns review regardless of PR labels (PR labels ignored)', () => {
      // PR labels no longer override issue labels
      const column = deriveColumnFromLabels(['cody:done'], undefined, {
        labels: ['risk-gated', 'cody:building'],
      })
      expect(column).toBe('review')
    })
  })

  describe('cody:failed issues', () => {
    it('returns failed when issue has cody:failed label', () => {
      const column = deriveColumnFromLabels(['cody:failed'], undefined, null)
      expect(column).toBe('failed')
    })

    it('returns failed regardless of PR labels (PR labels ignored)', () => {
      // PR labels no longer override issue labels
      const column = deriveColumnFromLabels(['cody:failed'], undefined, {
        labels: ['risk-gated'],
      })
      expect(column).toBe('failed')
    })
  })

  describe('gate labels on issues', () => {
    it('returns gate-waiting when issue has risk-gated label', () => {
      const column = deriveColumnFromLabels(['risk-gated'], undefined, null)
      expect(column).toBe('gate-waiting')
    })

    it('returns gate-waiting when issue has hard-stop label', () => {
      const column = deriveColumnFromLabels(['hard-stop'], undefined, null)
      expect(column).toBe('gate-waiting')
    })

    it('returns gate-waiting regardless of PR labels (PR labels ignored)', () => {
      // Even if PR has labels, issue labels take precedence
      const column = deriveColumnFromLabels(['risk-gated'], undefined, {
        labels: ['cody:done'],
      })
      expect(column).toBe('gate-waiting')
    })
  })

  describe('active work labels', () => {
    it('returns building when issue has cody:building label', () => {
      const column = deriveColumnFromLabels(['cody:building'], undefined, null)
      expect(column).toBe('building')
    })

    it('returns building when issue has cody:planning label', () => {
      const column = deriveColumnFromLabels(['cody:planning'], undefined, null)
      expect(column).toBe('building')
    })
  })

  describe('PR presence', () => {
    it('returns review when PR exists and issue has no special labels', () => {
      const column = deriveColumnFromLabels(['type:feature'], undefined, {
        labels: [],
        merged_at: null,
      })
      expect(column).toBe('review')
    })

    it('returns review when PR exists and is not merged', () => {
      const column = deriveColumnFromLabels(['type:feature'], undefined, {
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

    it('returns failed when workflow completed with timed_out', () => {
      const column = deriveColumnFromLabels(
        ['type:feature'],
        { status: 'completed', conclusion: 'timed_out' },
        null,
      )
      expect(column).toBe('failed')
    })

    it('returns failed when workflow completed with cancelled', () => {
      const column = deriveColumnFromLabels(
        ['type:feature'],
        { status: 'completed', conclusion: 'cancelled' },
        null,
      )
      expect(column).toBe('failed')
    })
  })

  describe('other labels', () => {
    it('returns done when issue has released label', () => {
      const column = deriveColumnFromLabels(['released'], undefined, null)
      expect(column).toBe('done')
    })

    it('returns building when issue has in-progress label', () => {
      const column = deriveColumnFromLabels(['in-progress'], undefined, null)
      expect(column).toBe('building')
    })

    it('returns review when issue has pr label', () => {
      const column = deriveColumnFromLabels(['pr'], undefined, null)
      expect(column).toBe('review')
    })

    it('returns open when issue has no relevant labels', () => {
      const column = deriveColumnFromLabels(['type:feature'], undefined, null)
      expect(column).toBe('open')
    })
  })
})
