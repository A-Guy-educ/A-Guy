// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Parallel scenario executor
 * Runs multiple scenarios concurrently for faster test execution
 * @fileType runner
 * @domain qa
 * @pattern parallel-executor
 */
import type { Browser, Page } from '@playwright/test'
import { runScenario, type ScenarioResult } from './scenario-runner'
import type { Scenario } from '../schema/scenario.schema'

export interface ParallelConfig {
  concurrency: number
  browser: Browser
}

export interface ExecutorReport {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  results: ScenarioResult[]
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Run a single scenario in its own browser context
 * Each scenario gets its own context to avoid cookie/storage conflicts
 */
async function runScenarioInContext(browser: Browser, scenario: Scenario): Promise<ScenarioResult> {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const result = await runScenario(page, scenario)
    return result
  } finally {
    await context.close()
  }
}

/**
 * Run multiple scenarios in parallel
 */
export async function runScenariosParallel(
  scenarios: Scenario[],
  config: ParallelConfig,
): Promise<ExecutorReport> {
  const { concurrency, browser } = config
  const start = Date.now()

  // For small number of scenarios, use simple parallel execution
  // For larger numbers, chunk and process
  const results: ScenarioResult[] = []

  if (scenarios.length <= concurrency) {
    // Run all in parallel
    const promises = scenarios.map((scenario) => runScenarioInContext(browser, scenario))
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  } else {
    // Chunk and process in batches
    const chunks = chunkArray(scenarios, concurrency)
    for (const chunk of chunks) {
      const promises = chunk.map((scenario) => runScenarioInContext(browser, scenario))
      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
    }
  }

  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  return {
    total: scenarios.length,
    passed,
    failed,
    skipped,
    duration: Date.now() - start,
    results,
  }
}

/**
 * Run scenarios sequentially (default behavior)
 */
export async function runScenariosSequential(
  scenarios: Scenario[],
  page: Page,
): Promise<ExecutorReport> {
  const start = Date.now()
  const results: ScenarioResult[] = []

  for (const scenario of scenarios) {
    const result = await runScenario(page, scenario)
    results.push(result)
  }

  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length

  return {
    total: scenarios.length,
    passed,
    failed,
    skipped,
    duration: Date.now() - start,
    results,
  }
}
