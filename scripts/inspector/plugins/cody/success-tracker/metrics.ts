/**
 * @fileType utility
 * @domain inspector
 * @pattern success-tracker-metrics
 * @ai-summary Calculates pipeline success metrics from workflow run data
 */

import type { WorkflowRun } from '../../../core/types'

export interface PeriodMetrics {
  period: '7d' | '30d'
  total: number
  successful: number
  failed: number
  cancelled: number
  successRate: number // 0-100, one decimal
  avgDurationMinutes: number // rounded to nearest int
}

export interface TrackerReport {
  sevenDay: PeriodMetrics
  thirtyDay: PeriodMetrics
  /** Percentage point difference: 7d - 30d. Positive = improving. */
  trendPp: number
  trendDirection: 'improving' | 'stable' | 'degrading'
}

const TREND_STABLE_THRESHOLD = 5 // pp — within ±5pp = stable

/**
 * Calculate duration in minutes between two ISO date strings.
 * Returns NaN if dates are invalid.
 */
function durationMinutes(createdAt: string, updatedAt: string): number {
  const start = new Date(createdAt).getTime()
  const end = new Date(updatedAt).getTime()
  if (isNaN(start) || isNaN(end) || end <= start) return NaN
  return (end - start) / 60_000
}

/**
 * Build metrics for a set of completed workflow runs.
 */
function buildMetrics(runs: WorkflowRun[], period: '7d' | '30d'): PeriodMetrics {
  const total = runs.length
  if (total === 0) {
    return {
      period,
      total: 0,
      successful: 0,
      failed: 0,
      cancelled: 0,
      successRate: 0,
      avgDurationMinutes: 0,
    }
  }

  let successful = 0
  let failed = 0
  let cancelled = 0
  const durations: number[] = []

  for (const run of runs) {
    const c = run.conclusion
    if (c === 'success') successful++
    else if (c === 'failure') failed++
    else if (c === 'cancelled' || c === 'skipped') cancelled++

    const dur = durationMinutes(run.createdAt, run.updatedAt)
    if (!isNaN(dur)) durations.push(dur)
  }

  const successRate = Math.round((successful / total) * 1000) / 10 // 1 decimal
  const avgDurationMinutes =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

  return { period, total, successful, failed, cancelled, successRate, avgDurationMinutes }
}

/**
 * Compute tracker report from a list of completed workflow runs.
 * Partitions runs by age into 7-day and 30-day windows.
 */
export function computeReport(
  allRuns: WorkflowRun[],
  now: Date = new Date(),
): TrackerReport | null {
  const nowMs = now.getTime()
  const ms7d = 7 * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000

  const runs7d = allRuns.filter((r) => {
    const created = new Date(r.createdAt).getTime()
    return !isNaN(created) && nowMs - created <= ms7d
  })

  const runs30d = allRuns.filter((r) => {
    const created = new Date(r.createdAt).getTime()
    return !isNaN(created) && nowMs - created <= ms30d
  })

  // Need at least some 30-day data to be useful
  if (runs30d.length === 0) return null

  const sevenDay = buildMetrics(runs7d, '7d')
  const thirtyDay = buildMetrics(runs30d, '30d')

  const trendPp =
    runs7d.length > 0 ? Math.round((sevenDay.successRate - thirtyDay.successRate) * 10) / 10 : 0

  let trendDirection: TrackerReport['trendDirection']
  if (Math.abs(trendPp) <= TREND_STABLE_THRESHOLD) {
    trendDirection = 'stable'
  } else if (trendPp > 0) {
    trendDirection = 'improving'
  } else {
    trendDirection = 'degrading'
  }

  return { sevenDay, thirtyDay, trendPp, trendDirection }
}
