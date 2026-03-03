/**
 * @fileType script
 * @domain watchdog
 * @pattern orchestration
 * @ai-summary Main entry point for the Watchdog - proactive pipeline monitoring
 */

import type { WatchdogContext, CheckResult } from './types'
import { deliver } from './delivery'
import { checkStuckPipelines } from './checks/stuck-pipelines'
import { checkGateReminders } from './checks/gate-reminders'
import { checkSilentFailures } from './checks/silent-failures'

// ============================================================================
// Check Registry
// ============================================================================

type CheckFunction = (context: WatchdogContext) => Promise<CheckResult[]>

const CHECK_REGISTRY: Record<string, CheckFunction> = {
  'stuck-pipelines': checkStuckPipelines,
  'gate-reminders': checkGateReminders,
  'silent-failures': checkSilentFailures,
}

// All checks to run
const ALL_CHECKS = Object.keys(CHECK_REGISTRY)

// ============================================================================
// Main
// ============================================================================

async function runWatchdog(): Promise<void> {
  console.log('=== Cody Watchdog ===')

  // Get environment
  const repo = process.env.REPO
  const ghToken = process.env.GH_TOKEN || ''
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
  const watchdogIssue = process.env.WATCHDOG_ISSUE || '0'
  const requestedChecks = (process.env.RUN_CHECKS || 'all')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!repo) {
    console.error('Missing REPO environment variable')
    process.exit(1)
  }

  // Determine which checks to run
  const checksToRun =
    requestedChecks.includes('all') || requestedChecks.includes('')
      ? ALL_CHECKS
      : requestedChecks.filter((c) => CHECK_REGISTRY[c])

  console.log(`Running checks: ${checksToRun.join(', ')}`)

  const context: WatchdogContext = {
    repo,
    ghToken,
    slackWebhookUrl,
    watchdogIssue,
    requestedChecks: checksToRun,
  }

  // Run all checks
  const allResults: CheckResult[] = []

  for (const checkName of checksToRun) {
    const checkFn = CHECK_REGISTRY[checkName]
    if (!checkFn) {
      console.warn(`Unknown check: ${checkName}`)
      continue
    }

    console.log(`Running check: ${checkName}`)
    try {
      const results = await checkFn(context)
      console.log(`  -> ${results.length} results`)
      allResults.push(...results)
    } catch (error) {
      console.error(`Check ${checkName} failed:`, error)
    }
  }

  // Deliver results
  console.log(`Total results: ${allResults.length}`)
  const deliveryResult = await deliver(allResults, context)

  console.log('Watchdog completed')
  console.log(`Delivered to: ${deliveryResult.targets.join(', ') || 'none'}`)
}

// Run main
runWatchdog().catch((error) => {
  console.error('Watchdog failed:', error)
  process.exit(1)
})
