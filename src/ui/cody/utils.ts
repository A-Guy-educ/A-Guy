/**
 * @fileType utility
 * @domain cody
 * @pattern utilities
 * @ai-summary Utility functions for Cody dashboard
 */

/**
 * Simple className merger (minimal version for cody dashboard)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return then.toLocaleDateString()
}

// ============ View Mode Filtering ============

import type { CodyTask } from './types'
import type { ViewMode } from './components/FilterBar'

export interface ViewModeFilterOptions {
  viewMode: ViewMode
  statusFilter: string
  labelFilter: string
}

/**
 * Filter tasks by view mode, then by status and label (combined with AND logic).
 * - 'running' view: excludes tasks in 'open' column
 * - 'backlog' view: only tasks in 'open' column
 * Status and label filters apply within the selected view.
 */
export function filterTasksByView(tasks: CodyTask[], options: ViewModeFilterOptions): CodyTask[] {
  const { viewMode, statusFilter, labelFilter } = options
  return tasks.filter((task) => {
    // View mode filter — primary split
    if (viewMode === 'backlog' && task.column !== 'open') return false
    if (viewMode === 'running' && task.column === 'open') return false
    // Status filter
    if (statusFilter !== 'all' && task.column !== statusFilter) return false
    // Label filter
    if (labelFilter !== 'all' && !task.labels.includes(labelFilter)) return false
    return true
  })
}

/**
 * Compute view mode counts from task list.
 * Backlog = tasks in 'open' column. Running = everything else.
 */
export function getViewModeCounts(tasks: CodyTask[]): {
  runningCount: number
  backlogCount: number
} {
  const backlogCount = tasks.filter((t) => t.column === 'open').length
  return {
    backlogCount,
    runningCount: tasks.length - backlogCount,
  }
}
