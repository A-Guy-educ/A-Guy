/**
 * Get initial view mode on page load
 * Always returns 'PDF' per HLS/GAP requirement
 */
export function getInitialViewMode(): 'PDF' | 'CHAT' {
  return 'PDF'
}
