#!/usr/bin/env pnpm tsx
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
  let scenarioName = '04-full-pipeline'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && i + 1 < args.length) scenarioName = args[++i]
  }
  const scenario = SCENARIOS[scenarioName]
  if (!scenario) {
    console.error(`Unknown: ${scenarioName}`)
    process.exit(1)
  }
  console.log(`Scenario: ${scenarioName}`)
  const log = pino({ name: 'cli-test', level: 'info' })
  const ctx: CliScenarioContext = {
    workingDir: process.cwd(),
    gh: { createIssue: () => null, listWorkflowRuns: () => [] },
    runId: Date.now().toString(),
    log,
  }
  let result: Awaited<ReturnType<CliScenario['run']>>
  try {
    result = await scenario.run(ctx)
  } catch (e) {
    result = { name: scenarioName, passed: false, duration: 0, assertions: [], error: String(e) }
  }
  console.log(`\nResult: ${result.passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Duration: ${Math.round(result.duration / 1000)}s`)
  for (const a of result.assertions)
    console.log(`  ${a.passed ? '✅' : '❌'} ${a.name}${a.detail ? ` (${a.detail})` : ''}`)
  const fs = await import('fs')
  fs.writeFileSync(`./cody-cli-test-result-${scenarioName}.json`, JSON.stringify(result, null, 2))
  process.exit(result.passed ? 0 : 1)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
