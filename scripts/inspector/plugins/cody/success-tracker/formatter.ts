/**
 * @fileType utility
 * @domain inspector
 * @pattern success-tracker-formatter
 * @ai-summary Formats pipeline metrics into Slack messages and GitHub markdown
 */

import type { TrackerReport, PeriodMetrics } from './metrics'

function trendEmoji(direction: TrackerReport['trendDirection']): string {
  if (direction === 'improving') return '📈'
  if (direction === 'degrading') return '📉'
  return '➡️'
}

function durationLabel(minutes: number): string {
  if (minutes === 0) return 'n/a'
  if (minutes < 60) return `${minutes}min`
  return `${Math.round(minutes / 60)}h ${minutes % 60}min`
}

function rateLabel(metrics: PeriodMetrics): string {
  if (metrics.total === 0) return 'no data'
  return `${metrics.successRate}%`
}

/**
 * Format a one-liner Slack message.
 */
export function formatSlackMessage(report: TrackerReport): string {
  const emoji = trendEmoji(report.trendDirection)
  const { sevenDay: s, thirtyDay: t } = report

  if (s.total === 0) {
    return `Cody 7d: no runs | 30d: ${rateLabel(t)} success (${t.total} runs)`
  }

  const trendStr =
    report.trendPp !== 0
      ? ` ${emoji} ${report.trendPp > 0 ? '+' : ''}${report.trendPp}pp vs 30d`
      : ` ${emoji} stable`

  return `Cody 7d: ${rateLabel(s)} success (${s.total} runs, ${durationLabel(s.avgDurationMinutes)} avg)${trendStr}`
}

/**
 * Format a full markdown table for the watchdog issue.
 */
export function formatMarkdownReport(report: TrackerReport, cycleNumber: number): string {
  const { sevenDay: s, thirtyDay: t } = report
  const emoji = trendEmoji(report.trendDirection)

  const trendStr =
    s.total === 0 ? 'no 7d data' : `${emoji} ${report.trendPp > 0 ? '+' : ''}${report.trendPp}pp`

  const durationTrend =
    s.avgDurationMinutes > 0 && t.avgDurationMinutes > 0
      ? s.avgDurationMinutes < t.avgDurationMinutes
        ? '⚡ faster'
        : s.avgDurationMinutes > t.avgDurationMinutes
          ? '🐢 slower'
          : '➡️ same'
      : '—'

  const rows = [
    `| Success Rate | ${rateLabel(s)} | ${rateLabel(t)} | ${trendStr} |`,
    `| Avg Duration | ${durationLabel(s.avgDurationMinutes)} | ${durationLabel(t.avgDurationMinutes)} | ${durationTrend} |`,
    `| Total Runs | ${s.total} | ${t.total} | — |`,
    `| Failures | ${s.failed} | ${t.failed} | — |`,
    `| Cancelled | ${s.cancelled} | ${t.cancelled} | — |`,
  ].join('\n')

  return `## Cody Pipeline — Daily Metrics

| Metric | 7 days | 30 days | Trend |
|--------|--------|---------|-------|
${rows}

_Inspector cycle ${cycleNumber}_`
}
