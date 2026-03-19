// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Direct scenario runner for testing
 * Runs scenarios directly using Playwright without full test infrastructure
 */
import { chromium } from 'playwright'
import { loadScenarios } from './loader'
import { runScenario } from './scenario-runner'

// Get base URL from environment or use default
const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'

async function main() {
  console.log('Starting scenario runner...')
  console.log(`Base URL: ${BASE_URL}\n`)

  const scenarios = await loadScenarios('core')
  console.log(`Loaded ${scenarios.length} core scenarios\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL: BASE_URL,
  })
  const page = await context.newPage()

  let passed = 0
  let failed = 0

  for (const scenario of scenarios) {
    console.log(`Running: ${scenario.name}...`)
    try {
      const result = await runScenario(page, scenario)
      if (result.status === 'passed') {
        console.log(`  ✅ PASSED (${result.duration}ms)`)
        passed++
      } else {
        console.log(`  ❌ FAILED: ${result.failedStep?.error}`)
        failed++
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error instanceof Error ? error.message : error}`)
      failed++
    }
  }

  console.log(`\n=== RESULTS ===`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${passed + failed}`)

  await browser.close()

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
