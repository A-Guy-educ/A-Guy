#!/usr/bin/env pnpm tsx
/**
 * @fileType script
 * @domain cody | cody-cli-test
 * @ai-summary CLI entry point for running Cody CLI system tests
 */

import pino from 'pino'
import type { CliScenarioContext, CliScenario } from './scenarios/types'
import { statusModeScenario } from './scenarios/01-status-mode'
import { helpModeScenario } from './scenarios/02-help-mode'
import { errorHandlingScenario } from './scenarios/03-error-handling'
import { fullPipelineScenario } from './scenarios/04-full-pipeline'

const SCENARIOS: Record<string, CliScenario> = {
  '01-status-mode': statusModeScenario,
  '02-help-mode': helpModeScenario,
  '03-error-handling': errorHandlingScenario,
  '04-full-pipeline': fullPipelineScenario,
}

async function main() {
  const args = process.argv.slice(2)
  let scenarioName = '01-status-mode'
  let runId = process.env.GITHUB_RUN_ID || Date.now().toString()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--scenario' && i + 1 < args.length) {
      scenarioName = args[++i]
    } else if (arg === '--run-id' && i + 1 < args.length) {
      runId = args[++i]
    }
  }

  const scenario = SCENARIOS[scenarioName]
  if (!scenario) {
    console.error(
      `Unknown scenario "${scenarioName}". Available: ${Object.keys(SCENARIOS).join(', ')}`,
    )
    process.exit(1)
  }

  console.log(`Scenario: ${scenarioName}`)
  console.log(`Run ID: ${runId}`)
  console.log('')

  const log = pino({ name: 'cody-cli-test', level: 'info' })

  // Mock GH client - CLI tests run locally and don't need GitHub API
  const mockGh = {
    createIssue: (_title: string, _body: string, _labels?: string[]) => null,
    listWorkflowRuns: () => [] as { id: number; conclusion: string }[],
  }

  const ctx: CliScenarioContext = {
    workingDir: process.cwd(),
    gh: mockGh,
    runId,
    log,
  }

  let result: Awaited<ReturnType<CliScenario['run']>>

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

  // Print results
  console.log('')
  console.log(`Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Duration: ${Math.round(result.duration / 1000)}s`)
  console.log('')
  for (const a of result.assertions) {
    console.log(`  ${a.passed ? '✅' : '❌'} ${a.name}${a.detail ? ` (${a.detail})` : ''}`)
  }
  if (result.error) console.log(`\nError: ${result.error}`)

  // Write result JSON
  const fs = await import('fs')
  const resultFile = `./cody-cli-test-result-${scenarioName}.json`
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2))
  console.log(`\nResult written to ${resultFile}`)

  process.exit(result.passed ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
