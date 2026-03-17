#!/usr/bin/env pnpm tsx
/**
 * @fileType script
 * @domain cody | system-test
 * @ai-summary CLI entry point for running a single system test scenario
 */

import pino from 'pino'
import { createSystemTestClient } from './lib/gh-client'
import { cleanupScenario } from './lib/cleanup'
import type { ScenarioContext, Scenario } from './scenarios/types'
import type { AssertionResult } from './lib/report'
import { scenario02 } from './scenarios/02-full-high-complexity'

// Map of available scenarios
const SCENARIOS: Record<string, Scenario> = {
  '02-full-high-complexity': scenario02,
}

async function main() {
  const args = process.argv.slice(2)
  let scenarioName = '02-full-high-complexity'
  let repo = process.env.REPO || ''
  let runId = ''
  let versionBranch = 'dev'

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--scenario' && i + 1 < args.length) {
      scenarioName = args[i + 1]
      i++
    } else if (arg === '--repo' && i + 1 < args.length) {
      repo = args[i + 1]
      i++
    } else if (arg === '--run-id' && i + 1 < args.length) {
      runId = args[i + 1]
      i++
    } else if (arg === '--version-branch' && i + 1 < args.length) {
      versionBranch = args[i + 1]
      i++
    }
  }

  // Validate required args
  if (!repo) {
    console.error('Error: --repo is required')
    console.error(
      'Usage: pnpm tsx run-scenario.ts --scenario <name> --repo <owner/repo> --run-id <id> --version-branch <branch>',
    )
    process.exit(1)
  }

  if (!runId) {
    runId = Date.now().toString()
  }

  // Get scenario
  const scenario = SCENARIOS[scenarioName]
  if (!scenario) {
    console.error(`Error: Unknown scenario "${scenarioName}"`)
    console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}`)
    process.exit(1)
  }

  console.log(`Running scenario: ${scenarioName}`)
  console.log(`Repo: ${repo}`)
  console.log(`Run ID: ${runId}`)
  console.log(`Version branch: ${versionBranch}`)
  console.log('')

  // Create context
  const gh = createSystemTestClient(repo)
  const log = pino({ name: 'system-test', level: 'info' })

  const ctx: ScenarioContext = {
    gh,
    repo,
    runId,
    versionBranch,
    log,
  }

  let result: Awaited<ReturnType<Scenario['run']>> | undefined

  try {
    // Run scenario
    result = await scenario.run(ctx)

    // Print result
    console.log('')
    console.log(`Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`)
    console.log('')
    console.log('Assertions:')
    for (const assertion of result.assertions) {
      console.log(`  ${assertion.passed ? '✅' : '❌'} ${assertion.name}`)
      if (assertion.detail && !assertion.passed) {
        console.log(`      ${assertion.detail}`)
      }
    }

    if (result.error) {
      console.log('')
      console.log(`Error: ${result.error}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Scenario failed with error: ${errorMessage}`)

    result = {
      name: scenarioName,
      passed: false,
      duration: 0,
      assertions: [],
      error: errorMessage,
    }
  } finally {
    // Always cleanup
    console.log('')
    console.log('Cleaning up...')

    // Determine cleanup targets from result if available
    let issueNumber: number | undefined
    let prNumbers: number[] | undefined
    let branches: string[] | undefined

    if (result?.assertions) {
      // Try to extract PR info from assertions
      const prAssertion = result.assertions.find(
        (a: AssertionResult) => a.name === 'PR created' && a.passed && a.detail,
      )
      if (prAssertion?.detail) {
        // Parse "PR #123: branch-name" from detail
        const match = prAssertion.detail.match(/PR #(\d+): (.+)/)
        if (match) {
          prNumbers = [parseInt(match[1], 10)]
          branches = [match[2]]
        }
      }
    }

    if (issueNumber || prNumbers || branches) {
      await cleanupScenario(gh, repo, {
        issueNumber,
        prNumbers,
        branches,
      })
    } else {
      console.log('No cleanup targets identified')
    }
  }

  // Write result JSON
  const resultFile = `./system-test-result-${scenarioName}.json`
  const fs = await import('fs')
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2))
  console.log(`Result written to ${resultFile}`)

  // Exit with appropriate code
  process.exit(result?.passed ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
