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
import { specOnlyScenario } from './scenarios/05-spec-only-mode'
import { complexitySkipScenario } from './scenarios/06-complexity-skip'
import { badSpecScenario } from './scenarios/07-bad-spec-failure'

const SCENARIOS: Record<string, CliScenario> = {
  '01-status-mode': statusModeScenario,
  '02-help-mode': helpModeScenario,
  '03-error-handling': errorHandlingScenario,
  '04-full-pipeline': fullPipelineScenario,
  '05-spec-only-mode': specOnlyScenario,
  '06-complexity-skip': complexitySkipScenario,
  '07-bad-spec-failure': badSpecScenario,
}

async function main() {
  const args = process.argv.slice(2)
  let scenarioName = '04-full-pipeline'
  let runId = process.env.GITHUB_RUN_ID || Date.now().toString()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--scenario' && i + 1 < args.length) scenarioName = args[++i]
    else if (arg === '--run-id' && i + 1 < args.length) runId = args[++i]
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
  const mockGh = {
    createIssue: () => null,
    listWorkflowRuns: () => [] as { id: number; conclusion: string }[],
  }
  const ctx: CliScenarioContext = { workingDir: process.cwd(), gh: mockGh, runId, log }

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

  console.log('')
  console.log(`Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Duration: ${Math.round(result.duration / 1000)}s`)
  console.log('')
  for (const a of result.assertions)
    console.log(`  ${a.passed ? '✅' : '❌'} ${a.name}${a.detail ? ` (${a.detail})` : ''}`)
  if (result.error) console.log(`\nError: ${result.error}`)

  const fs = await import('fs')
  fs.writeFileSync(`./cody-cli-test-result-${scenarioName}.json`, JSON.stringify(result, null, 2))
  console.log(`\nResult written to ./cody-cli-test-result-${scenarioName}.json`)

  process.exit(result.passed ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
