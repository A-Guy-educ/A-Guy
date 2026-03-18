// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Playwright spec file for running scenarios
 * Loads scenarios and executes them via the scenario runner
 * @fileType test-spec
 * @domain qa
 * @pattern scenario-test-spec
 */
import { test, type Page } from '@playwright/test'
import { runScenario } from './scenario-runner'
import { loadScenarios, type _ScenarioCategory } from './loader'

test.describe('Scenario-driven QA', () => {
  test.describe('Core scenarios', () => {
    test.beforeAll(async () => {
      // Load scenarios at describe level to avoid test.info() at top level
    })

    test('run core scenarios', async ({ page }: { page: Page }) => {
      const scenarios = await loadScenarios('core')

      for (const scenario of scenarios) {
        const result = await runScenario(page, scenario)

        if (result.status === 'failed') {
          throw new Error(
            `Scenario "${scenario.id}" failed at step ${result.failedStep?.index ?? 'setup'}: ${result.failedStep?.action} — ${result.failedStep?.error}`,
          )
        }
      }
    })
  })

  test.describe('Feature scenarios', () => {
    test('run feature scenarios', async ({ page }: { page: Page }) => {
      const scenarios = await loadScenarios('feature')

      for (const scenario of scenarios) {
        const result = await runScenario(page, scenario)

        if (result.status === 'failed') {
          throw new Error(
            `Scenario "${scenario.id}" failed at step ${result.failedStep?.index ?? 'setup'}: ${result.failedStep?.action} — ${result.failedStep?.error}`,
          )
        }
      }
    })
  })

  test.describe('Edge scenarios', () => {
    test('run edge scenarios', async ({ page }: { page: Page }) => {
      const scenarios = await loadScenarios('edge')

      for (const scenario of scenarios) {
        const result = await runScenario(page, scenario)

        if (result.status === 'failed') {
          throw new Error(
            `Scenario "${scenario.id}" failed at step ${result.failedStep?.index ?? 'setup'}: ${result.failedStep?.action} — ${result.failedStep?.error}`,
          )
        }
      }
    })
  })
})
