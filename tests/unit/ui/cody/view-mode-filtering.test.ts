/**
 * @fileType test
 * @domain cody
 * @pattern unit-test
 * @ai-summary Unit tests for view-mode filtering and count logic
 */
import { describe, it, expect } from 'vitest'
import { filterTasksByView, getViewModeCounts } from '@/ui/cody/utils'
import type { CodyTask } from '@/ui/cody/types'
import type { ColumnId } from '@/ui/cody/types'

/** Minimal task stub with column and labels */
function makeTask(column: ColumnId, opts: { labels?: string[]; id?: string } = {}): CodyTask {
  return {
    id: opts.id ?? `task-${column}-${Math.random().toString(36).slice(2, 6)}`,
    column,
    labels: opts.labels ?? [],
  } as CodyTask
}

// ============ getViewModeCounts ============

describe('getViewModeCounts', () => {
  it('counts open tasks as backlog, everything else as running', () => {
    const tasks = [
      makeTask('open'),
      makeTask('open'),
      makeTask('building'),
      makeTask('review'),
      makeTask('done'),
    ]
    const { runningCount, backlogCount } = getViewModeCounts(tasks)
    expect(backlogCount).toBe(2)
    expect(runningCount).toBe(3)
  })

  it('returns zero for both when tasks array is empty', () => {
    const { runningCount, backlogCount } = getViewModeCounts([])
    expect(backlogCount).toBe(0)
    expect(runningCount).toBe(0)
  })

  it('counts all as backlog when every task is open', () => {
    const tasks = [makeTask('open'), makeTask('open')]
    const { runningCount, backlogCount } = getViewModeCounts(tasks)
    expect(backlogCount).toBe(2)
    expect(runningCount).toBe(0)
  })

  it('counts all as running when no tasks are open', () => {
    const tasks = [makeTask('building'), makeTask('done'), makeTask('failed')]
    const { runningCount, backlogCount } = getViewModeCounts(tasks)
    expect(backlogCount).toBe(0)
    expect(runningCount).toBe(3)
  })

  it('counts all column types correctly', () => {
    const allColumns: ColumnId[] = [
      'open',
      'building',
      'review',
      'failed',
      'gate-waiting',
      'retrying',
      'done',
    ]
    const tasks = allColumns.map((col) => makeTask(col))
    const { runningCount, backlogCount } = getViewModeCounts(tasks)
    expect(backlogCount).toBe(1) // only 'open'
    expect(runningCount).toBe(6) // everything else
  })
})

// ============ filterTasksByView ============

describe('filterTasksByView', () => {
  const openTask = makeTask('open', { id: 'open-1', labels: ['bug'] })
  const buildingTask = makeTask('building', { id: 'building-1', labels: ['feature'] })
  const reviewTask = makeTask('review', { id: 'review-1', labels: ['bug', 'feature'] })
  const doneTask = makeTask('done', { id: 'done-1', labels: ['feature'] })
  const failedTask = makeTask('failed', { id: 'failed-1', labels: ['bug'] })
  const allTasks = [openTask, buildingTask, reviewTask, doneTask, failedTask]

  // ---- View mode splitting ----

  describe('view mode splitting', () => {
    it('running view excludes open tasks', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).not.toContainEqual(expect.objectContaining({ id: 'open-1' }))
      expect(result).toHaveLength(4)
    })

    it('backlog view only includes open tasks', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'backlog',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('open-1')
    })

    it('running view returns empty when all tasks are open', () => {
      const openOnly = [makeTask('open'), makeTask('open')]
      const result = filterTasksByView(openOnly, {
        viewMode: 'running',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(0)
    })

    it('backlog view returns empty when no tasks are open', () => {
      const noOpen = [makeTask('building'), makeTask('done')]
      const result = filterTasksByView(noOpen, {
        viewMode: 'backlog',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(0)
    })
  })

  // ---- Status filter within view ----

  describe('status filter within view', () => {
    it('running view + status=building shows only building tasks', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'building',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('building-1')
    })

    it('running view + status=done shows only done tasks', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'done',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('done-1')
    })

    it('backlog view + status=open shows open tasks (redundant but valid)', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'backlog',
        statusFilter: 'open',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('open-1')
    })

    it('backlog view + status=building shows nothing (no overlap)', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'backlog',
        statusFilter: 'building',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(0)
    })
  })

  // ---- Label filter within view ----

  describe('label filter within view', () => {
    it('running view + label=feature shows only running tasks with that label', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'all',
        labelFilter: 'feature',
      })
      // buildingTask (feature), reviewTask (bug, feature), doneTask (feature)
      expect(result).toHaveLength(3)
      expect(result.map((t) => t.id).sort()).toEqual(['building-1', 'done-1', 'review-1'])
    })

    it('running view + label=bug shows only running tasks with bug label', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'all',
        labelFilter: 'bug',
      })
      // reviewTask (bug, feature), failedTask (bug)
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.id).sort()).toEqual(['failed-1', 'review-1'])
    })

    it('backlog view + label=bug shows open tasks with bug label', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'backlog',
        statusFilter: 'all',
        labelFilter: 'bug',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('open-1')
    })

    it('backlog view + label=feature shows nothing (open task has only bug)', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'backlog',
        statusFilter: 'all',
        labelFilter: 'feature',
      })
      expect(result).toHaveLength(0)
    })
  })

  // ---- Combined status + label filters ----

  describe('combined filters', () => {
    it('running + status=review + label=bug narrows to review task with bug', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'review',
        labelFilter: 'bug',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('review-1')
    })

    it('running + status=review + label=nonexistent returns empty', () => {
      const result = filterTasksByView(allTasks, {
        viewMode: 'running',
        statusFilter: 'review',
        labelFilter: 'nonexistent',
      })
      expect(result).toHaveLength(0)
    })
  })

  // ---- Empty input ----

  describe('edge cases', () => {
    it('returns empty array for empty tasks', () => {
      const result = filterTasksByView([], {
        viewMode: 'running',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(0)
    })

    it('returns empty array for empty tasks in backlog mode', () => {
      const result = filterTasksByView([], {
        viewMode: 'backlog',
        statusFilter: 'all',
        labelFilter: 'all',
      })
      expect(result).toHaveLength(0)
    })
  })
})
