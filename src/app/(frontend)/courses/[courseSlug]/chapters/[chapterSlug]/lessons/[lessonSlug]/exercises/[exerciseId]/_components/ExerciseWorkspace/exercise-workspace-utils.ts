import type { ViewMode } from './exercise-workspace-types'

/**
 * Get initial view mode on page load
 * Always returns 'PDF' per HLS/GAP requirement
 */
export function getInitialViewMode(): ViewMode {
  return 'PDF'
}
