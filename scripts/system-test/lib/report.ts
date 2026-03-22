/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern reporting
 * @ai-summary Report generation for system test results
 */

export interface AssertionResult {
  name: string
  passed: boolean
  detail?: string
}

export interface ScenarioResult {
  name: string
  passed: boolean
  duration: number
  assertions: AssertionResult[]
  error?: string
}

/**
 * Generate a markdown report from scenario results.
 */
export function generateReport(results: ScenarioResult[]): string {
  const lines: string[] = []

  lines.push('## 🧪 Cody System Test Report')
  lines.push('')
  lines.push(`**Date**: ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')

  // Summary
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  lines.push('### Summary')
  lines.push('')
  lines.push(`- **Total**: ${results.length}`)
  lines.push(`- **Passed**: ${passed}`)
  lines.push(`- **Failed**: ${failed}`)
  lines.push(`- **Duration**: ${formatDuration(totalDuration)}`)
  lines.push('')

  // Results table
  lines.push('### Results')
  lines.push('')
  lines.push('| # | Scenario | Status | Duration | Assertions |')
  lines.push('|---|----------|--------|----------|------------|')

  results.forEach((result, idx) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    const assertionCount = `${result.assertions.filter((a) => a.passed).length}/${result.assertions.length}`
    lines.push(
      `| ${idx + 1} | ${result.name} | ${status} | ${formatDuration(result.duration)} | ${assertionCount} |`,
    )
  })

  lines.push('')

  // Failed assertions detail
  const failedResults = results.filter((r) => !r.passed)
  if (failedResults.length > 0) {
    lines.push('### Failed Assertions')
    lines.push('')

    for (const result of failedResults) {
      lines.push(`#### ${result.name}`)
      lines.push('')

      if (result.error) {
        lines.push(`**Error**: ${result.error}`)
        lines.push('')
      }

      const failedAssertions = result.assertions.filter((a) => !a.passed)
      for (const assertion of failedAssertions) {
        lines.push(`- ❌ ${assertion.name}`)
        if (assertion.detail) {
          lines.push(`  - ${assertion.detail}`)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Generate a Slack block-kit payload for failure notification.
 */
export function generateSlackPayload(results: ScenarioResult[], workflowUrl: string): object {
  const failed = results.filter((r) => !r.passed)
  const passed = results.filter((r) => r.passed).length

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: failed.length > 0 ? '❌ Cody System Test Failed' : '✅ Cody System Test Passed',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Passed:*\n${passed}`,
        },
        {
          type: 'mrkdwn',
          text: `*Failed:*\n${failed.length}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${workflowUrl}|View Workflow Run>`,
      },
    },
  ]

  if (failed.length > 0) {
    const failedNames = failed.map((f) => `• ${f.name}`).join('\n')
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failed Scenarios:*\n${failedNames}`,
      },
    })
  }

  return { blocks }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}
