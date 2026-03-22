/**
 * @fileType test
 * @domain cody | ui
 * @pattern workflow-matching
 * @ai-summary Tests for matchWorkflowRunToTask — prefers active runs over stale completed ones
 */

import { describe, it, expect } from 'vitest'
import { matchWorkflowRunToTask } from '../../../../src/ui/cody/workflow-matching'
import type { WorkflowRun } from '../../../../src/ui/cody/types'

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    status: 'completed',
    conclusion: 'success',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: `https://github.com/owner/repo/actions/runs/${Math.floor(Math.random() * 1_000_000)}`,
    display_title: '',
    ...overrides,
  }
}

describe('matchWorkflowRunToTask', () => {
  it('prefers in_progress run over completed run with same display_title', () => {
    const completedRun = makeRun({
      status: 'completed',
      display_title: 'Fix widget rendering',
      created_at: '2026-03-16T12:00:00Z',
    })
    const activeRun = makeRun({
      status: 'in_progress',
      display_title: 'Fix widget rendering',
      created_at: '2026-03-16T12:05:00Z',
    })
    // completedRun is first (most recent) — old code would pick it
    const result = matchWorkflowRunToTask(
      [completedRun, activeRun],
      'Fix widget rendering',
      839,
      '260315-auto-839',
    )
    expect(result).toBe(activeRun)
  })

  it('returns most recent completed run when no active runs exist', () => {
    const recentRun = makeRun({
      status: 'completed',
      display_title: 'Fix widget',
      created_at: '2026-03-16T12:00:00Z',
    })
    const olderRun = makeRun({
      status: 'completed',
      display_title: 'Fix widget',
      created_at: '2026-03-15T12:00:00Z',
    })
    const result = matchWorkflowRunToTask([recentRun, olderRun], 'Fix widget', 100, 'task-100')
    expect(result).toBe(recentRun)
  })

  it('does not match by issue number substring in html_url (prevents false positives)', () => {
    // html_url contains "839" as part of the run ID — should NOT match
    const run = makeRun({
      status: 'in_progress',
      html_url: 'https://github.com/owner/repo/actions/runs/12839456',
      display_title: 'Other task entirely',
    })
    const result = matchWorkflowRunToTask([run], 'Fix widget rendering', 839, '260315-auto-839')
    expect(result).toBeUndefined()
  })

  it('matches by issue number reference in display_title', () => {
    const run = makeRun({
      status: 'in_progress',
      display_title: 'Fix #839 - widget rendering',
    })
    const result = matchWorkflowRunToTask([run], 'Different title', 839, 'some-task-id')
    expect(result).toBe(run)
  })

  it('returns undefined when no runs match', () => {
    const run = makeRun({
      status: 'completed',
      display_title: 'Other task',
    })
    const result = matchWorkflowRunToTask([run], 'Fix widget', 100, 'task-100')
    expect(result).toBeUndefined()
  })

  it('prefers queued over completed when no in_progress exists', () => {
    const completedRun = makeRun({
      status: 'completed',
      display_title: 'Fix widget',
      created_at: '2026-03-16T12:00:00Z',
    })
    const queuedRun = makeRun({
      status: 'queued',
      display_title: 'Fix widget',
      created_at: '2026-03-16T12:05:00Z',
    })
    const result = matchWorkflowRunToTask([completedRun, queuedRun], 'Fix widget', 100, 'task-100')
    expect(result).toBe(queuedRun)
  })

  it('handles empty issueTitle and zero issueNumber gracefully', () => {
    const run = makeRun({
      status: 'in_progress',
      display_title: 'cody',
    })
    // With empty title and zero issue number, only taskId matching applies
    const result = matchWorkflowRunToTask([run], '', 0, '260315-auto-839')
    // display_title "cody" does not contain "260315-auto-839", so no match
    expect(result).toBeUndefined()
  })

  it('matches by taskId in display_title', () => {
    const run = makeRun({
      status: 'in_progress',
      display_title: '[260315-auto-839] Fix widget rendering',
    })
    const result = matchWorkflowRunToTask([run], 'Different title', 0, '260315-auto-839')
    expect(result).toBe(run)
  })

  it('returns undefined for empty runs array', () => {
    const result = matchWorkflowRunToTask([], 'Fix widget', 839, 'task-id')
    expect(result).toBeUndefined()
  })

  it('does not false-positive match issue number 8 against #839', () => {
    const run = makeRun({
      status: 'in_progress',
      display_title: 'Fix #839 - something',
    })
    // Issue number 8 should NOT match "#839"
    const result = matchWorkflowRunToTask([run], 'Other title', 8, 'other-task')
    expect(result).toBeUndefined()
  })
})
