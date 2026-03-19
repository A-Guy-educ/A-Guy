// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Scenario runner - orchestrates seed → execute → teardown
 * @fileType runner
 * @domain qa
 * @pattern scenario-runner
 */
import type { Page } from '@playwright/test'
import { actionRegistry } from '../actions/registry'
import { seedPreconditions } from './seed'
import { teardownPreconditions } from './teardown'
import { resolveRefs } from './ref-resolver'
import type { Scenario } from '../schema/scenario.schema'
import type { ActionContext, ActionRef } from '../actions/types'

export interface ScenarioResult {
  scenarioId: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  failedStep?: {
    index: number
    action: string
    error: string
  }
}

export async function runScenario(page: Page, scenario: Scenario): Promise<ScenarioResult> {
  const refs: Record<string, ActionRef> = {}
  const start = Date.now()

  try {
    // 1. Seed preconditions
    if (scenario.preconditions?.length) {
      await seedPreconditions(scenario.preconditions, refs)
    }

    // 2. Execute steps
    const ctx: ActionContext = {
      page,
      locale: scenario.locale,
      refs,
    }

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]
      const handler = actionRegistry[step.action]

      if (!handler) {
        throw new Error(`Unknown action: "${step.action}"`)
      }

      const resolvedInput = step.input ? resolveRefs(step.input, refs) : undefined

      try {
        await handler(ctx, resolvedInput)
      } catch (stepError) {
        return {
          scenarioId: scenario.id,
          status: 'failed',
          duration: Date.now() - start,
          failedStep: {
            index: i,
            action: step.action,
            error: stepError instanceof Error ? stepError.message : String(stepError),
          },
        }
      }
    }

    return {
      scenarioId: scenario.id,
      status: 'passed',
      duration: Date.now() - start,
    }
  } catch (error) {
    return {
      scenarioId: scenario.id,
      status: 'failed',
      duration: Date.now() - start,
      failedStep: {
        index: -1,
        action: 'setup',
        error: error instanceof Error ? error.message : String(error),
      },
    }
  } finally {
    // 3. Teardown - ALWAYS runs
    if (scenario.teardown === 'auto' && Object.keys(refs).length > 0) {
      await teardownPreconditions(refs)
    }
  }
}
