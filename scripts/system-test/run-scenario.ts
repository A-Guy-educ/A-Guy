#!/usr/bin/env pnpm tsx
/**
 * @fileType script
 * @domain cody | system-test
 * @ai-summary CLI entry point for running a single system test scenario
 */

import pino from 'pino'
import { createSystemTestClient } from './lib/gh-client'
import type { ScenarioContext, Scenario } from './scenarios/types'
import { scenario02 } from './scenarios/02-full-high-complexity'
import { scenario00 } from './scenarios/00-minimal-test'

const SCENARIOS: Record<string, Scenario> = {
  '00-minimal-test': scenario00,
  '02-full-high-complexity': scenario02,
}

async function main() {
  const args = process.argv.slice(2)
  let scenarioName = '02-full-high-complexity'
  let repo = process.env.REPO || ''
  let runId = process.env.GITHUB_RUN_ID || Date.now().toString()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--scenario' && i + 1 < args.length) {
      scenarioName = args[++i]
    } else if (arg === '--repo' && i + 1 < args.length) {
      repo = args[++i]
    } else if (arg === '--run-id' && i + 1 < args.length) {
      runId = args[++i]
    }
  }

  if (!repo) {
    console.error('Error: --repo is required')
    process.exit(1)
  }

  const scenario = SCENARIOS[scenarioName]
  if (!scenario) {
    console.error(
      `Unknown scenario "${scenarioName}". Available: ${Object.keys(SCENARIOS).join(', ')}`,
    )
    process.exit(1)
  }

  console.log(`Scenario: ${scenarioName}`)
  console.log(`Repo: ${repo}`)
  console.log(`Run ID: ${runId}`)
  console.log('')

  const gh = createSystemTestClient(repo)
  const log = pino({ name: 'system-test', level: 'info' })

  const ctx: ScenarioContext = {
    gh,
    repo,
    runId,
    versionBranch: 'dev',
    log,
  }

  let result: Awaited<ReturnType<Scenario['run']>>

  try {
    result = await scenario.run(ctx)
  } catch (error) {
    result = {
      name: scenarioName,
      passed: false,
      duration: 0,
      assertions: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // Print
  console.log('')
  console.log(`Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Duration: ${Math.round(result.duration / 1000)}s`)
  console.log('')
  for (const a of result.assertions) {
    console.log(`  ${a.passed ? '✅' : '❌'} ${a.name}${a.detail ? ` (${a.detail})` : ''}`)
  }
  if (result.error) console.log(`\nError: ${result.error}`)

  // Write result JSON to consistent location
  const fs = await import('fs')
  const resultsDir = './system-test-results'
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultFile = `${resultsDir}/${scenarioName}-${timestamp}.json`
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2))
  console.log(`\nResult written to ${resultFile}`)

  process.exit(result.passed ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
