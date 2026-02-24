/**
 * @fileType test
 * @domain cody
 * @pattern date-filter
 * @ai-summary Tests for the date filter functionality in Cody dashboard
 */
import { describe, it, expect } from 'vitest'

// Test the date filter logic that would be used in the API
describe('Date Filter Logic', () => {
  const DATE_FILTERS = [
    { label: 'All time', value: 'all', days: undefined },
    { label: 'Last 7 days', value: '7d', days: 7 },
    { label: 'Last 30 days', value: '30d', days: 30 },
    { label: 'Last 90 days', value: '90d', days: 90 },
  ] as const

  // Simulates the date calculation logic in the API route
  function calculateSinceDate(days: number | undefined): string | undefined {
    if (days === undefined) return undefined

    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString()
  }

  it('should return undefined for "all time" filter', () => {
    const filter = DATE_FILTERS.find((f) => f.value === 'all')
    expect(filter?.days).toBeUndefined()
    expect(calculateSinceDate(filter?.days)).toBeUndefined()
  })

  it('should return correct date for "7 days" filter', () => {
    const filter = DATE_FILTERS.find((f) => f.value === '7d')
    expect(filter?.days).toBe(7)

    const since = calculateSinceDate(filter?.days)
    expect(since).toBeDefined()

    const sinceDate = new Date(since!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(7)
  })

  it('should return correct date for "30 days" filter', () => {
    const filter = DATE_FILTERS.find((f) => f.value === '30d')
    expect(filter?.days).toBe(30)

    const since = calculateSinceDate(filter?.days)
    expect(since).toBeDefined()

    const sinceDate = new Date(since!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(30)
  })

  it('should return correct date for "90 days" filter', () => {
    const filter = DATE_FILTERS.find((f) => f.value === '90d')
    expect(filter?.days).toBe(90)

    const since = calculateSinceDate(filter?.days)
    expect(since).toBeDefined()

    const sinceDate = new Date(since!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(90)
  })
})

// Test URL building logic
describe('URL Building', () => {
  const API_BASE = '/api/cody'
  const DATE_FILTERS = [
    { label: 'All time', value: 'all', days: undefined },
    { label: 'Last 7 days', value: '7d', days: 7 },
    { label: 'Last 30 days', value: '30d', days: 30 },
    { label: 'Last 90 days', value: '90d', days: 90 },
  ] as const

  function buildTasksUrl(dateFilterValue: string, includeDetails = false): string {
    const filter = DATE_FILTERS.find((f) => f.value === dateFilterValue)
    const params = new URLSearchParams()

    if (filter?.days) {
      params.set('days', String(filter.days))
    }
    params.set('includeDetails', String(includeDetails))

    return `${API_BASE}/tasks?${params.toString()}`
  }

  it('should build URL without days param for "all" filter', () => {
    const url = buildTasksUrl('all', false)
    expect(url).toBe('/api/cody/tasks?includeDetails=false')
    expect(url).not.toContain('days=')
  })

  it('should build URL with days param for "7d" filter', () => {
    const url = buildTasksUrl('7d', false)
    expect(url).toContain('days=7')
    expect(url).toContain('includeDetails=false')
  })

  it('should build URL with days param for "30d" filter', () => {
    const url = buildTasksUrl('30d', false)
    expect(url).toContain('days=30')
    expect(url).toContain('includeDetails=false')
  })

  it('should include includeDetails=true when requested', () => {
    const url = buildTasksUrl('30d', true)
    expect(url).toContain('days=30')
    expect(url).toContain('includeDetails=true')
  })
})

// Test the column derivation logic
describe('Column Derivation', () => {
  type ColumnId = 'open' | 'building' | 'review' | 'done' | 'failed' | 'gate-waiting' | 'retrying'

  function getColumnForIssue(
    issueState: 'open' | 'closed',
    labels: string[],
    workflowStatus?: string,
  ): ColumnId {
    if (issueState === 'closed') return 'done'

    const labelNames = labels.map((l) => l.toLowerCase())

    if (labelNames.includes('failed') || workflowStatus === 'failed') return 'failed'
    if (labelNames.includes('gate-waiting')) return 'gate-waiting'
    if (labelNames.includes('retrying')) return 'retrying'
    if (labelNames.includes('in-progress') || labelNames.includes('building')) return 'building'
    if (labelNames.includes('review') || labelNames.includes('pr')) return 'review'

    return 'open'
  }

  it('should return "done" for closed issues', () => {
    expect(getColumnForIssue('closed', [])).toBe('done')
    expect(getColumnForIssue('closed', ['bug'])).toBe('done')
  })

  it('should return "open" for open issues with no special labels', () => {
    expect(getColumnForIssue('open', [])).toBe('open')
    expect(getColumnForIssue('open', ['feature'])).toBe('open')
  })

  it('should return "building" for issues with building label', () => {
    expect(getColumnForIssue('open', ['building'])).toBe('building')
    expect(getColumnForIssue('open', ['in-progress'])).toBe('building')
  })

  it('should return "failed" for issues with failed label', () => {
    expect(getColumnForIssue('open', ['failed'])).toBe('failed')
  })

  it('should return "review" for issues with pr label', () => {
    expect(getColumnForIssue('open', ['review'])).toBe('review')
    expect(getColumnForIssue('open', ['pr'])).toBe('review')
  })
})
