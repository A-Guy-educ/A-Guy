// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Scenario reporter - formats and outputs test results
 * @fileType reporter
 * @domain qa
 * @pattern reporter
 */
import type { ScenarioResult } from './scenario-runner'

export interface ReporterOptions {
  format: 'json' | 'html' | 'console'
  outputFile?: string
  includeScreenshots?: boolean
}

export interface TestReport {
  timestamp: string
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    duration: number
    passRate: number
  }
  results: ScenarioResult[]
  metadata?: Record<string, unknown>
}

/**
 * Calculate pass rate
 */
function calculatePassRate(passed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((passed / total) * 100 * 100) / 100
}

/**
 * Generate a test report
 */
export function generateReport(
  results: ScenarioResult[],
  duration: number,
  metadata?: Record<string, unknown>,
): TestReport {
  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      duration,
      passRate: calculatePassRate(passed, results.length),
    },
    results,
    metadata,
  }
}

/**
 * Format results as JSON
 */
export function formatAsJson(report: TestReport): string {
  return JSON.stringify(report, null, 2)
}

/**
 * Format results as console output
 */
export function formatAsConsole(report: TestReport): string {
  const lines: string[] = []

  lines.push('')
  lines.push('═'.repeat(60))
  lines.push('  QA SCENARIO TEST REPORT')
  lines.push('═'.repeat(60))
  lines.push('')
  lines.push(`  Timestamp: ${report.timestamp}`)
  lines.push(`  Duration:  ${report.summary.duration}ms`)
  lines.push('')
  lines.push(`  Total:     ${report.summary.total}`)
  lines.push(`  Passed:    ${report.summary.passed} ✓`)
  lines.push(`  Failed:    ${report.summary.failed} ✗`)
  lines.push(`  Skipped:   ${report.summary.skipped} ⊘`)
  lines.push(`  Pass Rate: ${report.summary.passRate}%`)
  lines.push('')

  if (report.summary.failed > 0) {
    lines.push('─'.repeat(60))
    lines.push('  FAILED SCENARIOS')
    lines.push('─'.repeat(60))
    lines.push('')

    for (const result of report.results) {
      if (result.status === 'failed') {
        lines.push(`  ✗ ${result.scenarioId}`)
        if (result.failedStep) {
          lines.push(`    Step ${result.failedStep.index}: ${result.failedStep.action}`)
          lines.push(`    Error: ${result.failedStep.error}`)
        }
        lines.push('')
      }
    }
  }

  lines.push('═'.repeat(60))
  lines.push('')

  return lines.join('\n')
}

/**
 * Format results as HTML
 */
export function formatAsHtml(report: TestReport): string {
  const rows = report.results
    .map(
      (result) => `
      <tr class="${result.status}">
        <td>${result.scenarioId}</td>
        <td>${result.status}</td>
        <td>${result.duration}ms</td>
        <td>${result.failedStep ? `${result.failedStep.action}: ${result.failedStep.error}` : '-'}</td>
      </tr>
    `,
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <title>QA Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary span { margin-right: 20px; }
    .passed { color: green; }
    .failed { color: red; }
    .skipped { color: orange; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #333; color: white; }
    tr.failed { background-color: #ffe6e6; }
    tr.passed { background-color: #e6f7e6; }
  </style>
</head>
<body>
  <h1>QA Scenario Test Report</h1>
  <div class="summary">
    <span><strong>Timestamp:</strong> ${report.timestamp}</span>
    <span><strong>Duration:</strong> ${report.summary.duration}ms</span>
    <span><strong>Pass Rate:</strong> ${report.summary.passRate}%</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
  `
}

/**
 * Format and output the report based on options
 */
export async function outputReport(report: TestReport, options: ReporterOptions): Promise<void> {
  let output: string

  switch (options.format) {
    case 'json':
      output = formatAsJson(report)
      break
    case 'html':
      output = formatAsHtml(report)
      break
    case 'console':
    default:
      output = formatAsConsole(report)
      break
  }

  if (options.outputFile) {
    const fs = await import('fs/promises')
    await fs.writeFile(options.outputFile, output)
  } else {
    console.log(output)
  }
}
