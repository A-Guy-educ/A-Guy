/**
 * @fileType types
 * @domain cody | system-test
 * @pattern scenario-types
 * @ai-summary Shared types for system test scenarios
 */

import type { GitHubClient } from '../../inspector/core/types'
import type { Logger } from 'pino'
import type { ScenarioResult } from '../lib/report'

export interface ScenarioContext {
  gh: GitHubClient
  repo: string
  runId: string
  versionBranch: string
  log: Logger
}

export interface Scenario {
  name: string
  description: string
  timeoutMs: number
  run(ctx: ScenarioContext): Promise<ScenarioResult>
}

export { ScenarioResult }
