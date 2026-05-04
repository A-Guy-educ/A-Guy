/**
 * Smoke test for kody-engine v0.3.48 classify→bug dispatch race fix.
 *
 * Confirms that on issue #1380 (repo A-Guy-educ/A-Guy):
 * 1. classify runs (label fast path)
 * 2. classify postflight: audit → state CREATE → @kody bug (last)
 * 3. @kody bug survives concurrency cull, bug orchestrator starts
 * 4. bug orchestrator dispatches @kody plan
 *
 * REGRESSION SYMPTOM: If the race regresses, @kody bug is cancelled before the orchestrator
 * starts, and the engine logs 'no action for event issue_comment'. The @kody plan comment
 * will be absent. expect(planComment).toBeDefined() fails with
 * "Expected value to be defined, received undefined".
 *
 * TEST ISSUE: GitHub issue #1380 (repo A-Guy-educ/A-Guy)
 */

import { describe, expect, it } from 'vitest'

const TEST_ISSUE_NUMBER = 1380
const REPO = 'A-Guy-educ/A-Guy'

// eslint-disable-next-line @typescript-eslint/no-var-requires
describe.skipIf(!process.env.GITHUB_TOKEN)('kody-engine v0.3.48 classify→bug dispatch', () => {
  // gh() uses require() inside the function scope to avoid vi.mock('child_process')
  // conflicts with sibling unit test files (tests/unit/scripts/inspector/github-client.test.ts).
  // GH_TOKEN is injected via the env option, matching scripts/inspector/clients/github.ts line 23.
  const gh = (args: string[]): string => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execFileSync } = require('child_process')
    return execFileSync('gh', args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
    }).trim()
  }

  const parseKodyState = (text: string): KodyStateV1 | null => {
    const beginMarker = '<!-- kody:state:v1:begin -->'
    const endMarker = '<!-- kody:state:v1:end -->'
    const bi = text.indexOf(beginMarker)
    const ei = text.indexOf(endMarker)
    if (bi === -1 || ei === -1) return null
    const raw = text.slice(bi + beginMarker.length, ei).trim()
    try {
      // Strip opening ```json fence
      const stripped1 = raw.replace(/^```json\s*/i, '').trim()
      // Strip closing ``` fence
      const stripped2 = stripped1.replace(/\s*```$/i, '').trim()
      return JSON.parse(stripped2) as KodyStateV1
    } catch {
      return null
    }
  }

  const getComments = (): IssueComment[] => {
    const output = gh([
      'api',
      `repos/${REPO}/issues/${TEST_ISSUE_NUMBER}/comments`,
      '--paginate',
      '--jq',
      '[.[] | {author: .user.login, body: .body, createdAt: .created_at}]',
    ])
    if (!output) return []
    try {
      return JSON.parse(output) as IssueComment[]
    } catch {
      return []
    }
  }

  const getIssue = (): IssueWithLabels => {
    const output = gh([
      'api',
      `repos/${REPO}/issues/${TEST_ISSUE_NUMBER}`,
      '--jq',
      '{body: .body, title: .title, labels: [.labels[].name]}',
    ])
    if (!output) return { body: '', title: '', labels: [] }
    try {
      return JSON.parse(output) as IssueWithLabels
    } catch {
      return { body: '', title: '', labels: [] }
    }
  }

  // Finds the state block from the latest @kody bug cycle.
  // Filters to state comments posted at or after the latest @kody bug comment timestamp,
  // guarding against stale state from a prior cycle.
  const getLatestBugFlowState = (): KodyStateV1 | null => {
    const comments = getComments()
    const bugComments = comments.filter((c) => c.body.includes('@kody bug'))
    if (bugComments.length === 0) return null
    const latestBugTime = new Date(bugComments[bugComments.length - 1].createdAt).getTime()
    const stateComments = comments.filter((c) => {
      const state = parseKodyState(c.body)
      const commentTime = new Date(c.createdAt).getTime()
      return state !== null && commentTime >= latestBugTime
    })
    if (stateComments.length === 0) return null
    return parseKodyState(stateComments[stateComments.length - 1].body)
  }

  describe('state block', () => {
    it('issue #1380 exists and has the bug label', () => {
      const issue = getIssue()
      expect(issue.labels).toContain('bug')
    })

    it('state block is present in a comment', () => {
      const state = getLatestBugFlowState()
      expect(state).not.toBeNull()
    })

    it('state shows flow.name = "bug" and flow.step = "plan"', () => {
      const state = getLatestBugFlowState()
      expect(state).not.toBeNull()
      expect(state!.flow.name).toBe('bug')
      expect(state!.flow.step).toBe('plan')
    })

    it('state shows core.phase = "idle" and core.status = "pending"', () => {
      const state = getLatestBugFlowState()
      expect(state).not.toBeNull()
      expect(state!.core.phase).toBe('idle')
      expect(state!.core.status).toBe('pending')
    })
  })

  describe('comment sequence', () => {
    it('@kody bug comment exists', () => {
      const comments = getComments()
      const bugComment = comments.find((c) => c.body.includes('@kody bug'))
      expect(bugComment).toBeDefined()
    })

    it('@kody plan comment exists', () => {
      const comments = getComments()
      const planComment = comments.find((c) => c.body.includes('@kody plan'))
      expect(planComment).toBeDefined()
    })

    it('@kody plan comment appears after @kody bug comment', () => {
      const comments = getComments()
      const bugComment = comments.find((c) => c.body.includes('@kody bug'))
      const planComment = comments.find((c) => c.body.includes('@kody plan'))
      const bugTime = new Date(bugComment!.createdAt).getTime()
      const planTime = new Date(planComment!.createdAt).getTime()
      expect(planTime).toBeGreaterThan(bugTime)
    })
  })

  describe('race condition regression test', () => {
    // Regression gate: if v0.3.48 fix reverts, @kody bug run is cancelled by
    // concurrency cull before bug orchestrator starts, engine logs 'no action for
    // event issue_comment', and @kody plan comment is never posted.
    it('@kody plan was dispatched — bug orchestrator survived concurrency cull', () => {
      const comments = getComments()
      const planComment = comments.find((c) => c.body.includes('@kody plan'))
      expect(planComment).toBeDefined()
    })
  })
})

// Type declarations — module level, after the describe block
// KodyStateV1 mirrors the schema emitted by kody engine (confirmed from live inspection)
interface KodyStateV1 {
  core: {
    phase: string
    status: string
    // Additional fields present in live inspection are optional to avoid brittle tests
    [key: string]: unknown
  }
  flow: {
    name: string
    step: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

// IssueComment mirrors the --jq projection used in getComments()
interface IssueComment {
  author: string
  body: string
  createdAt: string
}

// IssueWithLabels mirrors the --jq projection used in getIssue()
interface IssueWithLabels {
  body: string
  title: string
  labels: string[]
}
