#!/usr/bin/env pnpm tsx
/**
 * @fileType script
 * @domain cody | system-test
 * @ai-summary Aggregate scenario results and generate report
 */

import * as fs from 'fs'
import * as path from 'path'
import { generateReport, generateSlackPayload } from './lib/report'
import type { ScenarioResult } from './lib/report'

async function main() {
  const args = process.argv.slice(2)
  let resultsDir = './results'

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--results-dir' && i + 1 < args.length) {
      resultsDir = args[i + 1]
      i++
    }
  }

  // Read result files
  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory not found: ${resultsDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'))

  if (files.length === 0) {
    console.error('No result files found')
    process.exit(1)
  }

  const results: ScenarioResult[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(resultsDir, file), 'utf-8')
    const result = JSON.parse(content) as ScenarioResult
    results.push(result)
  }

  // Generate report
  const report = generateReport(results)

  // Write to GITHUB_STEP_SUMMARY if available
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    fs.writeFileSync(summaryPath, report)
  }

  // Also print to stdout
  console.log(report)

  // Send Slack notification if configured and there are failures
  const failed = results.filter((r) => !r.passed)
  const slackWebhook = process.env.SLACK_WEBHOOK_URL

  if (failed.length > 0 && slackWebhook) {
    const workflowUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    const payload = generateSlackPayload(results, workflowUrl)

    try {
      // Use built-in fetch (Node 18+)
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      } as RequestInit)
      console.log('\n✅ Slack notification sent')
    } catch (error) {
      console.error('\n⚠️ Failed to send Slack notification:', error)
    }
  }

  // Exit with appropriate code
  const allPassed = results.every((r) => r.passed)
  process.exit(allPassed ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
