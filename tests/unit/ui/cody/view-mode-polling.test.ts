/**
 * @fileType test
 * @domain cody
 * @pattern unit-test
 * @ai-summary Unit tests for view-mode-aware polling interval logic
 */
import { describe, it, expect } from 'vitest'
import { getSmartInterval } from '@/ui/cody/hooks'
import { POLLING_INTERVALS } from '@/ui/cody/constants'
import type { CodyTask } from '@/ui/cody/types'

/** Minimal task stub — only fields needed by getSmartInterval */
function makeTask(column: CodyTask['column']): CodyTask {
  return { column } as CodyTask
}

describe('getSmartInterval — view-mode-aware polling', () => {
  // ---- Running view (default) ----

  it('returns idle interval when no tasks exist', () => {
    expect(getSmartInterval(undefined)).toBe(POLLING_INTERVALS.idle)
    expect(getSmartInterval([])).toBe(POLLING_INTERVALS.idle)
  })

  it('returns board interval when active tasks exist in running view', () => {
    const tasks = [makeTask('building'), makeTask('open')]
    expect(getSmartInterval(tasks, 'running')).toBe(POLLING_INTERVALS.board)
  })

  it('returns board interval for retrying tasks', () => {
    const tasks = [makeTask('retrying')]
    expect(getSmartInterval(tasks, 'running')).toBe(POLLING_INTERVALS.board)
  })

  it('returns board interval for gate-waiting tasks', () => {
    const tasks = [makeTask('gate-waiting')]
    expect(getSmartInterval(tasks, 'running')).toBe(POLLING_INTERVALS.board)
  })

  it('returns idle interval when all tasks are open/done in running view', () => {
    const tasks = [makeTask('open'), makeTask('done')]
    expect(getSmartInterval(tasks, 'running')).toBe(POLLING_INTERVALS.idle)
  })

  it('defaults to running view when viewMode omitted', () => {
    const tasks = [makeTask('building')]
    expect(getSmartInterval(tasks)).toBe(POLLING_INTERVALS.board)
  })

  // ---- Backlog view ----

  it('returns backlog interval (120s) when in backlog view regardless of task state', () => {
    const tasksWithActive = [makeTask('building'), makeTask('open')]
    expect(getSmartInterval(tasksWithActive, 'backlog')).toBe(POLLING_INTERVALS.backlog)
  })

  it('returns backlog interval for idle tasks in backlog view', () => {
    const tasks = [makeTask('open'), makeTask('done')]
    expect(getSmartInterval(tasks, 'backlog')).toBe(POLLING_INTERVALS.backlog)
  })

  it('backlog interval is 120_000ms', () => {
    expect(POLLING_INTERVALS.backlog).toBe(120_000)
  })

  // ---- Edge: empty tasks in backlog view falls through to idle ----

  it('returns idle interval when tasks array is empty even in backlog view', () => {
    // Empty tasks = nothing to display, idle interval is fine
    expect(getSmartInterval([], 'backlog')).toBe(POLLING_INTERVALS.idle)
  })
})
